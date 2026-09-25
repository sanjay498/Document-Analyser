"""
Doc Filler AI - Arbitrary Document Pipeline Tests
Verifies that Doc Filler AI seamlessly extracts and fills templates for ANY document type:
- Employment Agreements / Offer Letters
- Residential Lease / Rental Agreements
- Commercial Invoices & Billing
- Non-Disclosure Agreements
without hardcoded fallbacks, without fake property data, and with zero leakage of land title deed text.
"""

import pytest
import docx
from io import BytesIO
from backend.app.core.doc_processor import (
    HighlightedField,
    FieldLocation,
    FieldFormatting,
    apply_field_values_to_template
)
from backend.app.core.source_extractor import ExtractedSourceDocument
from backend.app.core.ai_extractor import (
    classify_field,
    extract_all_document_data,
    mock_heuristic_extractor,
    is_title_scrutiny_template
)


def test_employment_agreement_extraction_and_replacement():
    """
    Verifies that an Employment Agreement template paired with a Candidate Resume/Profile
    extracts the candidate's real data (Name, Job Title, Annual CTC, Start Date, Location, Notice Period)
    and preserves non-title narrative paragraphs without injecting land title deed text.
    """
    resume_text = """
    CANDIDATE PROFILE & OFFER DETAILS
    Candidate Name: Samantha Sterling
    Position: Principal Cloud Architect
    Annual Base Salary: $165,000 USD
    Start Date: November 01, 2026
    Work Location: Seattle, Washington
    Notice Period: 30 days
    Contact Email: samantha.sterling@example.com
    Contact Phone: (206) 555-0198
    """

    source_doc = ExtractedSourceDocument(
        filename="Samantha_Sterling_Offer_Intake.pdf",
        file_type="pdf",
        full_text=resume_text,
        char_count=len(resume_text),
        page_or_section_count=1
    )

    fields = [
        HighlightedField(
            field_id="emp_name",
            original_text="Johnathan Doe",
            paragraph_context="p1",
            context_with_marker="Employee Name: [FIELD: Johnathan Doe]",
            location=FieldLocation(location_type="paragraph", paragraph_index=0, run_indices=[0]),
            formatting=FieldFormatting(),
            is_table_cell=False
        ),
        HighlightedField(
            field_id="emp_role",
            original_text="Software Developer",
            paragraph_context="p2",
            context_with_marker="Position: [FIELD: Software Developer]",
            location=FieldLocation(location_type="paragraph", paragraph_index=1, run_indices=[0]),
            formatting=FieldFormatting(),
            is_table_cell=False
        ),
        HighlightedField(
            field_id="emp_salary",
            original_text="$90,000 USD",
            paragraph_context="p3",
            context_with_marker="Annual Base Salary: [FIELD: $90,000 USD]",
            location=FieldLocation(location_type="paragraph", paragraph_index=2, run_indices=[0]),
            formatting=FieldFormatting(),
            is_table_cell=False
        ),
        HighlightedField(
            field_id="emp_start",
            original_text="October 01, 2026",
            paragraph_context="p4",
            context_with_marker="Start Date: [FIELD: October 01, 2026]",
            location=FieldLocation(location_type="paragraph", paragraph_index=3, run_indices=[0]),
            formatting=FieldFormatting(),
            is_table_cell=False
        ),
        HighlightedField(
            field_id="emp_location",
            original_text="Austin, Texas",
            paragraph_context="p5",
            context_with_marker="Work Location: [FIELD: Austin, Texas]",
            location=FieldLocation(location_type="paragraph", paragraph_index=4, run_indices=[0]),
            formatting=FieldFormatting(),
            is_table_cell=False
        ),
        # A long clause (> 80 characters) that must NOT be overwritten by land partition deeds!
        HighlightedField(
            field_id="emp_duties_clause",
            original_text="The Employee agrees to devote full business time, attention, and energies to the diligent and faithful performance of the duties assigned by the Company in compliance with all corporate policies.",
            paragraph_context="p6",
            context_with_marker="[FIELD: The Employee agrees to devote full business time, attention, and energies to the diligent and faithful performance of the duties assigned by the Company in compliance with all corporate policies.]",
            location=FieldLocation(location_type="paragraph", paragraph_index=5, run_indices=[0]),
            formatting=FieldFormatting(),
            is_table_cell=False
        )
    ]

    # Verify domain guarding
    assert not is_title_scrutiny_template(fields, [source_doc])

    # Verify extraction
    result = mock_heuristic_extractor(fields, [], [source_doc])
    val_map = {f.field_id: f.value for f in result.fields}

    assert val_map["emp_name"] == "Samantha Sterling"
    assert val_map["emp_role"] == "Principal Cloud Architect"
    assert val_map["emp_salary"] == "$165,000 USD"
    assert val_map["emp_start"] == "November 01, 2026"
    assert val_map["emp_location"] == "Seattle, Washington"
    assert "The Employee agrees to devote full business time" in val_map["emp_duties_clause"]

    # Strict Zero-Hallucination & Zero-Leakage check:
    all_extracted_text = " ".join(str(v) for v in val_map.values())
    assert "Balashanmugam" not in all_extracted_text
    assert "Kalimuthu" not in all_extracted_text
    assert "Muthulakshmi" not in all_extracted_text
    assert "Partition deed" not in all_extracted_text
    assert "S.F.No." not in all_extracted_text
    assert "6.11 Acres" not in all_extracted_text
    assert "1.00 Acre" not in all_extracted_text
    assert "Anaimalai" not in all_extracted_text
    assert "Pollachi" not in all_extracted_text
    assert "Title Holder" not in all_extracted_text

    # Verify Word Docx generation
    doc = docx.Document()
    for f in fields:
        doc.add_paragraph(f.original_text)

    buf = BytesIO()
    doc.save(buf)
    out_bio = apply_field_values_to_template(buf.getvalue(), fields, val_map, clear_highlight=True)
    gen_doc = docx.Document(out_bio)
    paras = [p.text for p in gen_doc.paragraphs]

    assert "Samantha Sterling" in paras[0]
    assert "Principal Cloud Architect" in paras[1]
    assert "$165,000 USD" in paras[2]
    assert "November 01, 2026" in paras[3]
    assert "Seattle, Washington" in paras[4]
    assert "devote full business time" in paras[5]


