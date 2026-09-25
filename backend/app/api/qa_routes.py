"""
Doc Filler AI - Intelligent Legal Template Question Answering API Routes
Handles dynamic template parsing, multi-source legal document ingestion,
grounded QA execution, side-by-side human review, and final report download.
"""

import json
import uuid
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile, File, Form
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.app.db.database import get_db
from backend.app.db.models import TemplateQASession, User
from backend.app.core.auth import get_current_user_optional
from backend.app.core.source_extractor import extract_text_from_source, ExtractedSourceDocument
from backend.app.core.qa_engine import (
    TemplateQuestion,
    QuestionAnswer,
    SourceEvidence,
    ConflictEvidence,
    extract_template_questions,
    build_document_index,
    generate_grounded_answer,
    generate_qa_report,
    QUESTION_TYPES
)

router = APIRouter(prefix="/api/qa", tags=["legal-template-qa"])


# ---------------------------------------------------------------------------
# Request & Response Schemas
# ---------------------------------------------------------------------------
class CreateSessionResponse(BaseModel):
    session_id: str
    status: str


class TemplateUploadResponse(BaseModel):
    session_id: str
    questions_count: int
    sections: List[str]
    questions: List[TemplateQuestion]


class SourceDocSummary(BaseModel):
    filename: str
    file_type: str
    char_count: int
    page_or_section_count: int
    is_scanned_ocr: bool
    has_tamil: bool


class SourceUploadResponse(BaseModel):
    session_id: str
    documents_count: int
    documents: List[SourceDocSummary]


class RunQAResponse(BaseModel):
    session_id: str
    total_questions: int
    supported_count: int
    needs_review_count: int
    conflicts_count: int
    not_found_count: int
    answers: List[QuestionAnswer]


class QASessionStateResponse(BaseModel):
    session_id: str
    status: str
    template_filename: Optional[str] = None
    questions_count: int = 0
    documents_count: int = 0
    questions: List[TemplateQuestion] = Field(default_factory=list)
    answers: List[QuestionAnswer] = Field(default_factory=list)
    documents: List[SourceDocSummary] = Field(default_factory=list)


class UpdateAnswerRequest(BaseModel):
    answer: str
    compliance_status: Optional[str] = None
    status: Optional[str] = "user_edited"  # user_approved, user_edited, needs_review
    verification_badge: Optional[str] = "Human Verified"
    user_notes: Optional[str] = None


class RenameDocumentRequest(BaseModel):
    filename: str


class RenameDocumentResponse(BaseModel):
    session_id: str
    template_filename: str


class UseAsNextTemplateRequest(BaseModel):
    new_filename: Optional[str] = None
    keep_sources: Optional[bool] = False



# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@router.post("/sessions/create", response_model=CreateSessionResponse)
async def create_qa_session(
    db: AsyncSession = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional)
):
    """Creates a new Intelligent Legal Template QA Session."""
    session_id = str(uuid.uuid4())
    session = TemplateQASession(
        id=session_id,
        user_id=user.id if user else None,
        template_filename="untitled_template.docx",
        status="created"
    )
    db.add(session)
    await db.commit()
    return CreateSessionResponse(session_id=session_id, status="created")


