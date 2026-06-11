import os
import time
import uuid
import logging
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google import genai
from google.genai import types
from agent import root_agent

load_dotenv()

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)-7s [%(name)s] %(message)s",
)
log = logging.getLogger("career-agent")

app = FastAPI(title="Remote Career Copilot Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log every request with method, path, status, and duration."""
    rid = uuid.uuid4().hex[:8]
    start = time.perf_counter()
    log.info("→ [%s] %s %s", rid, request.method, request.url.path)
    try:
        response = await call_next(request)
    except Exception:
        elapsed = (time.perf_counter() - start) * 1000
        log.exception("✗ [%s] %s %s failed after %.0fms", rid, request.method, request.url.path, elapsed)
        raise
    elapsed = (time.perf_counter() - start) * 1000
    log.info("← [%s] %s %s %d %.0fms", rid, request.method, request.url.path, response.status_code, elapsed)
    return response

session_service = InMemorySessionService()
APP_NAME = "career_copilot"

runner = Runner(
    agent=root_agent,
    app_name=APP_NAME,
    session_service=session_service,
)


class ChatRequest(BaseModel):
    message: str
    profile_id: str
    session_id: str | None = None


class ChatResponse(BaseModel):
    reply: str
    session_id: str


@app.get("/health")
async def health():
    return {"status": "ok"}


_genai_client = None


GEMINI_MODEL = "gemini-2.5-flash"


def get_genai_client():
    global _genai_client
    if _genai_client is None:
        log.info("Initializing Vertex AI genai client (project=%s, location=%s)",
                 os.environ.get("GOOGLE_CLOUD_PROJECT"), os.environ.get("GOOGLE_CLOUD_LOCATION", "global"))
        _genai_client = genai.Client(
            vertexai=True,
            project=os.environ["GOOGLE_CLOUD_PROJECT"],
            location=os.environ.get("GOOGLE_CLOUD_LOCATION", "global"),
        )
    return _genai_client


def generate_json(prompt: str, what: str) -> dict:
    """Call Gemini, log timing, and extract a JSON object from the reply."""
    import json as _json
    client = get_genai_client()
    start = time.perf_counter()
    try:
        result = client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
    except Exception:
        log.exception("Gemini call failed during %s", what)
        raise HTTPException(status_code=502, detail=f"Gemini call failed during {what}")
    elapsed = (time.perf_counter() - start) * 1000
    raw = result.text or ""
    log.info("Gemini %s: %d chars in %.0fms", what, len(raw), elapsed)

    s, e = raw.find("{"), raw.rfind("}")
    if s == -1 or e == -1:
        log.error("No JSON found in %s response. Raw (truncated): %s", what, raw[:300])
        raise HTTPException(status_code=500, detail=f"Could not parse {what}")
    try:
        return _json.loads(raw[s : e + 1])
    except _json.JSONDecodeError:
        log.exception("JSON decode failed for %s. Raw (truncated): %s", what, raw[:300])
        raise HTTPException(status_code=500, detail=f"Invalid JSON in {what}")


def extract_pdf_text(pdf_bytes: bytes) -> str:
    """Extract plain text from PDF bytes using pypdf."""
    import io
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(pdf_bytes))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


class ExtractCVPdfRequest(BaseModel):
    pdf_base64: str


@app.post("/extract-cv-pdf")
async def extract_cv_pdf(req: ExtractCVPdfRequest):
    import base64
    try:
        pdf_bytes = base64.b64decode(req.pdf_base64)
        text = extract_pdf_text(pdf_bytes)
    except Exception:
        log.exception("extract-cv-pdf: failed to read PDF")
        raise HTTPException(status_code=400, detail="Could not read PDF")
    log.info("extract-cv-pdf: extracted %d chars from PDF", len(text))
    if not text.strip():
        raise HTTPException(status_code=422, detail="No text found in PDF")
    return _structure_cv(text)


class ExtractCVRequest(BaseModel):
    text: str


@app.post("/extract-cv")
async def extract_cv(req: ExtractCVRequest):
    log.info("extract-cv: %d chars of CV text", len(req.text))
    return _structure_cv(req.text)


def _structure_cv(text: str) -> dict:
    prompt = f"""You are a career analyst. Extract structured information from this CV/resume text.
Return ONLY valid JSON with this exact shape:
{{
  "name": string,
  "email": string | null,
  "skills": string[],
  "jobTitles": string[],
  "yearsOfExperience": number,
  "summary": string
}}

CV Text:
{text}
"""
    profile = generate_json(prompt, "extract-cv")
    log.info("extract-cv: extracted %d skills for %s",
             len(profile.get("skills", [])), profile.get("name", "?"))
    return profile


class AnalyzeGapsRequest(BaseModel):
    skills: list[str]
    job_descriptions: list[str]


@app.post("/analyze-gaps")
async def analyze_gaps(req: AnalyzeGapsRequest):
    log.info("analyze-gaps: %d skills vs %d job descriptions",
             len(req.skills), len(req.job_descriptions))
    sample = "\n---\n".join(req.job_descriptions[:5])
    prompt = f"""You are a career coach. Compare a developer's current skills against common requirements in job listings.

Developer skills: {", ".join(req.skills)}

Job descriptions sample:
{sample}

Return ONLY valid JSON:
{{
  "missingSkills": [{{ "skill": string, "frequency": number, "priority": "high"|"medium"|"low" }}],
  "roadmap": [{{ "skill": string, "resource": string, "estimatedWeeks": number }}]
}}
"""
    gaps = generate_json(prompt, "analyze-gaps")
    log.info("analyze-gaps: %d missing skills, %d roadmap items",
             len(gaps.get("missingSkills", [])), len(gaps.get("roadmap", [])))
    return gaps


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    session_id = req.session_id or str(uuid.uuid4())
    user_id = req.profile_id
    log.info("chat: profile=%s session=%s msg=%r", user_id, session_id, req.message[:80])

    session = await session_service.get_session(
        app_name=APP_NAME, user_id=user_id, session_id=session_id
    )
    if session is None:
        log.info("chat: creating new session %s", session_id)
        await session_service.create_session(
            app_name=APP_NAME,
            user_id=user_id,
            session_id=session_id,
            state={"profile_id": req.profile_id},
        )

    # Inject profile_id so the agent always has it
    augmented_message = f"[profile_id: {req.profile_id}] {req.message}"
    user_content = types.Content(role="user", parts=[types.Part(text=augmented_message)])

    reply_text = ""
    tool_calls = 0
    # Consume the full generator to avoid GeneratorExit/OTel context detach errors
    async for event in runner.run_async(
        user_id=user_id,
        session_id=session_id,
        new_message=user_content,
    ):
        if event.content and event.content.parts:
            for part in event.content.parts:
                if getattr(part, "function_call", None):
                    tool_calls += 1
                    log.info("chat: tool call → %s", part.function_call.name)
        if event.is_final_response() and event.content and event.content.parts:
            reply_text = event.content.parts[0].text or reply_text

    if not reply_text:
        log.error("chat: agent returned no response for session %s", session_id)
        raise HTTPException(status_code=500, detail="Agent returned no response")

    log.info("chat: reply %d chars after %d tool call(s)", len(reply_text), tool_calls)
    return ChatResponse(reply=reply_text, session_id=session_id)


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8089))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
