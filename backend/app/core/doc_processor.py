"""
Doc Filler AI - Core Document Processor (Phase 2)
Handles detection of yellow-highlighted runs in .docx templates across both
body paragraphs and table cells, with column header and row context extraction.
Provides isolated, high-fidelity dynamic row duplication with cell style cloning.
"""

import re
from copy import deepcopy
from io import BytesIO
from typing import List, Dict, Any, Optional, Union, Tuple
from pydantic import BaseModel, Field
import docx
from docx import Document
from docx.enum.text import WD_COLOR_INDEX
from docx.oxml import OxmlElement
from docx.oxml.ns import qn, nsdecls
from docx.shared import Pt, RGBColor
from docx.table import _Row, Table

try:
    import pptx
    from pptx import Presentation
    from pptx.oxml.ns import qn as pptx_qn
except ImportError:
    pptx = None

try:
    import pypdf
except ImportError:
    pypdf = None


class FieldLocation(BaseModel):
    location_type: str = "paragraph"  # "paragraph" | "table_cell" | "pptx_shape" | "pdf_form_field"
    paragraph_index: int = 0
    table_index: Optional[int] = None
    row_index: Optional[int] = None
    col_index: Optional[int] = None
    cell_paragraph_index: Optional[int] = None
    run_indices: List[int] = Field(default_factory=list)
    slide_index: Optional[int] = None
    shape_index: Optional[int] = None
    pdf_field_name: Optional[str] = None


class FieldFormatting(BaseModel):
    font_name: Optional[str] = None
    font_size_pt: Optional[float] = None
    bold: Optional[bool] = None
    italic: Optional[bool] = None
    underline: Optional[bool] = None
    color_rgb: Optional[str] = None


class HighlightedField(BaseModel):
    field_id: str
    original_text: str
    paragraph_context: str
    context_with_marker: str
    location: FieldLocation
    formatting: FieldFormatting
    # Phase 2 Table context additions
    is_table_cell: bool = False
    column_header: Optional[str] = None
    row_context: Optional[str] = None
    table_group_id: Optional[str] = None


class TableColumnDef(BaseModel):
    col_index: int
    header: str
    field_id: Optional[str] = None
    sample_text: str = ""


class DynamicTableGroup(BaseModel):
    group_id: str
    table_index: int
    template_row_index: int
    columns: List[TableColumnDef]
    template_row_context: str


def is_run_yellow_highlighted(run) -> bool:
    """
    Checks if a docx Run has a yellow highlight via python-docx enum or raw XML.
    """
    # 1. Check python-docx enum
    try:
        if run.font.highlight_color in (WD_COLOR_INDEX.YELLOW, 7, "YELLOW"):
            return True
    except Exception:
        pass

    # 2. Check underlying XML element <w:highlight w:val="yellow"/>
    try:
        r_elem = run._r
        rPr = r_elem.find(qn('w:rPr'))
        if rPr is not None:
            highlight = rPr.find(qn('w:highlight'))
            if highlight is not None:
                val = highlight.get(qn('w:val'))
                if val and str(val).lower() == 'yellow':
                    return True
    except Exception:
        pass

    return False


def clear_run_highlight(run):
    """
    Removes highlight formatting from a run cleanly both in python-docx and XML.
    """
    try:
        run.font.highlight_color = None
    except Exception:
        pass

    try:
        r_elem = run._r
        rPr = r_elem.find(qn('w:rPr'))
        if rPr is not None:
            highlight = rPr.find(qn('w:highlight'))
            if highlight is not None:
                rPr.remove(highlight)
    except Exception:
        pass


def clear_paragraph_highlights(paragraph):
    """
    Clears all yellow highlights in a paragraph's runs (preserving non-yellow highlights like green/blue).
    """
    for run in paragraph.runs:
        if is_run_yellow_highlighted(run):
            clear_run_highlight(run)


def extract_run_formatting(run) -> FieldFormatting:
    """
    Extracts font, size, bold, italic, color from a run.
    """
    font_name = run.font.name
    font_size_pt = run.font.size.pt if run.font.size is not None else None
    bold = run.bold
    italic = run.italic
    underline = run.underline
    color_rgb = None
    if run.font.color and run.font.color.rgb:
        color_rgb = f"#{run.font.color.rgb}"

    return FieldFormatting(
        font_name=font_name,
        font_size_pt=font_size_pt,
        bold=bold,
        italic=italic,
        underline=underline,
        color_rgb=color_rgb
    )


