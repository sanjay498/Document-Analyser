# ==========================================
# Stage 1: Build Frontend (Vite + React)
# ==========================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ==========================================
# Stage 2: Production Python Backend Runtime
# ==========================================
FROM python:3.12-slim AS runner

# System dependencies for PDF parsing and OpenCV headless
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create unprivileged application user
RUN groupadd -r appuser && useradd -r -g appuser -d /app appuser

# Install Python dependencies
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r ./backend/requirements.txt

# Copy backend application code
COPY backend/ ./backend/

# Copy built frontend static assets into frontend/dist for self-contained serving
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Set production environment variables
ENV PYTHONUNBUFFERED=1 \
    ENVIRONMENT=production \
    PORT=8000 \
    DOCFILLER_DB_PATH=/app/data/docfiller.db

# Directories for SQLite database volume mount and uploads
RUN mkdir -p /app/data /app/uploads/qr /app/backend/app/uploads && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=10s \
  CMD curl -f http://localhost:${PORT:-8000}/health || exit 1

# Launch Uvicorn production server (supporting dynamic PORT for Render/cloud)
CMD ["sh", "-c", "python -m uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 2"]