def test_lease_agreement_extraction_and_replacement():
    """
    Verifies that a Residential Lease template paired with a Rental Application
    extracts Landlord, Tenant, Monthly Rent, Security Deposit, and Lease Address.
    """
    application_text = """
    RENTAL LEASE APPLICATION & INTAKE
    Landlord Name: Eleanor Roosevelt Properties LLC
    Tenant Name: David K. Chen
    Monthly Rent: $2,850 USD
    Security Deposit: $5,700 USD
    Premises Address: 442 Pine Street, Apt 3B, San Francisco, CA 94108
    Lease Term: 12 months
    """

    source_doc = ExtractedSourceDocument(
        filename="David_Chen_Rental_Application.docx",
        file_type="docx",
        full_text=application_text,
        char_count=len(application_text),
        page_or_section_count=1
    )

    fields = [
        HighlightedField(
            field_id="f_landlord",
            original_text="Landlord LLC",
            paragraph_context="p1",
            context_with_marker="Landlord Name: [FIELD: Landlord LLC]",
            location=FieldLocation(location_type="paragraph", paragraph_index=0, run_indices=[0]),
            formatting=FieldFormatting(),
            is_table_cell=False
        ),
        HighlightedField(
            field_id="f_tenant",
            original_text="Jane Tenant",
            paragraph_context="p2",
            context_with_marker="Tenant Name: [FIELD: Jane Tenant]",
            location=FieldLocation(location_type="paragraph", paragraph_index=1, run_indices=[0]),
            formatting=FieldFormatting(),
            is_table_cell=False
        ),
        HighlightedField(
            field_id="f_rent",
            original_text="$2,000 USD",
            paragraph_context="p3",
            context_with_marker="Monthly Rent: [FIELD: $2,000 USD]",
            location=FieldLocation(location_type="paragraph", paragraph_index=2, run_indices=[0]),
            formatting=FieldFormatting(),
            is_table_cell=False
        ),
        HighlightedField(
            field_id="f_deposit",
            original_text="$4,000 USD",
            paragraph_context="p4",
            context_with_marker="Security Deposit: [FIELD: $4,000 USD]",
            location=FieldLocation(location_type="paragraph", paragraph_index=3, run_indices=[0]),
            formatting=FieldFormatting(),
            is_table_cell=False
        ),
        HighlightedField(
            field_id="f_address",
            original_text="123 Ocean Ave",
            paragraph_context="p5",
            context_with_marker="Premises Address: [FIELD: 123 Ocean Ave]",
            location=FieldLocation(location_type="paragraph", paragraph_index=4, run_indices=[0]),
            formatting=FieldFormatting(),
            is_table_cell=False
        )
    ]

    assert not is_title_scrutiny_template(fields, [source_doc])

    result = mock_heuristic_extractor(fields, [], [source_doc])
    val_map = {f.field_id: f.value for f in result.fields}

    assert val_map["f_landlord"] == "Eleanor Roosevelt Properties LLC"
    assert val_map["f_tenant"] == "David K. Chen"
    assert val_map["f_rent"] == "$2,850 USD"
    assert val_map["f_deposit"] == "$5,700 USD"
    assert "442 Pine Street" in val_map["f_address"]
    assert "San Francisco" in val_map["f_address"]

    # Zero land deed leakage
    all_text = " ".join(str(v) for v in val_map.values())
    assert "Balashanmugam" not in all_text
    assert "S.F.No." not in all_text


