# Remote Career Copilot

> An AI agent that helps developers in emerging markets find and land remote jobs.

Built for the **Google Cloud Rapid Agent Hackathon 2026** — MongoDB track.

[![License: MIT](https://img.shields.io/badge/License-MIT-violet.svg)](LICENSE)

## What it does

1. **CV Analysis** — Upload your PDF; Gemini extracts skills, experience, job titles
2. **Job Matching** — Real remote listings from Adzuna, ranked by profile fit
3. **Skill Gap Analysis** — Learning roadmap based on job market demands
4. **Application Tracker** — Log every application, MongoDB stores your history
5. **Follow-up Alerts** — Agent flags stale applications and drafts follow-up emails

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router) |
| Agent | Google Cloud Agent Builder (ADK 2.x) |
| LLM | Gemini 3.5 Flash (Vertex AI) |
| Database | MongoDB Atlas + MCP server |
| Jobs | Adzuna API |
| Deploy | Vercel + Cloud Run |

## Partner Integration — MongoDB

Uses the official **MongoDB MCP server** (`@mongodb-js/mongodb-mcp-server`) to give the ADK agent direct Atlas access for all career data operations.

## Architecture

```
Browser (Next.js → Vercel)
    ↓
/api/agent (proxy)
    ↓
ADK Agent (Python → Cloud Run)
    ↓ tools
MongoDB Atlas  ← MCP server + pymongo
Adzuna API     ← job listings
Gemini 3.5     ← Vertex AI Agent Platform
```

## Quick Start

```bash
git clone https://github.com/victorojo007/remote-career-copilot
cd remote-career-copilot
npm install

# Start agent
cd agent && uv sync && uv run python main.py

# Start frontend (new terminal)
npm run dev
```

See `.env.local.example` and `agent/.env.example` for required environment variables.

## License

MIT © 2026 Osamudiamen Ojo
