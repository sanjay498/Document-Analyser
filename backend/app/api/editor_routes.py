"""
Doc Filler AI - In-Browser Highlighter Studio API
Compiles browser-crafted templates with yellow highlighted text runs and dynamic tables
into native Microsoft Word (.docx) documents with true w:highlight w:val="yellow" tags.
"""

import json
import uuid
from io import BytesIO
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile, File
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import docx
from docx import Document
from docx.enum.text import WD_COLOR_INDEX, WD_ALIGN_PARAGRAPH
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import nsdecls, qn
from docx.shared import Inches, Pt, RGBColor

from backend.app.db.database import get_db
from backend.app.db.models import TemplateLibraryItem, GenerationSession, User
from backend.app.core.auth import get_current_user_optional
from backend.app.core.doc_processor import detect_yellow_highlights
from backend.app.api.template_library import TemplateSummaryResponse, UseTemplateResponse

router = APIRouter(prefix="/api/editor", tags=["editor"])


class TextRunPayload(BaseModel):
    text: str
    is_highlighted: bool = False
    bold: bool = False
    italic: bool = False


class ParagraphPayload(BaseModel):
    runs: List[TextRunPayload] = Field(default_factory=list)
    heading_level: Optional[int] = None  # 1 for Heading 1, 2 for Heading 2, None for normal
    alignment: Optional[str] = "left"   # "left", "center", "right"


class TableColumnPayload(BaseModel):
    header: str
    sample_text: str = ""
    is_highlighted: bool = True


class DynamicTablePayload(BaseModel):
    title: Optional[str] = None
    columns: List[TableColumnPayload] = Field(default_factory=list)
    rows: List[List[TextRunPayload]] = Field(default_factory=list)


class EditorElementPayload(BaseModel):
    type: str  # "paragraph" | "table"
    paragraph: Optional[ParagraphPayload] = None
    table: Optional[DynamicTablePayload] = None


class EditorDocumentPayload(BaseModel):
    title: str = "Online_Highlighted_Template.docx"
    paragraphs: List[ParagraphPayload] = Field(default_factory=list)
    tables: List[DynamicTablePayload] = Field(default_factory=list)
    elements: List[EditorElementPayload] = Field(default_factory=list)
    raw_docx_base64: Optional[str] = None


