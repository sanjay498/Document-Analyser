# LexTitle AI — Production Legal Title Scrutiny & Document Synthesis

LexTitle AI is a modern, high-performance legal document scrutiny and synthesis platform engineered for Indian legal workflows, bank title opinions, and real estate conveyance scrutiny.

The platform extracts key title attributes, parties, deed numbers, survey extents, and encumbrance schedules from raw scanned deeds (PDF/images) using Google Gemini and NVIDIA Nemotron multimodal AI models, verifies extraction confidence, and synthesizes complete legal title opinions and scrutiny reports into formatted DOCX documents.

---

## Key Features

- **Document-First Workflow**: Clean, minimalist UI inspired by document tools—focusing purely on uploaded legal deeds and opinion generation.
- **Multimodal AI Title Extraction**:
  - **Google Gemini 3.x Flash**: High-speed OCR and field extraction from multi-page scanned deeds.
  - **NVIDIA Nemotron Nano Omni Reasoning**: Structured legal reasoning and legal opinion drafting.
- **Dynamic Bank Template Library**: Pre-configured templates grouped by major Indian banks (SBI, HDFC, ICICI, PNB, Canara, Axis) and generic scrutiny deeds.
- **Dynamic Table Groups & Schedules**: Automatically maps parent deed chains, schedules of property, boundaries, and survey extents into DOCX tables.
- **Production-Ready PostgreSQL Engine**:
  - Fully asynchronous database operations with `asyncpg` and SQLAlchemy 2.0.
  - Connection pooling with health checks, recycle intervals, and overflow handling.
  - Transparent SQLite fallback for rapid local testing without requiring external daemons.
- **Stealth Administration Portal**: Completely unadvertised admin route (`/management`) with master password protection for managing users, audit logs, and pricing.
- **Integrated Wallet & Payment Proof Queue**: Real Decimal-precision financial ledger supporting direct UPI verification (UTR verification queue).

---

## Tech Stack

### Frontend
- **Framework**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Build**: Vite with optimized static production bundling

### Backend
- **Framework**: Python 3.12+ / 3.14, FastAPI, Pydantic v2
- **Database / ORM**: SQLAlchemy 2.0 Async, PostgreSQL (`asyncpg`), SQLite fallback (`aiosqlite`)
- **Document Processing**: `python-docx`, `pypdf`, `pdfplumber`, `pypdfium2`, `pytesseract`, `Pillow`
- **AI Integrations**: Google Gemini API, NVIDIA NIM / Nemotron, Groq

---

## Quick Start (Docker Compose)

The easiest way to run LexTitle AI with PostgreSQL in production:

```bash
# 1. Clone repository
git clone https://github.com/sanjay498/Document-Analyser.git
cd Document-Analyser

# 2. Configure environment
cp .env.production.example .env
# Edit .env with your Gemini / NVIDIA API keys

# 3. Launch stack (PostgreSQL + FastAPI + Vite Frontend)
docker-compose up --build -d
```

- Application UI: http://localhost:8000
- API Documentation: http://localhost:8000/docs
- Health Check: http://localhost:8000/health

---

## Local Development

### 1. Backend Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp ../.env.production.example .env

# Run FastAPI server
uvicorn backend.app.main:app --reload --port 8000
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on http://localhost:5173 and proxies API requests to `http://localhost:8000`.

---

## Running Automated Tests

LexTitle AI comes with a comprehensive test suite covering API endpoints, multimodal processing, deed models, wallet transactions, and database idempotency:

```bash
./backend/venv/bin/python -m pytest backend/tests/ -v
```

---

## Security & Privacy Note

- Sensitive files such as `.env`, session databases (`docfiller.db*`), and API keys are strictly excluded via `.gitignore`.
- Always set custom, cryptographically secure values for `JWT_SECRET_KEY` and `ADMIN_PASSWORD` in production.
