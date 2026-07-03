# Backend service: FastAPI + Uvicorn
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Install dependencies first for better layer caching.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application source.
COPY . .

# Uploaded files live here; mount a volume in production for persistence.
RUN mkdir -p /app/uploads

EXPOSE 8000

# PORT is provided by most hosts (Railway/Render); default to 8000 locally.
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000}"]
