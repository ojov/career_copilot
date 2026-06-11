FROM python:3.11-slim

# uv: single static binary copied from the official image.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# Node.js for the MongoDB MCP server (npx) — kept for when the MCP toolset
# in agent.py is re-enabled.
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies from the same lockfile uv uses locally — one source of
# truth, so prod always matches the tested local environment.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY . .

ENV PORT=8080
EXPOSE 8080

# Run inside the uv-managed virtualenv.
CMD ["uv", "run", "--no-sync", "python", "main.py"]