@router.post("/sessions/{session_id}/upload-template", response_model=TemplateUploadResponse)
async def upload_template(
    session_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Uploads any legal template (DOCX or text) and dynamically extracts questions,
    headings, checklists, and table placeholders without hardcoding.
    """
    res = await db.execute(select(TemplateQASession).where(TemplateQASession.id == session_id))
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    file_bytes = await file.read()
    questions = extract_template_questions(file_bytes, file.filename)

    sections = list(dict.fromkeys(q.section for q in questions))
    session.template_filename = file.filename
    session.template_bytes = file_bytes
    session.questions_json = json.dumps([q.model_dump() for q in questions])
    session.status = "template_parsed"
    await db.commit()

    return TemplateUploadResponse(
        session_id=session_id,
        questions_count=len(questions),
        sections=sections,
        questions=questions
    )


@router.post("/sessions/{session_id}/upload-sources", response_model=SourceUploadResponse)
async def upload_source_documents(
    session_id: str,
    files: List[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Uploads multiple source legal documents (PDF, DOCX, TXT, Images),
    extracts page-level text, applies OCR for scans, and normalizes Tamil documents.
    """
    res = await db.execute(select(TemplateQASession).where(TemplateQASession.id == session_id))
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    extracted_docs: List[ExtractedSourceDocument] = []
    summaries: List[SourceDocSummary] = []

    for f in files:
        f_bytes = await f.read()
        extracted = extract_text_from_source(f_bytes, f.filename)
        extracted_docs.append(extracted)
        summaries.append(SourceDocSummary(
            filename=extracted.filename,
            file_type=extracted.file_type,
            char_count=extracted.char_count,
            page_or_section_count=extracted.page_or_section_count,
            is_scanned_ocr=extracted.is_scanned_ocr,
            has_tamil=extracted.has_tamil
        ))

    session.sources_json = json.dumps([d.model_dump() for d in extracted_docs])
    session.status = "sources_uploaded"
    await db.commit()

    return SourceUploadResponse(
        session_id=session_id,
        documents_count=len(summaries),
        documents=summaries
    )


@router.post("/sessions/{session_id}/run-qa", response_model=RunQAResponse)
async def run_intelligent_qa(
    session_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Executes dynamic question answering:
    - Builds multi-document evidence index
    - Detects cross-document contradictions
    - Synthesizes title chronology and encumbrance status
    - Strictly enforces ZERO HALLUCINATION (missing facts return 'Not found in the provided documents.')
    """
    res = await db.execute(select(TemplateQASession).where(TemplateQASession.id == session_id))
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if not session.questions_json:
        raise HTTPException(status_code=400, detail="No template questions found. Please upload a template first.")
    if not session.sources_json:
        raise HTTPException(status_code=400, detail="No source documents found. Please upload source documents first.")

    raw_questions = json.loads(session.questions_json)
    questions = [TemplateQuestion(**q) for q in raw_questions]

    raw_sources = json.loads(session.sources_json)
    source_docs = [ExtractedSourceDocument(**d) for d in raw_sources]

    # Build multi-document index
    index = build_document_index(source_docs)

    # Process all questions
    answers: List[QuestionAnswer] = []
    supported_c = 0
    needs_review_c = 0
    conflicts_c = 0
    not_found_c = 0

    for q in questions:
        ans = generate_grounded_answer(q, index)
        answers.append(ans)

        if ans.status == "supported":
            supported_c += 1
        elif ans.status == "conflict_detected":
            conflicts_c += 1
        elif ans.status == "needs_review":
            needs_review_c += 1
        elif ans.status == "not_found":
            not_found_c += 1

    session.answers_json = json.dumps([a.model_dump() for a in answers])
    session.status = "qa_completed"
    await db.commit()

    return RunQAResponse(
        session_id=session_id,
        total_questions=len(questions),
        supported_count=supported_c,
        needs_review_count=needs_review_c,
        conflicts_count=conflicts_c,
        not_found_count=not_found_c,
        answers=answers
    )


@router.get("/sessions/{session_id}/state", response_model=QASessionStateResponse)
async def get_session_state(
    session_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Retrieves full session state, questions, sources, and answers for UI."""
    res = await db.execute(select(TemplateQASession).where(TemplateQASession.id == session_id))
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    questions = [TemplateQuestion(**q) for q in json.loads(session.questions_json)] if session.questions_json else []
    answers = [QuestionAnswer(**a) for a in json.loads(session.answers_json)] if session.answers_json else []
    
    docs_summary = []
    if session.sources_json:
        raw_sources = json.loads(session.sources_json)
        for d in raw_sources:
            docs_summary.append(SourceDocSummary(
                filename=d["filename"],
                file_type=d["file_type"],
                char_count=d["char_count"],
                page_or_section_count=d["page_or_section_count"],
                is_scanned_ocr=d.get("is_scanned_ocr", False),
                has_tamil=d.get("has_tamil", False)
            ))

    return QASessionStateResponse(
        session_id=session_id,
        status=session.status,
        template_filename=session.template_filename,
        questions_count=len(questions),
        documents_count=len(docs_summary),
        questions=questions,
        answers=answers,
        documents=docs_summary
    )


@router.put("/sessions/{session_id}/answers/{question_id}", response_model=QuestionAnswer)
async def update_question_answer(
    session_id: str,
    question_id: str,
    payload: UpdateAnswerRequest,
    db: AsyncSession = Depends(get_db)
):
    """Updates an answer with human verification or inline edits."""
    res = await db.execute(select(TemplateQASession).where(TemplateQASession.id == session_id))
    session = res.scalar_one_or_none()
    if not session or not session.answers_json:
        raise HTTPException(status_code=404, detail="Session or answers not found")

    answers_list = json.loads(session.answers_json)
    target_idx = None
    for idx, a in enumerate(answers_list):
        if a["question_id"] == question_id:
            target_idx = idx
            break

    if target_idx is None:
        raise HTTPException(status_code=404, detail=f"Question {question_id} not found in session")

    a = answers_list[target_idx]
    a["answer"] = payload.answer
    if payload.compliance_status:
        a["compliance_status"] = payload.compliance_status
    if payload.status:
        a["status"] = payload.status
    if payload.verification_badge:
        a["verification_badge"] = payload.verification_badge
    if payload.user_notes:
        a["user_notes"] = payload.user_notes

    answers_list[target_idx] = a
    session.answers_json = json.dumps(answers_list)
    await db.commit()

    return QuestionAnswer(**a)


@router.post("/sessions/{session_id}/approve-all", response_model=List[QuestionAnswer])
async def approve_all_answers(
    session_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Marks all supported non-conflict answers as Human Verified in bulk."""
    res = await db.execute(select(TemplateQASession).where(TemplateQASession.id == session_id))
    session = res.scalar_one_or_none()
    if not session or not session.answers_json:
        raise HTTPException(status_code=404, detail="Session or answers not found")

    answers_list = json.loads(session.answers_json)
    for a in answers_list:
        if a.get("status") in ["supported", "user_edited"]:
            a["status"] = "user_approved"
            a["verification_badge"] = "Human Verified"

    session.answers_json = json.dumps(answers_list)
    await db.commit()

    return [QuestionAnswer(**a) for a in answers_list]


@router.post("/sessions/{session_id}/generate-report")
async def generate_completed_report(
    session_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Injects approved answers into original template (.docx) preserving all formatting,
    borders, and layouts, and prepares download.
    """
    res = await db.execute(select(TemplateQASession).where(TemplateQASession.id == session_id))
    session = res.scalar_one_or_none()
    if not session or not session.template_bytes:
        raise HTTPException(status_code=400, detail="Missing template to generate report")

    if session.answers_json:
        answers = [QuestionAnswer(**a) for a in json.loads(session.answers_json)]
        report_bytes = generate_qa_report(session.template_bytes, answers)
    else:
        report_bytes = session.template_bytes

    session.final_docx_bytes = report_bytes
    session.status = "report_generated"
    await db.commit()

    return {
        "session_id": session_id,
        "status": "report_generated",
        "download_url": f"/api/qa/sessions/{session_id}/download-report"
    }


@router.put("/sessions/{session_id}/rename", response_model=RenameDocumentResponse)
async def rename_document(
    session_id: str,
    payload: RenameDocumentRequest,
    db: AsyncSession = Depends(get_db)
):
    """Renames the template / report document in the QA session."""
    res = await db.execute(select(TemplateQASession).where(TemplateQASession.id == session_id))
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    new_name = payload.filename.strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="Filename cannot be empty")

    if not new_name.lower().endswith(".docx"):
        new_name = f"{new_name}.docx"

    session.template_filename = new_name
    await db.commit()

    return RenameDocumentResponse(session_id=session_id, template_filename=new_name)


@router.get("/sessions/{session_id}/download-report")
async def download_completed_report(
    session_id: str,
    filename: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Downloads the finalized, populated .docx report with custom filename support."""
    res = await db.execute(select(TemplateQASession).where(TemplateQASession.id == session_id))
    session = res.scalar_one_or_none()
    if not session or (not session.final_docx_bytes and not session.template_bytes):
        raise HTTPException(status_code=404, detail="No document available for download")

    target_bytes = session.final_docx_bytes or session.template_bytes

    if filename and filename.strip():
        clean_name = filename.strip()
        if not clean_name.lower().endswith(".docx"):
            clean_name = f"{clean_name}.docx"
    else:
        clean_name = session.template_filename if session.template_filename.lower().startswith("scrutiny_") else f"Scrutiny_Report_{session.template_filename}"
        if not clean_name.lower().endswith(".docx"):
            clean_name = f"{clean_name}.docx"

    return Response(
        content=target_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{clean_name}"'}
    )


@router.post("/sessions/{session_id}/use-as-next-template", response_model=TemplateUploadResponse)
async def use_as_next_template(
    session_id: str,
    payload: Optional[UseAsNextTemplateRequest] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Takes the generated .docx report from the current QA session and dynamically
    provisions a new Template QA session where this document acts as the new template.
    """
    res = await db.execute(select(TemplateQASession).where(TemplateQASession.id == session_id))
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Current session not found")

    target_bytes = session.final_docx_bytes
    if not target_bytes:
        if session.template_bytes and session.answers_json:
            answers = [QuestionAnswer(**a) for a in json.loads(session.answers_json)]
            target_bytes = generate_qa_report(session.template_bytes, answers)
            session.final_docx_bytes = target_bytes
            session.status = "report_generated"
            await db.commit()
        elif session.template_bytes:
            target_bytes = session.template_bytes
        else:
            raise HTTPException(status_code=400, detail="No template or generated document available to chain")

    base_name = session.template_filename.rsplit(".", 1)[0]
    if payload and payload.new_filename and payload.new_filename.strip():
        new_template_name = payload.new_filename.strip()
    else:
        new_template_name = f"Next_Template_{base_name}.docx"

    if not new_template_name.lower().endswith(".docx"):
        new_template_name = f"{new_template_name}.docx"

    new_questions = extract_template_questions(target_bytes, new_template_name)
    sections = list(dict.fromkeys(q.section for q in new_questions))

    new_session_id = str(uuid.uuid4())
    new_session = TemplateQASession(
        id=new_session_id,
        user_id=session.user_id,
        template_filename=new_template_name,
        template_bytes=target_bytes,
        questions_json=json.dumps([q.model_dump() for q in new_questions]),
        sources_json=session.sources_json if (payload and payload.keep_sources) else None,
        status="sources_uploaded" if (payload and payload.keep_sources and session.sources_json) else "template_parsed"
    )
    db.add(new_session)
    await db.commit()

    return TemplateUploadResponse(
        session_id=new_session_id,
        questions_count=len(new_questions),
        sections=sections,
        questions=new_questions
    )

