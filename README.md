# DocAuto AI - Enterprise AI-Powered Document Automation Platform

An enterprise-grade document automation platform that allows users to upload predefined document templates (`.docx`) containing dynamic placeholders (`{{FIELD_NAME}}`) and multi-format source documents (PDF, DOCX, JPG, PNG, scanned images).

The application leverages OCR and a modular AI architecture (supporting Hugging Face models like `Qwen/Qwen2.5-72B-Instruct` or `Mistral-7B` with zero-token offline fallbacks) to semantically extract information, present human-in-the-loop validation, and generate clean DOCX and PDF documents that **strictly preserve original template layout, fonts, colors, tables, headers, and footers**.

---

## Key Features

- **Dynamic Template Management**: Upload `.docx` templates with placeholders like `{{BORROWER_NAME}}`, `{{DOCUMENT_NUMBER}}`, `{{DATE}}`. Auto-detects fields and allows custom field additions.
- **Multi-Format Source Document Upload**: Drag-and-drop support for PDF, DOCX, JPG, JPEG, and PNG source files (scanned documents & multi-page files).
- **Hybrid OCR & Spatial Text Extraction**: Uses `pdfplumber`, `PyPDF`, and `EasyOCR` / `pytesseract` to extract text while maintaining page bounding box coordinates.
- **Modular AI Field Mapping Engine**:
  - `HuggingFaceProvider`: Connects to Hugging Face Inference API / Serverless API.
  - `FallbackAIProvider`: Intelligent offline fuzzy and regex pattern matcher for offline operation.
  - Pluggable `AIProviderFactory` interface.
- **Human-in-the-Loop Review Table**: Review extracted values, view exact source document text snippets, inspect confidence scores, edit values, and highlight missing fields before document generation.
- **Style-Preserving Document Engine**:
  - Run-level tag substitution in paragraphs, tables, headers, and footers.
  - Preserves exact font family, size, bold/italic, color, line spacing, and paragraph alignment.
- **Dual PDF Engine**: Lossless PDF conversion via headless LibreOffice with ReportLab fallback.
- **Side-by-Side Preview & Download**: Preview source text vs dynamic field insertions and download generated DOCX and PDF files.

---

## Tech Stack

### Frontend
- **Framework**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS (with custom glassmorphic dark theme)
- **State & Data**: TanStack React Query, Axios, React Router DOM v6
- **UI Components & Icons**: Lucide React, Framer Motion

### Backend
- **Framework**: Python 3.11+, FastAPI, Pydantic v2
- **ORM & DB**: SQLAlchemy, SQLite (default) / PostgreSQL compatible
- **Document Processing**: `python-docx`, `pdfplumber`, `pypdf`, `Pillow`, `reportlab`
- **OCR**: `EasyOCR` / `pytesseract`
- **AI**: `huggingface_hub`, `requests`

---

## Quick Start (Local Development)

### 1. Backend Setup
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env

# Run FastAPI development server
uvicorn app.main:app --reload --port 8000
```
API Documentation will be available at: [http://localhost:8000/docs](http://localhost:8000/docs)

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Frontend Web App will be available at: [http://localhost:3000](http://localhost:3000)

---

## Running with Docker Compose

```bash
docker-compose up --build
```
- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend API: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## Running Test Suite

```bash
cd backend
python3 -m pytest
```

---

## User Workflow (Step-by-Step)

1. **Upload Template**: Navigate to **Templates** and upload a `.docx` template containing placeholders like `{{BORROWER_NAME}}`.
2. **Start Process**: Go to **Process Document**, select the template, and upload source files (`.pdf`, `.jpg`, `.docx`).
3. **Run AI Analysis**: Click **Analyze & Extract Fields with AI**. Watch real-time progress steps (`OCR PROCESSING` -> `DOCUMENT ANALYSIS` -> `FIELD MATCHING` -> `VALIDATION`).
4. **Human Review**: Inspect the Extracted Field Mapping table. Verify values and edit any missing fields.
5. **Generate Document**: Click **Approve & Generate Final Document**.
6. **Download & Preview**: Preview the generated field map and download editable DOCX or PDF files.