def _process_paragraph_runs(
    paragraph,
    location_builder_func,
    prefix_id: str,
    is_table_cell: bool = False,
    column_header: Optional[str] = None,
    row_context: Optional[str] = None,
    table_group_id: Optional[str] = None
) -> List[HighlightedField]:
    """
    Scans a single paragraph's runs and groups contiguous yellow runs into HighlightedFields.
    """
    fields: List[HighlightedField] = []
    runs = paragraph.runs
    if not runs:
        return fields

    full_p_text = paragraph.text
    if not full_p_text.strip():
        return fields

    current_span: List[int] = []

    def commit_span(span: List[int]):
        if not span:
            return
        combined_text = "".join(runs[i].text for i in span)
        if not combined_text.strip():
            return

        start_run = span[0]
        end_run = span[-1]
        field_id = f"{prefix_id}_r{start_run}_{end_run}"

        # Build context with dynamic field marker
        marked_runs = []
        for i, r in enumerate(runs):
            if i == start_run:
                marked_runs.append(f"[FIELD: {combined_text}]")
            elif i in span:
                continue
            else:
                marked_runs.append(r.text)
        context_with_marker = "".join(marked_runs)

        # Augment context with table & column header info if inside a table
        if is_table_cell and column_header:
            context_with_marker = f"[Column: '{column_header}'] {context_with_marker}"

        formatting = extract_run_formatting(runs[start_run])
        location = location_builder_func(span)

        fields.append(HighlightedField(
            field_id=field_id,
            original_text=combined_text,
            paragraph_context=full_p_text,
            context_with_marker=context_with_marker,
            location=location,
            formatting=formatting,
            is_table_cell=is_table_cell,
            column_header=column_header,
            row_context=row_context,
            table_group_id=table_group_id
        ))

    for idx, run in enumerate(runs):
        if is_run_yellow_highlighted(run):
            current_span.append(idx)
        else:
            if current_span:
                commit_span(current_span)
                current_span = []

    if current_span:
        commit_span(current_span)

    return fields