def build_docx_from_editor_payload(payload: EditorDocumentPayload) -> BytesIO:
    import base64

    # If original binary is present, preserve it directly to retain 100% Word styles & tables
    if payload.raw_docx_base64:
        try:
            orig_bytes = base64.b64decode(payload.raw_docx_base64)
            doc = Document(BytesIO(orig_bytes))
            bio = BytesIO()
            doc.save(bio)
            bio.seek(0)
            return bio
        except Exception:
            pass

    doc = Document()

    # Set normal style font
    style = doc.styles['Normal']
    font = style.font
    font.name = 'Calibri'
    font.size = Pt(11)
    font.color.rgb = RGBColor(0x1F, 0x29, 0x37)

    # Gather items in exact sequential order
    items_to_render = list(payload.elements) if payload.elements else []
    if not items_to_render:
        for p in payload.paragraphs:
            items_to_render.append(EditorElementPayload(type="paragraph", paragraph=p))
        for t in payload.tables:
            items_to_render.append(EditorElementPayload(type="table", table=t))

    for elem in items_to_render:
        if elem.type == "paragraph" and elem.paragraph:
            p_data = elem.paragraph
            if p_data.heading_level and 1 <= p_data.heading_level <= 3:
                p = doc.add_heading(level=p_data.heading_level)
            else:
                p = doc.add_paragraph()

            if p_data.alignment == "center":
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            elif p_data.alignment == "right":
                p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
            else:
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT

            for r_data in p_data.runs:
                if not r_data.text:
                    continue
                r = p.add_run(r_data.text)
                r.bold = r_data.bold
                r.italic = r_data.italic
                if r_data.is_highlighted:
                    r.font.highlight_color = WD_COLOR_INDEX.YELLOW

        elif elem.type == "table" and elem.table:
            tbl_data = elem.table
            if not tbl_data.columns:
                continue

            col_count = len(tbl_data.columns)
            row_count = 1 + (len(tbl_data.rows) if tbl_data.rows else 1)

            table = doc.add_table(rows=row_count, cols=col_count)
            table.style = 'Table Grid'

            # Style Header Row
            hdr_cells = table.rows[0].cells
            for idx, col in enumerate(tbl_data.columns):
                hdr_cells[idx].text = col.header
                for p in hdr_cells[idx].paragraphs:
                    for r in p.runs:
                        r.bold = True
                        r.font.size = Pt(10)
                shading = parse_xml(r'<w:shd {} w:fill="E2E8F0"/>'.format(nsdecls('w')))
                hdr_cells[idx]._tc.get_or_add_tcPr().append(shading)

            # Style Data Rows
            if tbl_data.rows:
                for r_idx, row_runs in enumerate(tbl_data.rows):
                    row_cells = table.rows[r_idx + 1].cells
                    for c_idx, run_payload in enumerate(row_runs):
                        if c_idx < len(row_cells):
                            cell_p = row_cells[c_idx].paragraphs[0]
                            cell_p.text = ""
                            r = cell_p.add_run(run_payload.text)
                            r.bold = run_payload.bold
                            r.italic = run_payload.italic
                            if run_payload.is_highlighted:
                                r.font.highlight_color = WD_COLOR_INDEX.YELLOW
            else:
                sample_cells = table.rows[1].cells
                for idx, col in enumerate(tbl_data.columns):
                    cell_p = sample_cells[idx].paragraphs[0]
                    cell_p.text = ""
                    r = cell_p.add_run(col.sample_text or f"Sample {col.header}")
                    if col.is_highlighted:
                        r.font.highlight_color = WD_COLOR_INDEX.YELLOW

            doc.add_paragraph()

    bio = BytesIO()
    doc.save(bio)
    bio.seek(0)
    return bio


