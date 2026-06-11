import os
import json
from datetime import datetime, timezone
from dotenv import load_dotenv
from pymongo import MongoClient
from bson import ObjectId
from google.adk.agents import Agent
from google.adk.tools import google_search
from google.adk.tools.agent_tool import AgentTool
from google.adk.tools.mcp_tool.mcp_toolset import MCPToolset
from google.adk.tools.mcp_tool.mcp_session_manager import StdioConnectionParams

load_dotenv()

_mongo_client = None

def get_db():
    global _mongo_client
    if _mongo_client is None:
        import platform
        kwargs = {}
        if platform.system() == "Darwin":
            import certifi
            kwargs["tlsCAFile"] = certifi.where()
        _mongo_client = MongoClient(os.environ["MONGODB_URI"], **kwargs)
    return _mongo_client["career_copilot"]


# ── Tools ────────────────────────────────────────────────────────────────────

def get_profile(profile_id: str) -> dict:
    """Retrieve a user's career profile from MongoDB by profile_id."""
    try:
        oid = ObjectId(profile_id)
    except Exception:
        return {"error": f"Invalid profile_id: {profile_id}"}
    db = get_db()
    doc = db["profiles"].find_one({"_id": oid})
    if not doc:
        return {"error": "Profile not found"}
    doc["_id"] = str(doc["_id"])
    return doc


def search_cached_jobs(profile_id: str, limit: int = 10) -> list[dict]:
    """Search cached job listings matched to a user's profile."""
    db = get_db()
    jobs = list(
        db["jobs"]
        .find({"profileId": profile_id})
        .sort("cachedAt", -1)
        .limit(limit)
    )
    for j in jobs:
        j["_id"] = str(j["_id"])
    return jobs


def log_application(profile_id: str, company: str, role: str, contact: str = "") -> dict:
    """Log a new job application to the tracker."""
    db = get_db()
    result = db["applications"].insert_one({
        "profileId": profile_id,
        "company": company,
        "role": role,
        "status": "applied",
        "appliedAt": datetime.now(timezone.utc),
        "contact": contact or None,
        "updatedAt": datetime.now(timezone.utc),
    })
    return {"applicationId": str(result.inserted_id), "message": f"Logged application to {company} for {role}"}


def get_applications(profile_id: str) -> list[dict]:
    """Get all job applications for a user, flagging ones needing follow-up."""
    db = get_db()
    apps = list(db["applications"].find({"profileId": profile_id}).sort("appliedAt", -1))
    now = datetime.now(timezone.utc).timestamp()
    result = []
    for a in apps:
        a["_id"] = str(a["_id"])
        a["appliedAt"] = a["appliedAt"].isoformat()
        days_since = (now - a["appliedAt"].__class__.fromisoformat(a["appliedAt"]).timestamp()) / 86400
        a["needsFollowUp"] = a["status"] == "applied" and days_since > 7
        result.append(a)
    return result


def get_stale_applications(profile_id: str) -> list[dict]:
    """Return applications with no response after 7+ days."""
    apps = get_applications(profile_id)
    return [a for a in apps if a.get("needsFollowUp")]


def get_skill_gaps(profile_id: str) -> dict:
    """Return the latest skill gap analysis stored for a user's profile."""
    try:
        oid = ObjectId(profile_id)
    except Exception:
        return {"error": f"Invalid profile_id: {profile_id}"}
    db = get_db()
    doc = db["profiles"].find_one({"_id": oid}, {"gapAnalysis": 1})
    if not doc or not doc.get("gapAnalysis"):
        return {"message": "No skill gap analysis found. Ask the user to fetch jobs first."}
    return doc["gapAnalysis"]


# ── MongoDB MCP Toolset ───────────────────────────────────────────────────────

def create_mongodb_mcp_toolset() -> MCPToolset:
    """Connect to the official MongoDB MCP server via stdio."""
    mongo_uri = os.environ["MONGODB_URI"]
    return MCPToolset(
        connection_params=StdioConnectionParams(
            server_params={
                "command": "npx",
                "args": [
                    "-y",
                    "@mongodb-js/mongodb-mcp-server",
                    "--connectionString", mongo_uri,
                ],
            }
        ),
        # Only expose safe read/write tools — not drop/delete
        tool_filter=["find", "insertOne", "updateOne", "aggregate", "listCollections"],
    )


# ── Web search sub-agent ──────────────────────────────────────────────────────

# Gemini does not allow the built-in google_search tool to coexist with custom
# function tools in a single agent, so we isolate it in a sub-agent and expose it
# to the root agent via AgentTool. This is the web-search fallback for finding
# jobs when the structured job APIs return nothing useful.
job_search_agent = Agent(
    name="job_web_search",
    model="gemini-3.5-flash",
    description="Searches the web for current remote job openings.",
    instruction="""You search the web for remote job openings matching the user's
skills and preferences. Use Google Search to find real, currently-open remote
positions. Return a concise list: for each job include the title, company,
a one-line summary, and the application URL. Prioritize roles that are explicitly
remote and open to international/emerging-market applicants.""",
    tools=[google_search],
)


# ── Agent ─────────────────────────────────────────────────────────────────────

def create_career_agent() -> Agent:
    # MongoDB MCP server is available for direct Atlas access.
    # Our Python tools above wrap the same operations for reliability.
    # Uncomment to enable raw MCP tool access:
    # mongodb_mcp = create_mongodb_mcp_toolset()

    return Agent(
        name="remote_career_copilot",
        model="gemini-3.5-flash",
        description="A career agent that helps developers in emerging markets find and land remote jobs.",
        instruction="""You are a Remote Career Copilot — an AI agent helping developers in emerging markets
find remote jobs, close skill gaps, and manage their job search.

You have access to:
- The user's career profile (skills, experience, job titles)
- Cached job listings matched to their profile
- Their application tracker
- Skill gap analysis

Your capabilities:
1. Retrieve and explain matched job listings (search_cached_jobs)
2. Search the live web for fresh remote openings (job_web_search) — use this when
   the cached listings are empty, stale, or the user asks for more/different jobs
3. Analyze skill gaps and suggest a learning roadmap
4. Log new job applications when the user tells you they applied somewhere
5. Identify applications that need follow-up (no response in 7+ days)
6. Draft professional follow-up emails
7. Answer questions about the job search process

Prefer cached listings first (fast); fall back to job_web_search for live results.
Always be encouraging, specific, and action-oriented. When the user logs an application,
confirm the details. When they ask about follow-ups, surface the specific companies and
draft emails if asked. Keep responses concise and helpful.""",
        tools=[
            get_profile,
            search_cached_jobs,
            log_application,
            get_applications,
            get_stale_applications,
            get_skill_gaps,
            AgentTool(agent=job_search_agent),
        ],
    )


root_agent = create_career_agent()
