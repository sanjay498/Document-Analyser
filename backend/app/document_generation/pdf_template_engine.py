import re
from pathlib import Path
from typing import List, Tuple, Dict, Any
import pdfplumber
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white
import io

from app.utils.logger import logger

class PdfTemplateEngine:
    """
    Engine to extract {{PLACEHOLDER}} tags from PDF templates and substitute values
    by overlaying replacement text cleanly over placeholder coordinates.
    """

    @staticmethod
    def extract_placeholders(pdf_path: str) -> List[Dict[str, Any]]:
        """
        Scans PDF pages for placeholders like {{FIELD_NAME}}.
        Returns a list of dicts with placeholder details including coordinates.
        """
        results = []
        pattern = re.compile(r'\{\{\s*([A-Za-z0-9_\-]+)\s*\}\}')
        seen_fields = set()

        try:
            with pdfplumber.open(pdf_path) as pdf:
                for page_idx, page in enumerate(pdf.pages, start=1):
                    words = page.extract_words()
                    page_text = page.extract_text() or ""
                    
                    # Extract matches from full text
                    for match in pattern.finditer(page_text):
                        field_name = match.group(1).upper()
                        ph = match.group(0)

                        # Find matching word bounding boxes if available
                        matching_bbox = [0.0, 0.0, 100.0, 20.0]
                        for word in words:
                            if field_name in word['text'] or "{{" in word['text']:
                                matching_bbox = [
                                    float(word['x0']),
                                    float(word['top']),
                                    float(word['x1']),
                                    float(word['bottom'])
                                ]
                                break

                        if field_name not in seen_fields:
                            seen_fields.add(field_name)
                            results.append({
                                "field_name": field_name,
                                "placeholder": ph,
                                "page_number": page_idx,
                                "position_x": matching_bbox[0],
                                "position_y": matching_bbox[1],
                                "width": matching_bbox[2] - matching_bbox[0],
                                "height": matching_bbox[3] - matching_bbox[1]
                            })
        except Exception as e:
            logger.error(f"Error scanning PDF template placeholders: {e}")

        return results

    def generate_document_from_pdf(
        self,
        template_pdf_path: str,
        output_pdf_path: str,
        field_values: Dict[str, str]
    ) -> str:
        """
        Replaces {{PLACEHOLDER}} tags in PDF template by creating an overlay PDF canvas
        and merging it with the original template pages.
        """
        if not Path(template_pdf_path).exists():
            raise FileNotFoundError(f"PDF template file not found: {template_pdf_path}")

        reader = PdfReader(template_pdf_path)
        writer = PdfWriter()

        pattern = re.compile(r'\{\{\s*([A-Za-z0-9_\-]+)\s*\}\}')

        with pdfplumber.open(template_pdf_path) as plumber_pdf:
            for page_idx, page in enumerate(reader.pages):
                plumber_page = plumber_pdf.pages[page_idx]
                words = plumber_page.extract_words()
                page_width = float(plumber_page.width)
                page_height = float(plumber_page.height)

                # Create overlay canvas in memory
                packet = io.BytesIO()
                can = canvas.Canvas(packet, pagesize=(page_width, page_height))

                has_overlay = False

                for word in words:
                    text = word['text']
                    match = pattern.search(text)
                    if match:
                        field_name = match.group(1).upper()
                        replacement_val = field_values.get(field_name, "")

                        x0 = float(word['x0'])
                        top = float(word['top'])
                        x1 = float(word['x1'])
                        bottom = float(word['bottom'])

                        # Convert top-left PDF coordinates to ReportLab bottom-left coordinates
                        y_bottom = page_height - bottom
                        w = max(x1 - x0, 80.0)
                        h = bottom - top

                        # Draw white background box to cover placeholder tag
                        can.setFillColor(white)
                        can.setStrokeColor(white)
                        can.rect(x0 - 2, y_bottom - 2, w + 10, h + 4, fill=1, stroke=1)

                        # Draw new replacement text
                        can.setFillColor(HexColor('#0f172a'))
                        can.setFont("Helvetica-Bold", 10)
                        can.drawString(x0, y_bottom + 2, replacement_val)
                        has_overlay = True

                can.save()
                packet.seek(0)

                if has_overlay:
                    overlay_pdf = PdfReader(packet)
                    page.merge_page(overlay_pdf.pages[0])

                writer.add_page(page)

        out_path = Path(output_pdf_path)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "wb") as f_out:
            writer.write(f_out)

        logger.info(f"Generated PDF from PDF template saved to {out_path}")
        return str(out_path.resolve())

pdf_template_engine = PdfTemplateEngine()