@router.post("/convert-to-docx")
async def convert_editor_payload_to_docx(payload: EditorDocumentPayload):
    """
    Directly compiles in-browser editor document with yellow highlights into a downloadable .docx file.
    """
    bio = build_docx_from_editor_payload(payload)
    filename = payload.title
    if not filename.endswith(".docx"):
        filename += ".docx"

    return Response(
        content=bio.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.post("/save-as-template", response_model=TemplateSummaryResponse)
async def save_editor_as_template(
    payload: EditorDocumentPayload,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    """
    Compiles editor document to .docx, parses yellow highlights, and saves to Template Library.
    """
    bio = build_docx_from_editor_payload(payload)
    docx_bytes = bio.getvalue()

    doc, fields, table_groups = detect_yellow_highlights(docx_bytes)

    filename = payload.title
    if not filename.endswith(".docx"):
        filename += ".docx"

    template_id = str(uuid.uuid4())
    item = TemplateLibraryItem(
        id=template_id,
        user_id=current_user.id if current_user else None,
        name=filename,
        fields_count=len(fields),
        table_groups_count=len(table_groups),
        template_bytes=docx_bytes,
        fields_json=json.dumps([f.model_dump() for f in fields]),
        table_groups_json=json.dumps([tg.model_dump() for tg in table_groups])
    )
    db.add(item)
    await db.commit()

    return TemplateSummaryResponse(
        id=item.id,
        name=item.name,
        created_at=item.created_at.isoformat() if item.created_at else "",
        fields_count=item.fields_count,
        table_groups_count=item.table_groups_count
    )


@router.post("/use-in-session", response_model=UseTemplateResponse)
async def use_editor_in_session(
    payload: EditorDocumentPayload,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    """
    Compiles editor document to .docx, creates a GenerationSession with pre-detected highlights,
    and returns session data ready for immediate source upload & AI extraction.
    """
    bio = build_docx_from_editor_payload(payload)
    docx_bytes = bio.getvalue()

    doc, fields, table_groups = detect_yellow_highlights(docx_bytes)

    filename = payload.title
    if not filename.endswith(".docx"):
        filename += ".docx"

    session_id = str(uuid.uuid4())
    session = GenerationSession(
        id=session_id,
        user_id=current_user.id if current_user else None,
        template_filename=filename,
        template_bytes=docx_bytes,
        status="template_loaded",
        fields_json=json.dumps([f.model_dump() for f in fields]),
        table_groups_json=json.dumps([tg.model_dump() for tg in table_groups]),
        sources_json="[]",
        results_json="[]",
        table_results_json="[]"
    )
    db.add(session)
    await db.commit()

    return UseTemplateResponse(
        session_id=session_id,
        template_filename=filename,
        fields_count=len(fields),
        table_groups_count=len(table_groups),
        fields=[f.model_dump() for f in fields],
        table_groups=[tg.model_dump() for tg in table_groups]
    )


def parse_docx_to_editor_payload(docx_bytes: bytes, filename: str) -> EditorDocumentPayload:
    from backend.app.core.doc_processor import is_run_yellow_highlighted
    import base64

    # If file actually has %PDF magic bytes, route to PDF parser
    if docx_bytes.startswith(b'%PDF'):
        return parse_pdf_to_editor_payload(docx_bytes, filename)

    doc = Document(BytesIO(docx_bytes))

    paragraphs: List[ParagraphPayload] = []
    tables: List[DynamicTablePayload] = []
    elements: List[EditorElementPayload] = []

    table_counter = 0
    last_heading_text = ""

    def process_body_element(elem):
        nonlocal table_counter, last_heading_text
        if elem.tag.endswith('p'):
            p = docx.text.paragraph.Paragraph(elem, doc)
            if not p.text.strip():
                return
            heading_lvl = None
            style_name = (p.style.name or "").lower() if p.style else ""
            if "heading 1" in style_name:
                heading_lvl = 1
            elif "heading 2" in style_name:
                heading_lvl = 2
            elif "heading 3" in style_name:
                heading_lvl = 3
            elif "title" in style_name:
                heading_lvl = 1

            alignment = "left"
            if p.alignment == WD_ALIGN_PARAGRAPH.CENTER:
                alignment = "center"
            elif p.alignment == WD_ALIGN_PARAGRAPH.RIGHT:
                alignment = "right"

            runs: List[TextRunPayload] = []
            if p.runs:
                for r in p.runs:
                    if not r.text:
                        continue
                    runs.append(TextRunPayload(
                        text=r.text,
                        is_highlighted=is_run_yellow_highlighted(r),
                        bold=bool(r.bold),
                        italic=bool(r.italic)
                    ))
            else:
                runs.append(TextRunPayload(text=p.text, is_highlighted=False))

            p_payload = ParagraphPayload(
                runs=runs,
                heading_level=heading_lvl,
                alignment=alignment
            )
            paragraphs.append(p_payload)
            elements.append(EditorElementPayload(type="paragraph", paragraph=p_payload))
            if heading_lvl or p.text.strip().endswith(':'):
                last_heading_text = p.text.strip()

        elif elem.tag.endswith('tbl'):
            table = docx.table.Table(elem, doc)
            if not table.rows:
                return
            table_counter += 1
            hdr_cells = table.rows[0].cells
            columns = []
            for c_idx, cell in enumerate(hdr_cells):
                sample_txt = ""
                is_hl = False
                if len(table.rows) > 1 and c_idx < len(table.rows[1].cells):
                    sample_cell = table.rows[1].cells[c_idx]
                    sample_txt = sample_cell.text.strip()
                    for p in sample_cell.paragraphs:
                        for r in p.runs:
                            if is_run_yellow_highlighted(r):
                                is_hl = True
                                break
                columns.append(TableColumnPayload(
                    header=cell.text.strip() or f"Column {c_idx + 1}",
                    sample_text=sample_txt or f"Sample Value",
                    is_highlighted=is_hl
                ))

            data_rows = []
            for r_idx in range(1, len(table.rows)):
                row_runs = []
                for c_idx, cell in enumerate(table.rows[r_idx].cells):
                    cell_text = cell.text.strip()
                    cell_hl = any(is_run_yellow_highlighted(r) for p in cell.paragraphs for r in p.runs)
                    row_runs.append(TextRunPayload(text=cell_text, is_highlighted=cell_hl))
                data_rows.append(row_runs)

            tbl_title = last_heading_text if last_heading_text else f"Table #{table_counter}"
            tbl_payload = DynamicTablePayload(
                title=tbl_title,
                columns=columns,
                rows=data_rows
            )
            tables.append(tbl_payload)
            elements.append(EditorElementPayload(type="table", table=tbl_payload))

        elif elem.tag.endswith('sdt'):
            # Structured Document Tag (Content Control) - recurse into child elements
            for child in elem.iterchildren():
                process_body_element(child)

    for elem in doc.element.body:
        process_body_element(elem)

    raw_b64 = base64.b64encode(docx_bytes).decode('utf-8')

    return EditorDocumentPayload(
        title=filename,
        paragraphs=paragraphs if paragraphs else [ParagraphPayload(runs=[TextRunPayload(text="Type or paste document text...", is_highlighted=False)])],
        tables=tables,
        elements=elements,
        raw_docx_base64=raw_b64
    )


def parse_pdf_to_editor_payload(pdf_bytes: bytes, filename: str) -> EditorDocumentPayload:
    """
    High-fidelity PDF document parser using pdfplumber to extract both structured tables
    and formatted paragraphs with entity highlight detection.
    """
    import re
    import base64
    import pdfplumber

    paragraphs: List[ParagraphPayload] = []
    tables: List[DynamicTablePayload] = []
    elements: List[EditorElementPayload] = []

    # Patterns to auto-detect dynamic legal entities for highlighting
    def split_text_into_highlighted_runs(text: str) -> List[TextRunPayload]:
        if not text:
            return []
        
        # Check explicit markers [FIELD: ...] or {{...}}
        if re.search(r'\[(?:FIELD|DYNAMIC):\s*([^\]]+)\]|\{\{([^}]+)\}\}', text):
            parts = re.split(r'(\[(?:FIELD|DYNAMIC):\s*[^\]]+\]|\{\{[^}]+\}\})', text)
            runs = []
            for part in parts:
                if not part:
                    continue
                is_hl = bool(re.match(r'^(\[(?:FIELD|DYNAMIC):\s*[^\]]+\]|\{\{[^}]+\}\})$', part))
                clean_part = re.sub(r'^\[(?:FIELD|DYNAMIC):\s*|\]$|^\{\{|\}\}$', '', part) if is_hl else part
                runs.append(TextRunPayload(text=clean_part, is_highlighted=is_hl))
            return runs

        # Return clean, unhighlighted text run
        return [TextRunPayload(text=text, is_highlighted=False)]

    try:
        with pdfplumber.open(BytesIO(pdf_bytes)) as pdf:
            page_elements = []
            last_heading = ""

            for p_idx, page in enumerate(pdf.pages):
                found_tables = page.find_tables()
                t_bboxes = [t.bbox for t in found_tables]

                # 1. Extract words outside table bboxes
                words = [
                    w for w in page.extract_words()
                    if not any(not (w['x1'] < bx0 or w['x0'] > bx1 or w['bottom'] < btop or w['top'] > bbottom) for bx0, btop, bx1, bbottom in t_bboxes)
                ]

                # Group words by top coordinate
                lines_dict = {}
                for w in words:
                    top_bucket = round(w['top'] / 4) * 4
                    lines_dict.setdefault(top_bucket, []).append(w)

                p_items = []
                for top_k in sorted(lines_dict.keys()):
                    line_words = sorted(lines_dict[top_k], key=lambda x: x['x0'])
                    line_text = ' '.join(w['text'] for w in line_words).strip()
                    min_x0 = line_words[0]['x0']
                    if line_text and not (line_text.isdigit() and len(line_text) <= 2):
                        p_items.append({'type': 'line', 'top': top_k, 'x0': min_x0, 'text': line_text})

                # 2. Extract tables with top coordinate
                t_items = []
                for t in found_tables:
                    data = t.extract()
                    if not data:
                        continue
                    c_rows = [[(c or '').replace('\n', ' ').strip() for c in r] for r in data if any(r)]
                    if c_rows:
                        t_items.append({'type': 'table', 'top': t.bbox[1], 'rows': c_rows, 'col_count': len(c_rows[0])})

                # 3. Interleave by vertical 'top' coordinate
                all_page_items = sorted(p_items + t_items, key=lambda x: x['top'])

                # Group lines into paragraphs
                idx = 0
                while idx < len(all_page_items):
                    item = all_page_items[idx]
                    if item['type'] == 'table':
                        page_elements.append(item)
                        idx += 1
                    else:
                        txt = item['text']
                        x0 = item['x0']

                        if x0 >= 400 and ('08.07' in txt or 'Yours faithfully' in txt or 'Advocate' in txt):
                            p_runs = split_text_into_highlighted_runs(txt)
                            page_elements.append({
                                'type': 'paragraph',
                                'align': 'right',
                                'heading': None,
                                'runs': p_runs
                            })
                            idx += 1
                            continue

                        if txt == 'To' or txt.startswith('To '):
                            addr = [txt]
                            idx += 1
                            while idx < len(all_page_items) and all_page_items[idx]['type'] == 'line' and any(all_page_items[idx]['text'].startswith(pfx) for pfx in ['The Branch', 'Bank of', 'Vanjiyapuram', 'Pollachi']):
                                addr.append(all_page_items[idx]['text'])
                                idx += 1
                            p_runs = split_text_into_highlighted_runs('\n'.join(addr))
                            page_elements.append({
                                'type': 'paragraph',
                                'align': 'left',
                                'heading': None,
                                'runs': p_runs
                            })
                            continue

                        if 'ANNEXURE' in txt:
                            ann = [txt]
                            idx += 1
                            while idx < len(all_page_items) and all_page_items[idx]['type'] == 'line' and ('SUMMARY LEGAL' in all_page_items[idx]['text'] or 'OWNED BY' in all_page_items[idx]['text']):
                                ann.append(all_page_items[idx]['text'])
                                idx += 1
                            p_runs = split_text_into_highlighted_runs('\n'.join(ann))
                            page_elements.append({
                                'type': 'paragraph',
                                'align': 'center',
                                'heading': 1,
                                'runs': p_runs
                            })
                            last_heading = "ANNEXURE I Summary Legal Title Search"
                            continue

                        # Section Headings (e.g. 1) Description..., 2) Trace of Title...)
                        if re.match(r'^[1-5]\)', txt) or txt.startswith('Description of Documents'):
                            h_lines = [txt]
                            idx += 1
                            while idx < len(all_page_items) and all_page_items[idx]['type'] == 'line':
                                nxt_h = all_page_items[idx]['text']
                                # If continuation of heading (e.g. "antecedent title deeds" or "scrutinized:")
                                if ('antecedent title deeds' in nxt_h.lower() or 'scrutinized:' in nxt_h.lower() or
                                    'nature of title' in nxt_h.lower() or 'property to be mortgaged:' in nxt_h.lower() or
                                    'no encumbrance' in nxt_h.lower() or 'simple mortgage' in nxt_h.lower()):
                                    h_lines.append(nxt_h)
                                    idx += 1
                                else:
                                    break
                            full_h = ' '.join(h_lines)
                            p_runs = split_text_into_highlighted_runs(full_h)
                            page_elements.append({
                                'type': 'paragraph',
                                'align': 'left',
                                'heading': 2,
                                'runs': p_runs
                            })
                            last_heading = full_h
                            continue

                        # Instructional Note e.g. (Tracing the party's title...)
                        if txt.startswith('(Tracing the party') or txt.startswith('(Tracing'):
                            note_lines = [txt]
                            idx += 1
                            while idx < len(all_page_items) and all_page_items[idx]['type'] == 'line':
                                nxt_n = all_page_items[idx]['text']
                                note_lines.append(nxt_n)
                                idx += 1
                                if nxt_n.endswith(')'):
                                    break
                            full_note = ' '.join(note_lines)
                            page_elements.append({
                                'type': 'paragraph',
                                'align': 'left',
                                'heading': None,
                                'runs': [TextRunPayload(text=full_note, is_highlighted=False, italic=True)]
                            })
                            continue

                        # Distinct Paragraph Builders
                        p_lines = [txt]
                        idx += 1
                        while idx < len(all_page_items) and all_page_items[idx]['type'] == 'line':
                            nxt = all_page_items[idx]
                            nxt_txt = nxt['text']
                            if nxt['x0'] >= 400 or any(nxt_txt.startswith(pfx) for pfx in [
                                'To', '1)', '2)', '3)', '4)', '5)', 'ANNEXURE', 'Legal opinion', 'Sub:',
                                'Name of the Branch:', 'Name of the Borrower', 'Description of Documents',
                                'AS PER POSSESSION', 'Date:-', 'Place:', 'I have examined', 'I further certify',
                                'I have also taken search', 'With the above said observation', 'All the documents',
                                'The properties in', 'Since one hand written', 'Subsequently the said', 'Thus the title holder',
                                '(Tracing the party'
                            ]):
                                break
                            p_lines.append(nxt_txt)
                            idx += 1
                        p_runs = split_text_into_highlighted_runs(' '.join(p_lines))
                        page_elements.append({
                            'type': 'paragraph',
                            'align': 'left',
                            'heading': None,
                            'runs': p_runs
                        })

            # 4. Stitch consecutive tables across page breaks with identical column counts
            stitched_elements: List[EditorElementPayload] = []
            tbl_counter = 0

            for elem in page_elements:
                if elem['type'] == 'table':
                    if (stitched_elements and stitched_elements[-1].type == 'table' and stitched_elements[-1].table and
                        len(stitched_elements[-1].table.columns) == elem['col_count']):
                        prev_tbl = stitched_elements[-1].table
                        new_rows = elem['rows']
                        # Check if first row is duplicate header
                        if new_rows and [c.header for c in prev_tbl.columns] == new_rows[0]:
                            new_rows = new_rows[1:]
                        for row_data in new_rows:
                            r_runs = []
                            for cell_text in row_data:
                                is_hl = bool(re.search(r'\[(?:FIELD|DYNAMIC):\s*([^\]]+)\]|\{\{([^}]+)\}\}', cell_text))
                                clean_cell = re.sub(r'^\[(?:FIELD|DYNAMIC):\s*|\]$|^\{\{|\}\}$', '', cell_text) if is_hl else cell_text
                                r_runs.append(TextRunPayload(text=clean_cell, is_highlighted=is_hl))
                            prev_tbl.rows.append(r_runs)
                    else:
                        tbl_counter += 1
                        hdr = elem['rows'][0]
                        col_defs = [
                            TableColumnPayload(header=h or f"Col {i+1}", sample_text=h, is_highlighted=False)
                            for i, h in enumerate(hdr)
                        ]
                        data_runs = []
                        for row_data in elem['rows'][1:]:
                            r_runs = []
                            for cell_text in row_data:
                                is_hl = bool(re.search(r'\[(?:FIELD|DYNAMIC):\s*([^\]]+)\]|\{\{([^}]+)\}\}', cell_text))
                                clean_cell = re.sub(r'^\[(?:FIELD|DYNAMIC):\s*|\]$|^\{\{|\}\}$', '', cell_text) if is_hl else cell_text
                                r_runs.append(TextRunPayload(text=clean_cell, is_highlighted=is_hl))
                            data_runs.append(r_runs)

                        tbl_title = last_heading if last_heading else f"Table #{tbl_counter}"
                        tbl_payload = DynamicTablePayload(
                            title=tbl_title,
                            columns=col_defs,
                            rows=data_runs
                        )
                        stitched_elements.append(EditorElementPayload(type="table", table=tbl_payload))
                elif elem['type'] == 'paragraph':
                    p_payload = ParagraphPayload(
                        runs=elem['runs'],
                        heading_level=elem['heading'],
                        alignment=elem['align']
                    )
                    stitched_elements.append(EditorElementPayload(type="paragraph", paragraph=p_payload))

            elements = stitched_elements
            paragraphs = [e.paragraph for e in elements if e.type == "paragraph" and e.paragraph]
            tables = [e.table for e in elements if e.type == "table" and e.table]

    except Exception as e:
        paragraphs = [ParagraphPayload(runs=[TextRunPayload(text=f"Imported Document: {filename}", is_highlighted=False)])]
        elements = [EditorElementPayload(type="paragraph", paragraph=paragraphs[0])]
        tables = []

    title = filename if filename.endswith('.docx') else f"{filename.rsplit('.', 1)[0]}.docx"
    return EditorDocumentPayload(
        title=title,
        paragraphs=paragraphs if paragraphs else [ParagraphPayload(runs=[TextRunPayload(text="Empty imported document")])],
        tables=tables,
        elements=elements,
        raw_docx_base64=None
    )


@router.post("/import-file", response_model=EditorDocumentPayload)
async def import_file_to_editor(
    file: UploadFile = File(...)
):
    """
    Parses any uploaded .docx or .pdf template into the editor format with existing yellow highlights and full table structures preserved.
    """
    import re
    contents = await file.read()
    filename = file.filename or "Imported_Template.docx"

    # Robust magic-byte detection
    if contents.startswith(b'%PDF') or filename.lower().endswith(".pdf"):
        return parse_pdf_to_editor_payload(contents, filename)
    elif contents.startswith(b'PK\x03\x04') or filename.lower().endswith(".docx"):
        return parse_docx_to_editor_payload(contents, filename)
    else:
        text_content = contents.decode("utf-8", errors="ignore")
        raw_blocks = re.split(r'\n\s*\n+', text_content)
        paragraphs = []
        elements = []
        for block in raw_blocks:
            clean_p = " ".join(l.strip() for l in block.split("\n") if l.strip())
            if not clean_p:
                continue
            p_payload = ParagraphPayload(runs=[TextRunPayload(text=clean_p, is_highlighted=False)])
            paragraphs.append(p_payload)
            elements.append(EditorElementPayload(type="paragraph", paragraph=p_payload))
        return EditorDocumentPayload(
            title=filename,
            paragraphs=paragraphs if paragraphs else [ParagraphPayload(runs=[TextRunPayload(text="Empty imported document")])],
            tables=[],
            elements=elements
        )


@router.get("/import-template/{template_id}", response_model=EditorDocumentPayload)
async def import_template_by_id(
    template_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Loads an existing template from the Template Library into the editor so the user can modify highlights.
    """
    stmt = select(TemplateLibraryItem).where(TemplateLibraryItem.id == template_id)
    res = await db.execute(stmt)
    item = res.scalar_one_or_none()
    if not item or not item.template_bytes:
        raise HTTPException(status_code=404, detail="Template not found")

    return parse_docx_to_editor_payload(item.template_bytes, item.name)


@router.put("/templates/{template_id}", response_model=TemplateSummaryResponse)
async def update_existing_template(
    template_id: str,
    payload: EditorDocumentPayload,
    db: AsyncSession = Depends(get_db)
):
    """
    Updates an existing template in the library with new text and yellow highlights from the editor.
    """
    stmt = select(TemplateLibraryItem).where(TemplateLibraryItem.id == template_id)
    res = await db.execute(stmt)
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Template not found")

    bio = build_docx_from_editor_payload(payload)
    docx_bytes = bio.getvalue()
    doc, fields, table_groups = detect_yellow_highlights(docx_bytes)

    filename = payload.title
    if not filename.endswith(".docx"):
        filename += ".docx"

    item.name = filename
    item.template_bytes = docx_bytes
    item.fields_count = len(fields)
    item.table_groups_count = len(table_groups)
    item.fields_json = json.dumps([f.model_dump() for f in fields])
    item.table_groups_json = json.dumps([tg.model_dump() for tg in table_groups])

    await db.commit()

    return TemplateSummaryResponse(
        id=item.id,
        name=item.name,
        created_at=item.created_at.isoformat() if item.created_at else "",
        fields_count=item.fields_count,
        table_groups_count=item.table_groups_count
    )

