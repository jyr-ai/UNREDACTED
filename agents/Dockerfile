FROM python:3.11-slim

# System deps for httpx/pydantic native extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements first for layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy agents code into /app/agents/ so "from agents.X import ..." resolves
COPY . /app/agents/

EXPOSE 8000

# Render injects $PORT; default to 8000 for local docker run
CMD uvicorn agents.main:app --host 0.0.0.0 --port ${PORT:-8000}