def _convert_pdf_bytes_to_docx(pdf_bytes: bytes) -> Document:
    import pdfplumber
    doc = Document()
    with pdfplumber.open(BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            tables = page.find_tables()
            table_bboxes = [t.bbox for t in tables]

            def not_in_tables(obj):
                x0, top, x1, bottom = obj.get('x0', 0), obj.get('top', 0), obj.get('x1', 0), obj.get('bottom', 0)
                for bx0, btop, bx1, bbottom in table_bboxes:
                    if not (x1 < bx0 or x0 > bx1 or bottom < btop or top > bbottom):
                        return False
                return True

            filtered_page = page.filter(not_in_tables)
            raw_text = filtered_page.extract_text() or ''
            for line in raw_text.split('\n'):
                l = line.strip()
                if not l or (l.isdigit() and len(l) <= 2):
                    continue
                p = doc.add_paragraph()
                if 'ANNEXURE' in l:
                  p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                  r = p.add_run(l)
                  r.bold = True
                elif l.startswith(('08.07', 'Place:', 'Date:')):
                  p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
                  p.add_run(l)
                else:
                  p.add_run(l)

            for t in tables:
                data = t.extract()
                if not data:
                    continue
                rows = [[(c or '').replace('\n', ' ').strip() for c in r] for r in data if any(r)]
                if not rows:
                    continue
                docx_tbl = doc.add_table(rows=len(rows), cols=len(rows[0]))
                docx_tbl.style = 'Table Grid'
                for r_i, r in enumerate(rows):
                    for c_i, val in enumerate(r):
                        if c_i < len(docx_tbl.rows[r_i].cells):
                            docx_tbl.rows[r_i].cells[c_i].text = val
    return doc


def detect_yellow_highlights(
    docx_source: Union[str, bytes, BytesIO]
) -> Tuple[Document, List[HighlightedField], List[DynamicTableGroup]]:
    """
    Parses a .docx document and detects every run / span of text with yellow highlighting
    in body paragraphs and table cells.
    Also detects repeating dynamic table rows.
    Returns (Document, fields_list, dynamic_table_groups_list).
    """
    if isinstance(docx_source, bytes):
        if docx_source.startswith(b'%PDF'):
            doc = _convert_pdf_bytes_to_docx(docx_source)
        else:
            doc = Document(BytesIO(docx_source))
    elif isinstance(docx_source, BytesIO):
        b_val = docx_source.getvalue()
        if b_val.startswith(b'%PDF'):
            doc = _convert_pdf_bytes_to_docx(b_val)
        else:
            doc = Document(docx_source)
    elif isinstance(docx_source, str):
        with open(docx_source, "rb") as f:
            b_val = f.read()
        if b_val.startswith(b'%PDF') or docx_source.lower().endswith(".pdf"):
            doc = _convert_pdf_bytes_to_docx(b_val)
        else:
            doc = Document(docx_source)
    else:
        raise ValueError("Unsupported docx_source type")

    fields: List[HighlightedField] = []
    table_groups: List[DynamicTableGroup] = []

    # 1. Top-level document paragraphs
    for p_idx, paragraph in enumerate(doc.paragraphs):
        def make_loc(span, p_i=p_idx):
            return FieldLocation(
                location_type="paragraph",
                paragraph_index=p_i,
                run_indices=list(span)
            )

        found = _process_paragraph_runs(
            paragraph=paragraph,
            location_builder_func=make_loc,
            prefix_id=f"p{p_idx}",
            is_table_cell=False
        )
        fields.extend(found)

    # 2. Table cells scanning with Column Header and Row Context extraction
    for t_idx, table in enumerate(doc.tables):
        if not table.rows:
            continue

        # Extract headers from Row 0
        header_row = table.rows[0]
        col_headers = [cell.text.strip() for cell in header_row.cells]
        all_headers_str = " ".join(col_headers).lower()

        # Check if table is a fixed multi-row questionnaire or 2-column summary table
        is_fixed_questionnaire = (
            len(table.rows) > 3
            and any(k in all_headers_str for k in ["remark of counsel", "particulars", "compliance", "question", "details"])
        )
        is_fixed_summary = (
            len(table.columns) == 2
            and any(k in all_headers_str for k in ["s.f.no", "extent"])
        )

        is_repeating_table = (
            not is_fixed_questionnaire
            and not is_fixed_summary
        )

        table_group_registered = False

        # Scan each row
        for r_idx, row in enumerate(table.rows):
            # Assemble row context summary
            row_cells_summary = []
            for c_i, cell in enumerate(row.cells):
                hdr = col_headers[c_i] if c_i < len(col_headers) else f"Col {c_i}"
                row_cells_summary.append(f"[{hdr}: {cell.text.strip()}]")
            row_context_str = f"Table {t_idx + 1}, Row {r_idx + 1}: " + " | ".join(row_cells_summary)

            row_highlighted_fields = []
            group_id = f"table_{t_idx}_row_{r_idx}"

            for c_idx, cell in enumerate(row.cells):
                col_header = col_headers[c_idx] if c_idx < len(col_headers) else f"Column {c_idx}"
                for cp_idx, cell_p in enumerate(cell.paragraphs):
                    def make_cell_loc(span, t_i=t_idx, r_i=r_idx, c_i=c_idx, cp_i=cp_idx):
                        return FieldLocation(
                            location_type="table_cell",
                            paragraph_index=0,
                            table_index=t_i,
                            row_index=r_i,
                            col_index=c_i,
                            cell_paragraph_index=cp_i,
                            run_indices=list(span)
                        )

                    found = _process_paragraph_runs(
                        paragraph=cell_p,
                        location_builder_func=make_cell_loc,
                        prefix_id=f"t{t_idx}_r{r_idx}_c{c_idx}_p{cp_idx}",
                        is_table_cell=True,
                        column_header=col_header,
                        row_context=row_context_str,
                        table_group_id=group_id
                    )
                    row_highlighted_fields.extend(found)
                    fields.extend(found)

            # Register at most ONE dynamic table group per repeating table (at template row 1),
            # excluding fixed multi-row questionnaires and summaries
            if (
                r_idx == 1
                and is_repeating_table
                and not table_group_registered
                and len(row_highlighted_fields) >= 1
            ):
                table_group_registered = True
                cols_def = []
                for c_i, cell in enumerate(row.cells):
                    hdr = col_headers[c_i] if c_i < len(col_headers) else f"Column {c_i}"
                    # Find field in this cell if any
                    matching_field = next(
                        (f for f in row_highlighted_fields if f.location.col_index == c_i),
                        None
                    )
                    cols_def.append(TableColumnDef(
                        col_index=c_i,
                        header=hdr,
                        field_id=matching_field.field_id if matching_field else None,
                        sample_text=cell.text.strip()
                    ))

                table_groups.append(DynamicTableGroup(
                    group_id=group_id,
                    table_index=t_idx,
                    template_row_index=r_idx,
                    columns=cols_def,
                    template_row_context=row_context_str
                ))

    return doc, fields, table_groups


def duplicate_and_populate_table_rows(
    table: Table,
    template_row_index: int,
    records: List[Dict[str, Any]],
    clear_highlight: bool = True
) -> None:
    """
    Duplicates a table's template row N times (where N = len(records)) and populates values.
    Deep-clones the template row XML to preserve:
    - Cell borders
    - Cell shading/background colors (w:shd)
    - Column widths (w:tcW)
    - Cell vertical alignments (w:vAlign)
    - Text font styles, sizes, bold, italic, alignment.
    Removes yellow highlighting on all populated rows.
    """
    if template_row_index < 0 or template_row_index >= len(table.rows):
        raise IndexError(f"Template row index {template_row_index} out of range for table with {len(table.rows)} rows")

    if not records:
        # If 0 records provided, clear highlights on template row and return
        template_row = table.rows[template_row_index]
        if clear_highlight:
            for cell in template_row.cells:
                for p in cell.paragraphs:
                    clear_paragraph_highlights(p)
        return

    template_row = table.rows[template_row_index]
    template_tr = template_row._tr
    num_cols = len(template_row.cells)

    # Function to set cell text while preserving paragraph and run formatting
    def set_cell_value(cell, text_val: str):
        if not cell.paragraphs:
            p = cell.add_paragraph()
        else:
            p = cell.paragraphs[0]

        if p.runs:
            first_run = p.runs[0]
            first_run.text = str(text_val)
            if clear_highlight:
                clear_run_highlight(first_run)
            # Clear text in remaining runs of first paragraph
            for sub_run in p.runs[1:]:
                sub_run.text = ""
                if clear_highlight:
                    clear_run_highlight(sub_run)
        else:
            run = p.add_run(str(text_val))
            if clear_highlight:
                clear_run_highlight(run)

        # Clear any subsequent paragraphs in cell
        for extra_p in cell.paragraphs[1:]:
            for r in extra_p.runs:
                r.text = ""
                if clear_highlight:
                    clear_run_highlight(r)

    def populate_row(row_obj: _Row, record: Dict[str, Any]):
        for col_idx in range(num_cols):
            cell = row_obj.cells[col_idx]
            # Match by col index, column name, or header key
            val = None
            if str(col_idx) in record:
                val = record[str(col_idx)]
            elif f"col_{col_idx}" in record:
                val = record[f"col_{col_idx}"]
            else:
                # Check key matching
                for k, v in record.items():
                    if k.lower() in [f"col_{col_idx}", str(col_idx)]:
                        val = v
                        break
                    # Match column header if row 0 has header
                    if len(table.rows) > 0 and col_idx < len(table.rows[0].cells):
                        hdr_text = table.rows[0].cells[col_idx].text.strip()
                        if hdr_text and (k.lower() == hdr_text.lower() or hdr_text.lower() in k.lower()):
                            val = v
                            break

            if val is not None:
                set_cell_value(cell, str(val))
            else:
                # If no record value, retain existing or clear highlight
                if clear_highlight:
                    for p in cell.paragraphs:
                        clear_paragraph_highlights(p)

    # Remove any extra template sample rows after template_row_index
    # (e.g. if the template contained sample rows 2..N, we replace them with the dynamic records)
    has_footer = False
    if len(table.rows) > template_row_index + 1:
        last_cell_text = table.rows[-1].cells[0].text.strip().lower()
        if last_cell_text in ["total", "grand total", "subtotal"]:
            has_footer = True

    if has_footer:
        rows_to_remove = [r._tr for r in table.rows[template_row_index + 1:-1]]
    else:
        rows_to_remove = [r._tr for r in table.rows[template_row_index + 1:]]

    for tr in rows_to_remove:
        table._tbl.remove(tr)

    # 1. Populate Record 0 into the original template row
    populate_row(template_row, records[0])

    # 2. For records 1 .. N-1, deepcopy template_tr and insert consecutively after
    current_tr = template_tr
    for rec in records[1:]:
        new_tr = deepcopy(template_tr)
        current_tr.addnext(new_tr)
        new_row = _Row(new_tr, table)
        populate_row(new_row, rec)
        current_tr = new_tr


def apply_field_values_to_template(
    template_source: Union[str, bytes, BytesIO],
    fields: List[HighlightedField],
    field_values: Dict[str, Optional[str]],
    table_group_records: Optional[Dict[str, List[Dict[str, Any]]]] = None,
    clear_highlight: bool = True
) -> BytesIO:
    """
    Deterministically replaces highlighted spans in the template with provided field_values,
    and applies dynamic table row duplication for variable-length tables.
    - Preserves all original run formatting (font, size, bold, italic, color).
    - Preserves table cell styling, borders, and shading.
    - Removes yellow highlight if clear_highlight=True.
    - Leaves all non-highlighted runs and untouched paragraphs 100% identical.
    Returns a BytesIO containing the modified .docx file.
    """
    if isinstance(template_source, bytes):
        doc = Document(BytesIO(template_source))
    elif isinstance(template_source, (str, BytesIO)):
        doc = Document(template_source)
    else:
        raise ValueError("Unsupported template_source type")

    # Step A: Apply dynamic table row duplication if provided
    table_group_records = table_group_records or {}
    handled_table_cells = set()

    for group_id, records in table_group_records.items():
        if not records:
            continue
        # Parse table index and template row index from group_id (e.g. "table_0_row_1")
        try:
            parts = group_id.split("_")
            t_idx = int(parts[1])
            r_idx = int(parts[3])
            if 0 <= t_idx < len(doc.tables):
                table = doc.tables[t_idx]
                duplicate_and_populate_table_rows(
                    table=table,
                    template_row_index=r_idx,
                    records=records,
                    clear_highlight=clear_highlight
                )
                # Mark all fields belonging to this table as handled
                for f in fields:
                    if f.location.table_index == t_idx:
                        handled_table_cells.add(f.field_id)
        except Exception as e:
            print(f"Warning: Could not populate dynamic table group {group_id}: {str(e)}")

    # Step B: Apply individual field values
    field_map = {f.field_id: f for f in fields if f.field_id not in handled_table_cells}

    for field_id, field in field_map.items():
        val = field_values.get(field_id)
        # If value is explicitly provided (including empty string ""), use it; otherwise retain original text
        replacement_text = str(val) if val is not None else field.original_text

        loc = field.location
        target_paragraph = None

        if loc.location_type == "paragraph":
            if 0 <= loc.paragraph_index < len(doc.paragraphs):
                target_paragraph = doc.paragraphs[loc.paragraph_index]
        elif loc.location_type == "table_cell":
            if (
                loc.table_index is not None
                and loc.row_index is not None
                and loc.col_index is not None
                and loc.cell_paragraph_index is not None
                and 0 <= loc.table_index < len(doc.tables)
            ):
                table = doc.tables[loc.table_index]
                if 0 <= loc.row_index < len(table.rows):
                    row = table.rows[loc.row_index]
                    if 0 <= loc.col_index < len(row.cells):
                        cell = row.cells[loc.col_index]
                        if 0 <= loc.cell_paragraph_index < len(cell.paragraphs):
                            target_paragraph = cell.paragraphs[loc.cell_paragraph_index]

        if not target_paragraph:
            continue

        runs = target_paragraph.runs
        run_indices = loc.run_indices
        if not run_indices:
            continue

        first_run_idx = run_indices[0]
        if first_run_idx >= len(runs):
            continue

        # Set replacement text in first run
        first_run = runs[first_run_idx]
        first_run.text = replacement_text

        if clear_highlight:
            clear_run_highlight(first_run)

        # Clear text for any subsequent runs in the same span
        for subsequent_idx in run_indices[1:]:
            if subsequent_idx < len(runs):
                sub_run = runs[subsequent_idx]
                sub_run.text = ""
                if clear_highlight:
                    clear_run_highlight(sub_run)

    if clear_highlight:
        for p in doc.paragraphs:
            clear_paragraph_highlights(p)
        for tbl in doc.tables:
            for row in tbl.rows:
                for cell in row.cells:
                    for p in cell.paragraphs:
                        clear_paragraph_highlights(p)

    output = BytesIO()
    doc.save(output)
    output.seek(0)
    return output


def in_place_docx_xml_substitute(
    template_docx_bytes: bytes,
    field_replacements: Dict[str, str],
    clear_highlight: bool = True
) -> bytes:
    """
    Performs direct in-place XML substitution on the .docx ZIP container's `word/document.xml`.
    Guarantees the output is 100% byte-identical to the template outside of the substituted highlighted spans,
    preserving exact margins, fonts, character spacing, line heights, and table borders with zero drift.
    """
    import zipfile
    import io
    import re

    in_bio = io.BytesIO(template_docx_bytes)
    out_bio = io.BytesIO()

    with zipfile.ZipFile(in_bio, 'r') as zin, zipfile.ZipFile(out_bio, 'w', compression=zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            content = zin.read(item.filename)
            if item.filename == 'word/document.xml':
                xml_str = content.decode('utf-8')

                for orig_text, new_val in field_replacements.items():
                    if not orig_text or new_val is None:
                        continue
                    # Escape XML entities in replacement text
                    safe_val = new_val.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                    
                    # Direct text element replacement
                    xml_str = xml_str.replace(f">{orig_text}<", f">{safe_val}<")

                if clear_highlight:
                    xml_str = re.sub(r'<w:highlight\s+w:val=["\']yellow["\']\s*/>', '', xml_str)
                    xml_str = re.sub(r'<w:highlight\s+w:val=["\']yellow["\']\s*></w:highlight>', '', xml_str)

                content = xml_str.encode('utf-8')

            zout.writestr(item, content)

    out_bio.seek(0)
    return out_bio.getvalue()


# ---------------- ADVANCED FORMATS: PPTX & PDF FORM TEMPLATES ----------------

def is_pptx_run_highlighted(run) -> bool:
    """
    Checks if a python-pptx run has yellow highlight / text color / XML highlight.
    """
    try:
        if run.font.color and run.font.color.type == pptx.enum.dml.MSO_COLOR_TYPE.RGB:
            if run.font.color.rgb in (RGBColor(255, 255, 0), RGBColor(255, 255, 51)):
                return True
    except Exception:
        pass

    try:
        r_elem = run._r
        rPr = r_elem.find(pptx_qn('a:rPr'))
        if rPr is not None:
            highlight = rPr.find(pptx_qn('a:highlight'))
            if highlight is not None:
                return True
            solidFill = rPr.find(pptx_qn('a:solidFill'))
            if solidFill is not None:
                srgb = solidFill.find(pptx_qn('a:srgbClr'))
                if srgb is not None and srgb.get('val', '').upper() in ('FFFF00', 'FFFF33', 'FFFF66'):
                    return True
    except Exception:
        pass

    # Fallback to [FIELD: ...] text marker
    if "[field:" in run.text.lower() or "[dynamic" in run.text.lower():
        return True

    return False


def detect_pptx_highlights(
    file_bytes: bytes,
    filename: str = "template.pptx"
) -> Tuple[Any, List[HighlightedField], List[DynamicTableGroup]]:
    """
    Scans a .pptx presentation for yellow highlighted runs across all slides and shapes.
    """
    if pptx is None:
        raise ImportError("python-pptx library is required for PPTX templates.")

    prs = Presentation(BytesIO(file_bytes))
    fields: List[HighlightedField] = []
    table_groups: List[DynamicTableGroup] = []

    for s_idx, slide in enumerate(prs.slides):
        for sh_idx, shape in enumerate(slide.shapes):
            if not shape.has_text_frame:
                continue

            for p_idx, paragraph in enumerate(shape.text_frame.paragraphs):
                runs = paragraph.runs
                if not runs or not paragraph.text.strip():
                    continue

                full_p_text = paragraph.text
                current_span: List[int] = []

                def commit_pptx_span(span: List[int]):
                    if not span:
                        return
                    comb_text = "".join(runs[i].text for i in span)
                    if not comb_text.strip():
                        return
                    start_run = span[0]
                    end_run = span[-1]
                    field_id = f"slide{s_idx}_sh{sh_idx}_p{p_idx}_r{start_run}_{end_run}"

                    marked_runs = []
                    for i, r in enumerate(runs):
                        if i == start_run:
                            marked_runs.append(f"[FIELD: {comb_text}]")
                        elif i in span:
                            continue
                        else:
                            marked_runs.append(r.text)
                    ctx_marker = "".join(marked_runs)

                    font_name = runs[start_run].font.name
                    font_size = runs[start_run].font.size.pt if runs[start_run].font.size else None
                    bold = runs[start_run].font.bold
                    italic = runs[start_run].font.italic

                    fields.append(HighlightedField(
                        field_id=field_id,
                        original_text=comb_text,
                        paragraph_context=f"Slide {s_idx + 1}: {full_p_text}",
                        context_with_marker=f"[Slide {s_idx + 1}] {ctx_marker}",
                        location=FieldLocation(
                            location_type="pptx_shape",
                            slide_index=s_idx,
                            shape_index=sh_idx,
                            paragraph_index=p_idx,
                            run_indices=list(span)
                        ),
                        formatting=FieldFormatting(
                            font_name=font_name,
                            font_size_pt=font_size,
                            bold=bold,
                            italic=italic
                        ),
                        is_table_cell=False
                    ))

                for r_idx, run in enumerate(runs):
                    if is_pptx_run_highlighted(run):
                        current_span.append(r_idx)
                    else:
                        if current_span:
                            commit_pptx_span(current_span)
                            current_span = []
                if current_span:
                    commit_pptx_span(current_span)

    return prs, fields, table_groups


def apply_pptx_field_values(
    file_bytes: bytes,
    fields: List[HighlightedField],
    field_values: Dict[str, Optional[str]],
    clear_highlight: bool = True
) -> BytesIO:
    """
    Replaces highlighted runs in a PPTX template deterministically.
    """
    if pptx is None:
        raise ImportError("python-pptx library is required.")

    prs = Presentation(BytesIO(file_bytes))
    field_map = {f.field_id: f for f in fields}

    for field_id, field in field_map.items():
        val = field_values.get(field_id)
        replacement_text = val if (val is not None and val != "") else field.original_text

        loc = field.location
        if (
            loc.slide_index is not None
            and loc.shape_index is not None
            and 0 <= loc.slide_index < len(prs.slides)
        ):
            slide = prs.slides[loc.slide_index]
            if 0 <= loc.shape_index < len(slide.shapes):
                shape = slide.shapes[loc.shape_index]
                if shape.has_text_frame and 0 <= loc.paragraph_index < len(shape.text_frame.paragraphs):
                    p = shape.text_frame.paragraphs[loc.paragraph_index]
                    runs = p.runs
                    if loc.run_indices and loc.run_indices[0] < len(runs):
                        first_idx = loc.run_indices[0]
                        runs[first_idx].text = replacement_text
                        for sub_idx in loc.run_indices[1:]:
                            if sub_idx < len(runs):
                                runs[sub_idx].text = ""

    out = BytesIO()
    prs.save(out)
    out.seek(0)
    return out


def detect_pdf_template(
    file_bytes: bytes,
    filename: str = "template.pdf"
) -> Tuple[Any, List[HighlightedField], List[DynamicTableGroup]]:
    """
    Detects interactive form fields, highlight annotations, and [FIELD: ...]/{{...}} markers in a PDF template.
    """
    if pypdf is None:
        raise ImportError("pypdf is required for PDF templates.")

    reader = pypdf.PdfReader(BytesIO(file_bytes))
    fields: List[HighlightedField] = []
    table_groups: List[DynamicTableGroup] = []

    # 1. Check interactive form fields (AcroForms)
    fields_dict = reader.get_fields() or {}
    for idx, (field_name, field_info) in enumerate(fields_dict.items()):
        val_str = str(field_info.get('/V', '') or field_name)
        field_id = f"pdf_field_{field_name}"

        fields.append(HighlightedField(
            field_id=field_id,
            original_text=val_str if val_str else field_name,
            paragraph_context=f"PDF Form Field: {field_name}",
            context_with_marker=f"PDF Interactive Form: [FIELD: {field_name}]",
            location=FieldLocation(
                location_type="pdf_form_field",
                pdf_field_name=field_name,
                paragraph_index=idx
            ),
            formatting=FieldFormatting(),
            is_table_cell=False
        ))

    # 2. Check PDF Highlight Annotations (/Annots)
    for p_idx, page in enumerate(reader.pages):
        try:
            if "/Annots" in page and page["/Annots"]:
                annots = page["/Annots"]
                for a_idx, annot_ref in enumerate(annots):
                    annot = annot_ref.get_object() if hasattr(annot_ref, "get_object") else annot_ref
                    if annot.get("/Subtype") in ("/Highlight", "/Text", "/FreeText"):
                        annot_contents = str(annot.get("/Contents", "") or f"Highlight_{a_idx+1}")
                        field_id = f"pdf_annot_p{p_idx+1}_a{a_idx+1}"
                        fields.append(HighlightedField(
                            field_id=field_id,
                            original_text=annot_contents,
                            paragraph_context=f"Page {p_idx+1} PDF Highlight Annotation",
                            context_with_marker=f"[Page {p_idx+1}] [FIELD: {annot_contents}]",
                            location=FieldLocation(
                                location_type="pdf_annotation",
                                paragraph_index=p_idx
                            ),
                            formatting=FieldFormatting(),
                            is_table_cell=False
                        ))
        except Exception:
            pass

    # 3. Check for text pattern markers: [FIELD: ...], [dynamic: ...], {{...}}, etc.
    if not fields:
        for p_idx, page in enumerate(reader.pages):
            try:
                page_text = page.extract_text() or ""
                matches = re.finditer(r'\[(?:FIELD|DYNAMIC):\s*([^\]]+)\]|\{\{([^}]+)\}\}', page_text)
                for m_idx, match in enumerate(matches):
                    val = match.group(1) or match.group(2)
                    field_id = f"pdf_txt_p{p_idx+1}_m{m_idx+1}"
                    fields.append(HighlightedField(
                        field_id=field_id,
                        original_text=val.strip(),
                        paragraph_context=f"Page {p_idx+1}: {page_text[:100]}...",
                        context_with_marker=f"[Page {p_idx+1}] [FIELD: {val.strip()}]",
                        location=FieldLocation(
                            location_type="pdf_text_marker",
                            paragraph_index=p_idx
                        ),
                        formatting=FieldFormatting(),
                        is_table_cell=False
                    ))
            except Exception:
                pass

    return reader, fields, table_groups


def detect_pdf_form_fields(
    file_bytes: bytes,
    filename: str = "form_template.pdf"
) -> Tuple[Any, List[HighlightedField], List[DynamicTableGroup]]:
    return detect_pdf_template(file_bytes, filename)


def apply_pdf_form_values(
    file_bytes: bytes,
    fields: List[HighlightedField],
    field_values: Dict[str, Optional[str]]
) -> BytesIO:
    """
    Fills interactive PDF form fields with resolved values.
    """
    if pypdf is None:
        raise ImportError("pypdf is required.")

    reader = pypdf.PdfReader(BytesIO(file_bytes))
    writer = pypdf.PdfWriter()
    writer.append(reader)

    form_dict = {}
    for f in fields:
        val = field_values.get(f.field_id)
        if val is not None:
            raw_key = f.location.pdf_field_name or f.field_id.replace("pdf_field_", "")
            form_dict[raw_key] = val

    if form_dict and writer.pages:
        for page in writer.pages:
            try:
                writer.update_page_form_field_values(page, form_dict)
            except Exception:
                pass

    out = BytesIO()
    writer.write(out)
    out.seek(0)
    return out


def detect_template_universal(
    file_bytes: bytes,
    filename: str
) -> Tuple[Any, List[HighlightedField], List[DynamicTableGroup]]:
    """
    Universal template parser supporting .docx, .pptx, and .pdf (form-fillable / annotated / highlighted).
    """
    lower = filename.lower()
    if lower.endswith(".docx"):
        return detect_yellow_highlights(file_bytes)
    elif lower.endswith(".pptx"):
        return detect_pptx_highlights(file_bytes, filename)
    elif lower.endswith(".pdf"):
        return detect_pdf_template(file_bytes, filename)
    else:
        return detect_yellow_highlights(file_bytes)


def apply_field_values_universal(
    template_source: bytes,
    filename: str,
    fields: List[HighlightedField],
    field_values: Dict[str, Optional[str]],
    table_group_records: Optional[Dict[str, List[Dict[str, Any]]]] = None,
    clear_highlight: bool = True
) -> Tuple[BytesIO, str]:
    """
    Universal template exporter supporting .docx, .pptx, and .pdf.
    Returns (BytesIO_content, output_content_type).
    """
    lower = filename.lower()
    if lower.endswith(".docx"):
        bio = apply_field_values_to_template(
            template_source=template_source,
            fields=fields,
            field_values=field_values,
            table_group_records=table_group_records,
            clear_highlight=clear_highlight
        )
        return bio, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    elif lower.endswith(".pptx"):
        bio = apply_pptx_field_values(
            file_bytes=template_source,
            fields=fields,
            field_values=field_values,
            clear_highlight=clear_highlight
        )
        return bio, "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    elif lower.endswith(".pdf"):
        bio = apply_pdf_form_values(
            file_bytes=template_source,
            fields=fields,
            field_values=field_values
        )
        return bio, "application/pdf"
    else:
        bio = apply_field_values_to_template(
            template_source=template_source,
            fields=fields,
            field_values=field_values,
            table_group_records=table_group_records,
            clear_highlight=clear_highlight
        )
        return bio, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


def convert_docx_to_pdf_bytes(docx_bytes: bytes) -> bytes:
    """
    Converts a docx file in memory to a clean, highly formatted PDF using ReportLab.
    Preserves runs, bold/italic/underlines, headings, alignments, table borders, and dynamic column widths.
    """
    import docx
    import math
    from reportlab.lib.pagesizes import letter
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
    from io import BytesIO

    doc = docx.Document(BytesIO(docx_bytes))
    pdf_buffer = BytesIO()
    pdf_doc = SimpleDocTemplate(
        pdf_buffer,
        pagesize=letter,
        rightMargin=54,
        leftMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()
    body_style = ParagraphStyle(
        'LegalBody',
        parent=styles['Normal'],
        fontName='Times-Roman',
        fontSize=11,
        leading=16.5,
        textColor=colors.black,
        spaceAfter=6
    )
    heading_style = ParagraphStyle(
        'LegalHeading',
        parent=styles['Heading2'],
        fontName='Times-Bold',
        fontSize=12.5,
        leading=17.5,
        textColor=colors.black,
        spaceBefore=12,
        spaceAfter=6
    )
    tbl_header_style = ParagraphStyle(
        'TblHdr',
        parent=styles['Normal'],
        fontName='Times-Bold',
        fontSize=10,
        leading=13.5,
        textColor=colors.black
    )
    tbl_cell_style = ParagraphStyle(
        'TblCell',
        parent=styles['Normal'],
        fontName='Times-Roman',
        fontSize=10,
        leading=14,
        textColor=colors.black
    )

    def _render_runs_xml(p) -> str:
        parts = []
        for r in p.runs:
            t = r.text
            if not t:
                continue
            t = t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('\n', '<br/>')
            if r.bold:
                t = f'<b>{t}</b>'
            if r.italic:
                t = f'<i>{t}</i>'
            if r.underline:
                t = f'<u>{t}</u>'
            parts.append(t)
        if parts:
            return ''.join(parts)
        raw = p.text or ""
        return raw.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('\n', '<br/>')

    story = []
    available_width = letter[0] - 108

    for elem in doc.element.body:
        # Check for explicit page breaks in XML
        xml_elem_str = getattr(elem, 'xml', '') or ''
        if '<w:br w:type="page"' in xml_elem_str or '<w:lastRenderedPageBreak' in xml_elem_str:
            story.append(PageBreak())

        if elem.tag.endswith('p'):
            p = docx.text.paragraph.Paragraph(elem, doc)
            xml_text = _render_runs_xml(p).strip()
            if not xml_text:
                story.append(Spacer(1, 4))
                continue
            if p.style.name.startswith('Heading') or p.text.strip().startswith(('1)', '2)', '3)', '4)', '5)', 'ANNEXURE', 'Legal opinion')):
                story.append(Paragraph(xml_text, heading_style))
            else:
                story.append(Paragraph(xml_text, body_style))

        elif elem.tag.endswith('tbl'):
            table = docx.table.Table(elem, doc)
            num_cols = len(table.columns)
            if num_cols == 0:
                continue

            # Calculate proportional column widths
            col_max_lens = [max((len(row.cells[c].text.strip()) for row in table.rows), default=1) for c in range(num_cols)]
            weights = [max(1.5, math.sqrt(max(1, l))) for l in col_max_lens]
            total_weight = sum(weights)
            col_widths = [(w / total_weight) * available_width for w in weights]

            table_data = []
            for r_idx, row in enumerate(table.rows):
                row_data = []
                is_hdr = (r_idx == 0)
                for c_idx, cell in enumerate(row.cells):
                    cell_xml = _render_runs_xml(cell.paragraphs[0]) if cell.paragraphs else cell.text.strip()
                    cell_p = Paragraph(cell_xml, tbl_header_style if is_hdr else tbl_cell_style)
                    row_data.append(cell_p)
                table_data.append(row_data)

            t = Table(table_data, colWidths=col_widths)
            t.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#ffffff')),  # Formal white background
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('LEFTPADDING', (0, 0), (-1, -1), 6),
                ('RIGHTPADDING', (0, 0), (-1, -1), 6),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.black),  # Solid formal black table borders
                ('BACKGROUND', (0, 1), (-1, -1), colors.white)
            ]))
            story.append(Spacer(1, 6))
            story.append(t)
            story.append(Spacer(1, 8))

    if not story:
        story.append(Paragraph("Empty Document", body_style))

    pdf_doc.build(story)
    return pdf_buffer.getvalue()


def convert_docx_to_txt_bytes(docx_bytes: bytes) -> bytes:
    """
    Converts a docx file in memory to plain text bytes.
    """
    import docx
    from io import BytesIO

    doc = docx.Document(BytesIO(docx_bytes))
    lines = []
    for elem in doc.element.body:
        if elem.tag.endswith('p'):
            p = docx.text.paragraph.Paragraph(elem, doc)
            lines.append(p.text)
        elif elem.tag.endswith('tbl'):
            table = docx.table.Table(elem, doc)
            for row in table.rows:
                lines.append(" | ".join(cell.text.strip() for cell in row.cells))
            lines.append("")

    return "\n".join(lines).encode("utf-8")