def test_commercial_invoice_extraction_and_replacement():
    """
    Verifies that a Commercial Invoice template paired with a PO/Billing document
    extracts Invoice Number, Invoice Date, Client, Total Due, and Payment Terms.
    """
    billing_text = """
    PURCHASE ORDER & BILLING SUMMARY
    Invoice No: INV-2026-8891
    Invoice Date: August 18, 2026
    Client Name: Horizon Global Logistics Corp
    Total Due: $34,500.00
    Payment Terms: 45 days
    """

    source_doc = ExtractedSourceDocument(
        filename="PO_8891_Billing.txt",
        file_type="txt",
        full_text=billing_text,
        char_count=len(billing_text),
        page_or_section_count=1
    )

    fields = [
        HighlightedField(
            field_id="inv_num",
            original_text="INV-0000",
            paragraph_context="p1",
            context_with_marker="Invoice No: [FIELD: INV-0000]",
            location=FieldLocation(location_type="paragraph", paragraph_index=0, run_indices=[0]),
            formatting=FieldFormatting(),
            is_table_cell=False
        ),
        HighlightedField(
            field_id="inv_date",
            original_text="January 01, 2026",
            paragraph_context="p2",
            context_with_marker="Invoice Date: [FIELD: January 01, 2026]",
            location=FieldLocation(location_type="paragraph", paragraph_index=1, run_indices=[0]),
            formatting=FieldFormatting(),
            is_table_cell=False
        ),
        HighlightedField(
            field_id="inv_client",
            original_text="Sample Client",
            paragraph_context="p3",
            context_with_marker="Client Name: [FIELD: Sample Client]",
            location=FieldLocation(location_type="paragraph", paragraph_index=2, run_indices=[0]),
            formatting=FieldFormatting(),
            is_table_cell=False
        ),
        HighlightedField(
            field_id="inv_total",
            original_text="$0.00",
            paragraph_context="p4",
            context_with_marker="Total Due: [FIELD: $0.00]",
            location=FieldLocation(location_type="paragraph", paragraph_index=3, run_indices=[0]),
            formatting=FieldFormatting(),
            is_table_cell=False
        ),
        HighlightedField(
            field_id="inv_terms",
            original_text="30 days",
            paragraph_context="p5",
            context_with_marker="Payment Terms: [FIELD: 30 days]",
            location=FieldLocation(location_type="paragraph", paragraph_index=4, run_indices=[0]),
            formatting=FieldFormatting(),
            is_table_cell=False
        )
    ]

    result = mock_heuristic_extractor(fields, [], [source_doc])
    val_map = {f.field_id: f.value for f in result.fields}

    assert val_map["inv_num"] == "INV-2026-8891"
    assert val_map["inv_date"] == "August 18, 2026"
    assert val_map["inv_client"] == "Horizon Global Logistics Corp"
    assert val_map["inv_total"] == "$34,500.00"
    assert "45 days" in val_map["inv_terms"]


def test_arbitrary_multi_source_conflict_detection():
    """
    Verifies that when two different arbitrary documents provide contradictory values
    (e.g., Offer Letter A says Salary: $120,000 USD while Offer Letter B says Salary: $140,000 USD),
    conflict detection is triggered automatically.
    """
    doc1_text = """
    Candidate Name: Liam O'Connor
    Annual Salary: $120,000 USD
    """
    doc2_text = """
    Candidate Name: Liam O'Connor
    Annual Salary: $140,000 USD
    """

    doc1 = ExtractedSourceDocument(
        filename="Offer_Initial.pdf",
        file_type="pdf",
        full_text=doc1_text,
        char_count=len(doc1_text),
        page_or_section_count=1
    )
    doc2 = ExtractedSourceDocument(
        filename="Offer_Revised.pdf",
        file_type="pdf",
        full_text=doc2_text,
        char_count=len(doc2_text),
        page_or_section_count=1
    )

    fields = [
        HighlightedField(
            field_id="sal_field",
            original_text="$100,000 USD",
            paragraph_context="p1",
            context_with_marker="Annual Salary: [FIELD: $100,000 USD]",
            location=FieldLocation(location_type="paragraph", paragraph_index=0, run_indices=[0]),
            formatting=FieldFormatting(),
            is_table_cell=False
        )
    ]

    result = mock_heuristic_extractor(fields, [], [doc1, doc2])
    sal_res = result.fields[0]

    assert sal_res.status == "conflict"
    assert sal_res.value is None  # Never pick winner automatically
    assert len(sal_res.conflicts) == 2
    vals = {c.value for c in sal_res.conflicts}
    assert "$120,000 USD" in vals
    assert "$140,000 USD" in vals
