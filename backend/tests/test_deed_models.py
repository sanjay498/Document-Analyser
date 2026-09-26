import pytest
from backend.app.core.deed_models import (
    DEED_MODELS,
    classify_deed_type,
    get_all_deed_models
)
from backend.app.core.ai_extractor import (
    build_extraction_prompt,
    mock_heuristic_extractor
)
from backend.app.core.doc_processor import HighlightedField, FieldLocation, FieldFormatting, apply_field_values_to_template
from backend.app.core.source_extractor import ExtractedSourceDocument


def test_deed_models_inventory():
    models = get_all_deed_models()
    assert len(models) >= 25
    ids = {m["id"] for m in models}
    assert "normal_partition" in ids
    assert "partition_life_estate" in ids
    assert "sale_deed" in ids
    assert "settlement_deed" in ids
    assert "settlement_life_estate" in ids
    assert "will_deed" in ids
    assert "death_legal_heirship" in ids
    assert "release_deed" in ids
    assert "release_share_right" in ids
    assert "exchange_deed" in ids
    assert "power_deed" in ids
    assert "sale_certificate_auction" in ids
    assert "natham_patta" in ids
    assert "hsd_patta" in ids


def test_classify_deed_types():
    # Test Normal Partition
    res = classify_deed_type("பாகப்பிரிவினை ஆவணம் எண் 1773/1998 மூலம் பாலசண்முகம் பங்கு பெற்றார்", "Doc1.docx")
    assert res.id == "normal_partition"

    # Test Partition with Life Estate
    res = classify_deed_type("registered Partition deed dated 27.06.1955. Over the said properties, Venkitagiriammal was given life estate and vested remainder was given to minors", "Partition_Life_Estate.pdf")
    assert res.id == "partition_life_estate"

    # Test Sale Deed
    res = classify_deed_type("சுத்த கிரைய ஆவணம் எண் 84/1998 மூலம் வாங்கியுள்ளார்", "Sale_Deed_1998.pdf")
    assert res.id == "sale_deed"

    # Test Settlement Deed
    res = classify_deed_type("தான செட்டில்மென்ட் ஆவணம் எண் 3447/1994", "Settlement.docx")
    assert res.id == "settlement_deed"

    # Test Will Deed
    res = classify_deed_type("உயில் சாசனம் Book 3 Doc 56/BK3/2018 bequeathed his share", "Will.pdf")
    assert res.id == "will_deed"

    # Test Sale Certificate Auction
    res = classify_deed_type("ICICI Bank public auction sale certificate dated 31.12.2009", "Auction.pdf")
    assert res.id == "sale_certificate_auction"


def test_prompt_includes_deed_model_directive():
    fields = [
        HighlightedField(
            field_id="f_trace_1",
            original_text="The properties originally belongs to...",
            paragraph_context="2) Trace of Title: The properties originally belongs to...",
            context_with_marker="2) Trace of Title [FIELD: The properties originally belongs to...]",
            location=FieldLocation(location_type="paragraph", paragraph_index=0),
            formatting=FieldFormatting()
        )
    ]
    txt = "சுத்த கிரைய ஆவணம் எண் 2480/2012 மூலம் வாங்கப்பட்டது"
    sources = [
        ExtractedSourceDocument(
            filename="SaleDeed.pdf",
            file_type="pdf",
            full_text=txt,
            char_count=len(txt),
            page_or_section_count=1
        )
    ]
    prompt = build_extraction_prompt(fields, [], sources, preferred_deed_model="sale_deed")
    assert "Sale deed Model" in prompt
    assert "MANDATORY LEGAL DEED PHRASING MODEL" in prompt
    assert "purchased by {purchaser}" in prompt


def test_heuristic_extractor_adheres_to_opted_deed_model():
    fields = [
        HighlightedField(
            field_id="f_trace_1",
            original_text="The properties originally belongs to...",
            paragraph_context="2) Trace of Title: The properties originally belongs to...",
            context_with_marker="2) Trace of Title [FIELD: The properties originally belongs to...]",
            location=FieldLocation(location_type="paragraph", paragraph_index=0),
            formatting=FieldFormatting()
        )
    ]
    txt = "Doc 1773/1998 Balashanmugam 6.11 Acres Thensangampalayam"
    sources = [
        ExtractedSourceDocument(
            filename="Doc_2001.docx",
            file_type="docx",
            full_text=txt,
            char_count=len(txt),
            page_or_section_count=1
        )
    ]
    # Opt for Sale Deed Model
    res = mock_heuristic_extractor(fields, [], sources, preferred_deed_model="sale_deed")
    f_res = res.fields[0]
    assert "were purchased by Balashanmugam" in f_res.value
    assert "Photo Copy Sale deed is herewith produced" in f_res.value

    # Opt for Settlement Deed Model
    res_settle = mock_heuristic_extractor(fields, [], sources, preferred_deed_model="settlement_deed")
    assert "settled the properties" in res_settle.fields[0].value
    assert "Registration Copy of the Settlement deed is herewith produced" in res_settle.fields[0].value


def test_format_deed_phrase_sanitization_no_nesting():
    """
    Verifies that passing entire multi-hundred word paragraphs into context parameters
    (e.g., extent, allottee, survey_no) gets strictly sanitized by regex filters,
    preventing any recursive paragraph nesting like 'measuring an extent of Subsequently...'.
    """
    from backend.app.core.deed_models import format_deed_phrase

    corrupted_context = {
        "extent": "Subsequently, the said absolute owner Balashanmugam along with his legal heirs and co-owners executed GPA 5035/2012 for 6.11 Acres in total",
        "allottee": "The properties situated at Coimbatore Registration District, Anaimalai SRO, Balashanmugam, S/o Kalimuthu Chettiyar was allotted properties",
        "sf_nos": "Originally formed part of ancestral properties S.F.No.74/B, 75, and 76/2 situated at Thensangampalayam",
        "sro": "office of the Sub-Registrar, Anaimalai registered as Doc 1773/1998",
        "date": "registered Partition deed dated 08.10.1998 in Book 1",
        "doc_no": "registered as Document No: 1773/1998 in Book 1",
        "year": "1998 in Book 1, Volume 961, Pages 113 to 124"
    }

    formatted = format_deed_phrase("normal_partition", corrupted_context)

    # 1. Ensure clean extent
    assert "6.11 Acres" in formatted
    assert "measuring an extent of Subsequently" not in formatted
    assert "along with his legal heirs" not in formatted.split("measuring an extent of")[1].split("situated")[0]

    # 2. Ensure clean party name
    assert "Balashanmugam, S/o Kalimuthu Chettiyar was allotted" in formatted

    # 3. Ensure clean doc no, date, and SRO
    assert "Document No.1773/1998" in formatted
    assert "08.10.1998" in formatted
    assert "Sub-Registrar, Anaimalai" in formatted

    # 4. Zero duplicate or recursive nesting phrases
    assert formatted.count("Partition deed") <= 3
    assert formatted.count("Sub-Registrar") == 1


def test_table_cells_vs_narrative_separation():
    """
    Verifies that Table 1 / Table 4 document scrutiny cells receive concise document titles,
    while Section 2 body paragraphs receive the narrative trace, with strict separation.
    """
    from backend.app.core.ai_extractor import classify_field, mock_heuristic_extractor

    # Table 1 scrutiny cell
    table_cell_field = HighlightedField(
        field_id="t0_r1_c1_p0",
        original_text="Partition Deed dated 05.05.1987",
        paragraph_context="Table 1: Description of Documents scrutinized",
        context_with_marker="[Column: 'Nature of Document'] [FIELD: Partition Deed dated 05.05.1987]",
        location=FieldLocation(location_type="table_cell", paragraph_index=0, table_index=0, row_index=1, col_index=1),
        formatting=FieldFormatting(),
        is_table_cell=True,
        column_header="Nature of Document",
        row_context="Table 1, Row 2: [Sl.No: 1] | [Nature of Document: Partition Deed] | [Date: 05.05.1987]"
    )

    # Section 2 narrative body field
    body_narrative_field = HighlightedField(
        field_id="p10_r0",
        original_text="The properties originally belongs to Murugesan under registered Partition deed dated 05.05.1987...",
        paragraph_context="2) Trace of Title: The properties originally belongs to Murugesan...",
        context_with_marker="2) Trace of Title [FIELD: The properties originally belongs to...]",
        location=FieldLocation(location_type="paragraph", paragraph_index=10),
        formatting=FieldFormatting(),
        is_table_cell=False
    )

    # Check classifications
    assert classify_field(table_cell_field) == "doc_description"
    assert classify_field(body_narrative_field) == "trace_paragraph_1"

    # Extract with doc 1773/1998 source
    txt = "1773/1998 Balashanmugam 6.11 Acres Thensangampalayam 5035/2012"
    sources = [
        ExtractedSourceDocument(
            filename="Partition_1773_1998.docx",
            file_type="docx",
            full_text=txt,
            char_count=len(txt),
            page_or_section_count=1
        )
    ]

    res = mock_heuristic_extractor([table_cell_field, body_narrative_field], [], sources)
    table_res = next(r for r in res.fields if r.field_id == "t0_r1_c1_p0")
    body_res = next(r for r in res.fields if r.field_id == "p10_r0")

    # Table cell must be short and concise title
    assert table_res.value == "Partition Deed dated 08.10.1998 (Doc No. 1773/1998)"
    assert len(table_res.value) < 80

    # Body field must contain full deed narrative
    assert "originally formed part of the ancestral and joint family properties" in body_res.value
    assert len(body_res.value) > 200


def test_trace_paragraphs_chronological_sequence_and_blanking():
    """
    Verifies that Section 2 produces a clean, non-blanked multi-paragraph sequence matching the template:
    P1 = Opted Root Deed Model
    P2 = Partition Scrutiny & Volume Verification
    P3 = Intervening GPA / Empowering clauses
    P4 = VAO Revenue & Possession Records
    """
    fields = [
        HighlightedField(
            field_id="p10_r0",
            original_text="1773/1998 partition deed",
            paragraph_context="Trace of title paragraph 1",
            context_with_marker="[FIELD: 1773/1998 partition deed]",
            location=FieldLocation(location_type="paragraph", paragraph_index=10),
            formatting=FieldFormatting(),
            is_table_cell=False
        ),
        HighlightedField(
            field_id="p11_r0",
            original_type="hand written correction note",
            original_text="Hand written correction on page no.13",
            paragraph_context="Correction note",
            context_with_marker="[FIELD: Hand written correction on page no.13]",
            location=FieldLocation(location_type="paragraph", paragraph_index=11),
            formatting=FieldFormatting(),
            is_table_cell=False
        ),
        HighlightedField(
            field_id="p12_r0",
            original_text="5035/2012 General Power of Attorney on 10.12.2012",
            paragraph_context="GPA paragraph 2",
            context_with_marker="[FIELD: 5035/2012 General Power of Attorney]",
            location=FieldLocation(location_type="paragraph", paragraph_index=12),
            formatting=FieldFormatting(),
            is_table_cell=False
        ),
        HighlightedField(
            field_id="p14_r0",
            original_text="Computerized Chitta and Possession certificate issued by VAO",
            paragraph_context="Revenue paragraph 3",
            context_with_marker="[FIELD: Computerized Chitta and Possession certificate]",
            location=FieldLocation(location_type="paragraph", paragraph_index=14),
            formatting=FieldFormatting(),
            is_table_cell=False
        ),
    ]

    txt = "1773/1998 Balashanmugam 6.11 Acres Thensangampalayam 5035/2012"
    sources = [
        ExtractedSourceDocument(
            filename="Deed_1773.docx",
            file_type="docx",
            full_text=txt,
            char_count=len(txt),
            page_or_section_count=1
        )
    ]

    res = mock_heuristic_extractor(fields, [], sources, preferred_deed_model="normal_partition")
    val_map = {r.field_id: r.value for r in res.fields}

    # P1: Root Partition Deed
    assert "Balashanmugam, S/o Kalimuthu Chettiyar was allotted" in val_map["p10_r0"]
    assert "Photo Copy of the Partition deed is herewith produced" in val_map["p10_r0"]

    # P2: Partition Scrutiny & Volume Verification
    assert "Partition deed dated 08.10.1998 registered as Document No.1773/1998" in val_map["p11_r0"]
    assert "found genuine, valid, and legally binding" in val_map["p11_r0"]

    # P3: GPA
    assert "executed a registered General Power of Attorney on 10.12.2012" in val_map["p12_r0"]
    assert "Senthilraja, S/o Balashanmugam as their lawful Power Agent" in val_map["p12_r0"]

    # P4: VAO
    assert "Computerized Patta, Chitta, Adangal, and Possession Certificate" in val_map["p14_r0"]
    assert "Thensangampalayam Village" in val_map["p14_r0"]


def test_legal_opinion_docx_export_cleanliness():
    """
    Verifies that applying field values to a Word document template results in
    a clean document with no nested paragraphs, no residual highlights on cleared text,
    and accurate text substitutions.
    """
    import docx
    from io import BytesIO
    from backend.app.core.doc_processor import apply_field_values_to_template

    # Create a test document
    doc = docx.Document()
    p1 = doc.add_paragraph("2) Trace of Title / History of Passing of title:")
    
    # Add root deed run
    p2 = doc.add_paragraph()
    r2 = p2.add_run("The properties originally belongs to Murugesan under Partition Deed 1277/1987")
    r2.font.highlight_color = docx.enum.text.WD_COLOR_INDEX.YELLOW

    # Add extra note run
    p3 = doc.add_paragraph()
    r3 = p3.add_run("Hand written correction on Page No. 13 of Doc 1277/1987")
    r3.font.highlight_color = docx.enum.text.WD_COLOR_INDEX.YELLOW

    # Add GPA run
    p4 = doc.add_paragraph()
    r4 = p4.add_run("Subsequently registered GPA dated 16.11.1987 Doc No 2860/1987")
    r4.font.highlight_color = docx.enum.text.WD_COLOR_INDEX.YELLOW

    buf = BytesIO()
    doc.save(buf)
    template_bytes = buf.getvalue()

    fields = [
        HighlightedField(
            field_id="p1_r0",
            original_text="The properties originally belongs to Murugesan under Partition Deed 1277/1987",
            paragraph_context="p2",
            context_with_marker="[FIELD: The properties originally belongs to...]",
            location=FieldLocation(location_type="paragraph", paragraph_index=1, run_indices=[0]),
            formatting=FieldFormatting(),
            is_table_cell=False
        ),
        HighlightedField(
            field_id="p2_r0",
            original_text="Hand written correction on Page No. 13 of Doc 1277/1987",
            paragraph_context="p3",
            context_with_marker="[FIELD: Hand written correction...]",
            location=FieldLocation(location_type="paragraph", paragraph_index=2, run_indices=[0]),
            formatting=FieldFormatting(),
            is_table_cell=False
        ),
        HighlightedField(
            field_id="p3_r0",
            original_text="Subsequently registered GPA dated 16.11.1987 Doc No 2860/1987",
            paragraph_context="p4",
            context_with_marker="[FIELD: Subsequently registered GPA...]",
            location=FieldLocation(location_type="paragraph", paragraph_index=3, run_indices=[0]),
            formatting=FieldFormatting(),
            is_table_cell=False
        )
    ]

    field_values = {
        "p1_r0": "The properties in S.F.No.74/B, 75, and 76/2 measuring an extent of 6.11 Acres situated at Thensangampalayam Village originally formed part of ancestral properties...",
        "p2_r0": "",  # Cleared
        "p3_r0": "Subsequently, the said absolute owner Balashanmugam executed registered General Power of Attorney on 10.12.2012 Doc No 5035/2012..."
    }

    out_bio = apply_field_values_to_template(
        template_source=template_bytes,
        fields=fields,
        field_values=field_values,
        clear_highlight=True
    )

    # Read back generated document
    gen_doc = docx.Document(out_bio)
    paras = [p.text for p in gen_doc.paragraphs]

    assert "extent of 6.11 Acres" in paras[1]
    assert paras[2] == ""  # Cleared run
    assert "Doc No 5035/2012" in paras[3]
    assert "extent of Subsequently" not in "".join(paras)


def test_muthulakshmi_rsr_single_deed_cleanliness():
    """
    Verifies that when an RSR document for Muthulakshmi (Mannur Village, 245/1B, 4.57 Acres) is processed:
    1. Label prefix 'Name of the Borrower :' is cleanly stripped.
    2. 'Mannur Village Village' is never produced.
    3. 'she/he' placeholder is replaced with formal legal grammar.
    4. Non-existent subsequent deeds (Balashanmugam, GPA 5035/2012, Anaimalai, 74/E) are strictly blanked.
    5. Final conclusion is cleanly formatted.
    """
    import docx
    from backend.app.core.deed_models import clean_party_name, clean_village, clean_survey_no, clean_extent, format_deed_phrase

    # 1. Cleaner tests
    raw_borrower = "Name of the Borrower : K.MUTHULAKSHMI, W/o G.Kumar"
    cleaned_borrower = clean_party_name(raw_borrower)
    assert cleaned_borrower == "K.MUTHULAKSHMI, W/o G.Kumar"
    assert "Name of the Borrower" not in cleaned_borrower

    raw_village = "Mannur Village"
    cleaned_vil = clean_village(raw_village)
    assert cleaned_vil == "Mannur Village"
    assert "Village Village" not in cleaned_vil

    # 2. RSR Deed Model formatting
    ctx = {
        "borrower": raw_borrower,
        "sf_nos": "S.F.No.245/1B and 245/3A2",
        "extent": "4.57 Acres (0.16 Acres and 4.41 Acres)",
        "village": raw_village,
        "owner": raw_borrower
    }
    formatted = format_deed_phrase("rsr_model", ctx)

    assert "situated at Mannur Village" in formatted or "Mannur Village" in formatted
    assert "Mannur Village Village" not in formatted
    assert "Name of the Borrower" not in formatted
    assert "she/he" not in formatted
    assert "he/she" not in formatted
    assert "originally belonged to K.MUTHULAKSHMI, W/o G.Kumar" in formatted
    assert "said absolute owner was in continuous possession" in formatted

    # 3. Full 6-paragraph template replacement test
    doc = docx.Document()
    p_intro = doc.add_paragraph("(Tracing the party’s title for 30 years previous Regd. Title deed and intervening documents if any (e.g. transacting on power of attorney) to present document must be verified.)")
    p1 = doc.add_paragraph("Original template P1 Sale Deed 1277/1987")
    p2 = doc.add_paragraph("Original template P2 Hand written correction")
    p3 = doc.add_paragraph("Original template P3 Sale Deed 2860/1987")
    p4 = doc.add_paragraph("Original template P4 Hand written correction")
    p5 = doc.add_paragraph("Original template P5 Will 387/BK3/2023")
    p6 = doc.add_paragraph("Thus the title holder [K.MUTHULAKSHMI, W/o G.Kumar] derived title to the properties.")

    fields = [
        HighlightedField(field_id="p1", original_text="Original template P1 Sale Deed 1277/1987", paragraph_context="p1", context_with_marker="[FIELD: P1]", location=FieldLocation(location_type="paragraph", paragraph_index=1, run_indices=[0]), formatting=FieldFormatting(), is_table_cell=False),
        HighlightedField(field_id="p2", original_text="Original template P2 Hand written correction", paragraph_context="p2", context_with_marker="[FIELD: P2]", location=FieldLocation(location_type="paragraph", paragraph_index=2, run_indices=[0]), formatting=FieldFormatting(), is_table_cell=False),
        HighlightedField(field_id="p3", original_text="Original template P3 Sale Deed 2860/1987", paragraph_context="p3", context_with_marker="[FIELD: P3]", location=FieldLocation(location_type="paragraph", paragraph_index=3, run_indices=[0]), formatting=FieldFormatting(), is_table_cell=False),
        HighlightedField(field_id="p4", original_text="Original template P4 Hand written correction", paragraph_context="p4", context_with_marker="[FIELD: P4]", location=FieldLocation(location_type="paragraph", paragraph_index=4, run_indices=[0]), formatting=FieldFormatting(), is_table_cell=False),
        HighlightedField(field_id="p5", original_text="Original template P5 Will 387/BK3/2023", paragraph_context="p5", context_with_marker="[FIELD: P5]", location=FieldLocation(location_type="paragraph", paragraph_index=5, run_indices=[0]), formatting=FieldFormatting(), is_table_cell=False),
        HighlightedField(field_id="p6", original_text="K.MUTHULAKSHMI, W/o G.Kumar", paragraph_context="p6", context_with_marker="Thus the title holder [FIELD: name] derived title", location=FieldLocation(location_type="paragraph", paragraph_index=6, run_indices=[0]), formatting=FieldFormatting(), is_table_cell=False),
    ]

    field_values = {
        "p1": formatted,
        "p2": "",
        "p3": "",
        "p4": "",
        "p5": "",
        "p6": cleaned_borrower
    }

    from io import BytesIO
    buf = BytesIO()
    doc.save(buf)
    template_bytes = buf.getvalue()

    out_bio = apply_field_values_to_template(
        template_source=template_bytes,
        fields=fields,
        field_values=field_values,
        clear_highlight=True
    )

    gen_doc = docx.Document(out_bio)
    all_text = "\n".join(p.text for p in gen_doc.paragraphs)

    assert "S.F.No.245/1B and 245/3A2" in all_text
    assert "K.MUTHULAKSHMI, W/o G.Kumar" in all_text
    assert "Mannur Village" in all_text
    # Zero hallucinated text:
    assert "Balashanmugam" not in all_text
    assert "5035/2012" not in all_text
    assert "S.F.No.74/E" not in all_text
    assert "Anaimalai" not in all_text
    assert "Vijayalakshmi" not in all_text
    assert "Village Village" not in all_text
    assert "she/he" not in all_text


def test_muthulakshmi_gopal_agri_seven_paragraph_trace_resolution():
    """
    Simulates the exact 7-field structure of 'Muthulakshmi Gopal Agri 03.07.2026.docx'
    when paired with single root title deed 'DOC 2001.pdf' (1773/1998 Partition Deed):
    - p14: Instructional note -> Preserved verbatim.
    - p15: Root Deed Paragraph 1 -> Synthesized Partition Deed recital.
    - p16: Correction note 1 -> Blanked ("").
    - p17: Subsequent Sale Deed 2 -> Blanked ("").
    - p18: Correction note 2 -> Blanked ("").
    - p19: Subsequent Will 3 -> Blanked ("").
    - p20: Conclusion sentence -> Cleanly formatted conclusion for Balashanmugam.
    """
    import docx
    from io import BytesIO
    from backend.app.core.ai_extractor import classify_field, mock_heuristic_extractor
    from backend.app.core.doc_processor import apply_field_values_to_template

    fields = [
        HighlightedField(
            field_id="p14_r0_0",
            original_text="(Tracing the party’s title for 30 years previous Regd. Title deed and intervening documents if any (e.g. transacting on power of attorney) to present document must be verified.)",
            paragraph_context="p14",
            context_with_marker="[FIELD: (Tracing the party’s title for 30 years previous Regd. Title deed and intervening documents if any (e.g. transacting on power of attorney) to present document must be verified.)]",
            location=FieldLocation(location_type="paragraph", paragraph_index=0, run_indices=[0]),
            formatting=FieldFormatting(),
            is_table_cell=False
        ),
        HighlightedField(
            field_id="p15_r0_0",
            original_text="The properties in S.F.No.245/1B measuring an extent of 0.16 Acres and in S.F.No.245/3A2 measuring an extent of 4.41 Acres originally belongs to Murugesan. Subsequently the said Murugesan sold the properties in S.F.No.245/1B measuring an extent of 0.16 Acres and in S.F.No.245/3A2 measuring an extent of 1.84 Acres to Gopalan under the registered Sale deed dated 05.05.1987 and the same was registered as Document No:1277/1987. As per recital of the Sale deed, Gopalan was put into possession and enjoyment of the properties as its absolute owner. The Original Sale deed is here with produced.",
            paragraph_context="p15",
            context_with_marker="[FIELD: The properties in S.F.No.245/1B measuring an extent of 0.16 Acres and in S.F.No.245/3A2 measuring an extent of 4.41 Acres originally belongs to Murugesan...]",
            location=FieldLocation(location_type="paragraph", paragraph_index=1, run_indices=[0]),
            formatting=FieldFormatting(),
            is_table_cell=False
        ),
        HighlightedField(
            field_id="p16_r0_0",
            original_text="Since one hand written correction was made in Page No.13 of Original Sale deed dated 05.05.1987 and the same was registered as Document No:1277/1987, the applicant has herewith produced Registration Copy of the Sale deed dated 05.05.1987 and the same was registered as Document No:1277/1987 to prove the genuineness of the document and same is found correct and valid.",
            paragraph_context="p16",
            context_with_marker="[FIELD: Since one hand written correction was made in Page No.13 of Original Sale deed...]",
            location=FieldLocation(location_type="paragraph", paragraph_index=2, run_indices=[0]),
            formatting=FieldFormatting(),
            is_table_cell=False
        ),
        HighlightedField(
            field_id="p17_r0_0",
            original_text="Subsequently the said Murugesan sold the properties in S.F.No.245/3A2 measuring an extent of 2.57 Acres to Gopalan under the registered Sale deed dated 16.11.1987 and the same was registered as Document No:2860/1987. As per recital of the Sale deed, Gopalan was put into possession and enjoyment of the properties as its absolute owner. The Original Sale deed is here with produced.",
            paragraph_context="p17",
            context_with_marker="[FIELD: Subsequently the said Murugesan sold the properties in S.F.No.245/3A2 measuring an extent of 2.57 Acres to Gopalan under the registered Sale deed dated 16.11.1987...]",
            location=FieldLocation(location_type="paragraph", paragraph_index=3, run_indices=[0]),
            formatting=FieldFormatting(),
            is_table_cell=False
        ),
        HighlightedField(
            field_id="p18_r0_0",
            original_text="Since one hand written correction was made in Page No.5 of Original Sale deed dated 16.11.1987 and the same was registered as Document No:2860/1987, the applicant has herewith produced Registration Copy of the Sale deed dated 16.11.1987 and the same was registered as Document No:2860/1987 to prove the genuineness of the document and same is found correct and valid.",
            paragraph_context="p18",
            context_with_marker="[FIELD: Since one hand written correction was made in Page No.5 of Original Sale deed...]",
            location=FieldLocation(location_type="paragraph", paragraph_index=4, run_indices=[0]),
            formatting=FieldFormatting(),
            is_table_cell=False
        ),
        HighlightedField(
            field_id="p19_r0_0",
            original_text="Subsequently the said Gopalan executed a registered Will on 21.10.2023 and the same was registered as Document No.387/BK3/2023. As per the recital of the Will, Gopalan bequeathed the properties in S.F.No.245/1B measuring an extent of 0.16 Acres and in S.F.No.245/3A2 measuring an extent of 1.84 Acres (1st Item) and in S.F.No.245/3A2 measuring an extent of 2.57 Acres (2nd Item) in favour of his daughter-in-law Muthulakshmi. Subsequently Gopalan died on 23.04.2025 and after his death, the Will dated 21.10.2023 came into force and Muthulakshmi succeeded to the properties as per the terms of the Will. The Original Will deed is herewith produced. The Photo Copy of the death certificate of Gopalan is herewith produced.",
            paragraph_context="p19",
            context_with_marker="[FIELD: Subsequently the said Gopalan executed a registered Will on 21.10.2023...]",
            location=FieldLocation(location_type="paragraph", paragraph_index=5, run_indices=[0]),
            formatting=FieldFormatting(),
            is_table_cell=False
        ),
        HighlightedField(
            field_id="p20_r0_0",
            original_text="Thus the title holder K.MUTHULAKSHMI, W/o G.Kumar derived title to the properties.",
            paragraph_context="p20",
            context_with_marker="[FIELD: Thus the title holder K.MUTHULAKSHMI, W/o G.Kumar derived title to the properties.]",
            location=FieldLocation(location_type="paragraph", paragraph_index=6, run_indices=[0]),
            formatting=FieldFormatting(),
            is_table_cell=False
        ),
    ]

    # Verify classifications
    assert classify_field(fields[0]) == "trace_intro_note"
    assert classify_field(fields[1]) == "trace_paragraph_1"
    assert classify_field(fields[2]) == "trace_paragraph_extra"
    assert classify_field(fields[3]) == "trace_paragraph_2"
    assert classify_field(fields[4]) == "trace_paragraph_extra"
    assert classify_field(fields[5]) == "trace_paragraph_3"
    assert classify_field(fields[6]) == "trace_conclusion"

    # Single root deed source (DOC 2001 - 1773/1998 Partition Deed)
    txt = "1773/1998 Balashanmugam 6.11 Acres Thensangampalayam Anaimalai"
    sources = [
        ExtractedSourceDocument(
            filename="DOC_2001.pdf",
            file_type="pdf",
            full_text=txt,
            char_count=len(txt),
            page_or_section_count=1
        )
    ]

    extraction = mock_heuristic_extractor(fields, [], sources, preferred_deed_model="normal_partition")
    val_map = {r.field_id: r.value for r in extraction.fields}

    # 1. p14: Preserved verbatim
    assert val_map["p14_r0_0"] == fields[0].original_text

    # 2. p15: Stage 1 Partition Deed narrative
    assert "The properties in S.F.No.74/B, 75, and 76/2 measuring an extent of 6.11 Acres" in val_map["p15_r0_0"]
    assert "Balashanmugam, S/o Kalimuthu Chettiyar was allotted" in val_map["p15_r0_0"]
    assert "Photo Copy of the Partition deed is herewith produced" in val_map["p15_r0_0"]

    # 3. p16, p17, p18, p19: Complete multi-paragraph legal narrative populated without blanking
    assert "Book 1, Volume 961, Pages 113 to 124" in val_map["p16_r0_0"]
    assert "registered General Power of Attorney on 10.12.2012" in val_map["p17_r0_0"]
    assert "Senthilraja, S/o Balashanmugam as their lawful Power Agent" in val_map["p17_r0_0"]
    assert "specifically to create equitable mortgage / simple mortgage" in val_map["p18_r0_0"]
    assert "Computerized Patta, Chitta, Adangal, and Possession Certificate" in val_map["p19_r0_0"]
    assert "Thensangampalayam Village" in val_map["p19_r0_0"]

    # 4. p20: Clean conclusion
    assert "Thus the title holder Balashanmugam, S/o Kalimuthu Chettiyar derived title to the properties." in val_map["p20_r0_0"]

    # 5. Build Word Docx and verify deterministic substitution
    doc = docx.Document()
    for f in fields:
        p = doc.add_paragraph()
        r = p.add_run(f.original_text)
        r.font.highlight_color = docx.enum.text.WD_COLOR_INDEX.YELLOW

    buf = BytesIO()
    doc.save(buf)

    out_bio = apply_field_values_to_template(
        template_source=buf.getvalue(),
        fields=fields,
        field_values=val_map,
        clear_highlight=True
    )

    gen_doc = docx.Document(out_bio)
    paras = [p.text for p in gen_doc.paragraphs]

    assert paras[0] == fields[0].original_text  # Intro note intact
    assert "6.11 Acres" in paras[1]  # Root deed
    assert "Volume 961" in paras[2]  # Partition scrutiny
    assert "5035/2012" in paras[3]  # GPA
    assert "equitable mortgage" in paras[4]  # Empowering clauses
    assert "Thensangampalayam Village" in paras[5]  # Revenue
    assert "derived title to the properties" in paras[6]  # Conclusion intact
    assert "Balashanmugam" in paras[6]


def test_complete_thirty_year_title_chain_synthesis():
    """
    Tests the end-to-end synthesis of a complete 30-year chain of title with
    antecedent 1987 conveyances, registration copy verification for handwritten corrections,
    1998 family partition, 2012 General Power of Attorney, VAO revenue mutation, and title conclusion.
    """
    fields = [
        HighlightedField(
            field_id="p14_note",
            original_text="(Tracing the party’s title for 30 years previous Regd. Title deed and intervening documents if any (e.g. transacting on power of attorney) to present document must be verified.)",
            paragraph_context="p14",
            context_with_marker="[FIELD: (Tracing the party’s title for 30 years previous Regd. Title deed and intervening documents if any (e.g. transacting on power of attorney) to present document must be verified.)]",
            location=FieldLocation(location_type="paragraph", paragraph_index=0, run_indices=[0]),
            formatting=FieldFormatting(),
            is_table_cell=False
        ),
        HighlightedField(
            field_id="p15_root",
            original_text="The properties in S.F.No.74/B, 75, and 76/2 measuring an extent of 6.11 Acres situated at Thensangampalayam Village originally formed part of the ancestral and joint family properties of Kalimuthu Chettiyar and his family members. Subsequently, the co-sharers divided the properties under the registered Partition deed dated 08.10.1998 and the same was registered as Document No.1773/1998 in the office of Sub-Registrar, Anaimalai. As per the recital of Partition deed, Balashanmugam, S/o Kalimuthu Chettiyar was allotted \"E\" schedule properties which include the properties in S.F.No.74/B, 75, and 76/2 measuring an extent of 6.11 Acres along with other properties and he was put into possession and enjoyment of the properties as its absolute owner. The Photo Copy of the Partition deed is herewith produced.",
            paragraph_context="p15",
            context_with_marker="[FIELD: Partition Deed 1773/1998]",
            location=FieldLocation(location_type="paragraph", paragraph_index=1, run_indices=[0]),
            formatting=FieldFormatting(),
            is_table_cell=False
        ),
        HighlightedField(
            field_id="p16_corr1",
            original_text="Since one hand written correction was made in Page No.13 of Original Sale deed dated 05.05.1987 and the same was registered as Document No:1277/1987, the applicant has herewith produced Registration Copy of the Sale deed dated 05.05.1987 and the same was registered as Document No:1277/1987 to prove the genuineness of the document and same is found correct and valid.",
            paragraph_context="p16",
            context_with_marker="[FIELD: Correction Page 13 Doc 1277/1987]",
            location=FieldLocation(location_type="paragraph", paragraph_index=2, run_indices=[0]),
            formatting=FieldFormatting(),
            is_table_cell=False
        ),
        HighlightedField(
            field_id="p17_gpa",
            original_text="Subsequently, the said absolute owner Balashanmugam along with his legal heirs executed a registered General Power of Attorney on 10.12.2012, registered as Document No: 5035/2012 in the office of the Sub-Registrar, Anaimalai. As per the recitals and empowering clauses of the said General Power of Attorney deed, the said co-owners jointly appointed Senthilraja, S/o Balashanmugam as their lawful Power Agent to manage the properties and create equitable mortgage in favour of Banks as security for credit facilities.",
            paragraph_context="p17",
            context_with_marker="[FIELD: GPA 5035/2012]",
            location=FieldLocation(location_type="paragraph", paragraph_index=3, run_indices=[0]),
            formatting=FieldFormatting(),
            is_table_cell=False
        ),
        HighlightedField(
            field_id="p18_corr2",
            original_text="Since one hand written correction was made in Page No.5 of Original Sale deed dated 16.11.1987 and the same was registered as Document No:2860/1987, the applicant has herewith produced Registration Copy of the Sale deed dated 16.11.1987 and the same was registered as Document No:2860/1987 to prove the genuineness of the document and same is found correct and valid.",
            paragraph_context="p18",
            context_with_marker="[FIELD: Correction Page 5 Doc 2860/1987]",
            location=FieldLocation(location_type="paragraph", paragraph_index=4, run_indices=[0]),
            formatting=FieldFormatting(),
            is_table_cell=False
        ),
        HighlightedField(
            field_id="p19_revenue",
            original_text="Following the acquisition and power creation, the revenue records in respect of the properties comprised in S.F.No.74/B, 75, and 76/2 measuring an extent of 6.11 Acres situated at Thensangampalayam Village have been duly mutated. Computerized Patta, Chitta, Adangal, and Possession Certificate issued by the Village Administrative Officer (VAO), Thensangampalayam Village, Pollachi Taluk have been verified and confirm that the title holders through their lawful Power Agent remain in continuous, exclusive, peaceful, and undisturbed physical possession, cultivation, and enjoyment of the properties as its absolute owner.",
            paragraph_context="p19",
            context_with_marker="[FIELD: VAO Revenue Mutation & Possession]",
            location=FieldLocation(location_type="paragraph", paragraph_index=5, run_indices=[0]),
            formatting=FieldFormatting(),
            is_table_cell=False
        ),
        HighlightedField(
            field_id="p20_conc",
            original_text="Thus the title holder Balashanmugam, S/o Kalimuthu Chettiyar derived title to the properties.",
            paragraph_context="p20",
            context_with_marker="[FIELD: Thus the title holder Balashanmugam, S/o Kalimuthu Chettiyar derived title to the properties.]",
            location=FieldLocation(location_type="paragraph", paragraph_index=6, run_indices=[0]),
            formatting=FieldFormatting(),
            is_table_cell=False
        ),
    ]

    # Source documents containing the complete 30-year chain
    txt = "1773/1998 5035/2012 Balashanmugam Senthilraja Kalimuthu Chettiyar 6.11 Acres Thensangampalayam Anaimalai VAO Chitta Patta Adangal"
    sources = [
        ExtractedSourceDocument(
            filename="Complete_Chain_Doc.pdf",
            file_type="pdf",
            full_text=txt,
            char_count=len(txt),
            page_or_section_count=10
        )
    ]

    extraction = mock_heuristic_extractor(fields, [], sources, preferred_deed_model="normal_partition")
    val_map = {r.field_id: r.value for r in extraction.fields}

    # All 7 paragraphs must be fully populated with legal narratives matching template
    assert val_map["p14_note"] == fields[0].original_text
    assert "Partition deed dated 08.10.1998" in val_map["p15_root"]
    assert "Volume 961" in val_map["p16_corr1"] and "found genuine" in val_map["p16_corr1"]
    assert "5035/2012" in val_map["p17_gpa"] and "Senthilraja" in val_map["p17_gpa"]
    assert "equitable mortgage" in val_map["p18_corr2"] and "in full force and effect" in val_map["p18_corr2"]
    assert "revenue records" in val_map["p19_revenue"] and "Village Administrative Officer" in val_map["p19_revenue"]
    assert "Thus the title holder Balashanmugam, S/o Kalimuthu Chettiyar derived title to the properties." in val_map["p20_conc"]


def test_arbitrary_different_document_dynamic_extraction_and_replacement():
    """
    Verifies that when a completely different document is uploaded
    (e.g., K. Ramasamy in Somandurai Village, S.F.No. 185/2 and 186/3, measuring 3.50 Acres,
    registered as Doc No. 4321/2016 at SRO Pollachi):
    1. Legal entities are dynamically extracted from the document text.
    2. Section 2 trace paragraphs are populated with K. Ramasamy, Somandurai, 185/2, 3.50 Acres, Doc 4321/2016.
    3. Exactly 0 occurrences of Balashanmugam, Kalimuthu, Senthilraja, Doc 1773, Doc 5035, Doc 1277, Doc 2860, Gopalan, or Muthulakshmi appear.
    4. Deterministic Word doc replacement replaces all template paragraphs cleanly.
    """
    import docx
    from io import BytesIO
    from backend.app.core.ai_extractor import (
        mock_heuristic_extractor,
        extract_legal_entities_from_text,
        classify_field
    )
    from backend.app.core.doc_processor import apply_field_values_to_template

    doc_text = """
    பதிவு ஆவணம் எண்: 4321/2016
    நாள்: 15.07.2016
    சார்பதிவாளர் அலுவலகம்: Pollachi Sub-Registrar Office
    சொத்து விபரம்:
    பொள்ளாச்சி வட்டம், சோமந்துறை கிராமம் (Somandurai Village),
    பழைய சர்வே எண்: 185/2 மற்றும் 186/3
    விஸ்தீரணம்: 3.50 Acres (3 ஏக்கர் 50 சென்ட்)
    சொத்து உரிமை பெற்றவர்: K. Ramasamy, S/o Kandasamy Gounder
    முந்தைய உரிமையாளர்: Kandasamy Gounder
    பாகப்பிரிவினை ஆவணம் மூலம் கே. ராமசாமி அவர்களுக்கு ஒதுக்கப்பட்டது.
    வருவாய் ஆவணங்கள் பட்டா எண் 432/2016 கே. ராமசாமி பெயரில் உள்ளது.
    """

    # 1. Test entity extractor
    entities = extract_legal_entities_from_text(doc_text)
    assert entities.get("doc_no") == "4321"
    assert entities.get("year") == "2016"
    assert entities.get("date") == "15.07.2016"
    assert "185/2" in (entities.get("sf_nos") or "")
    assert "3.50" in (entities.get("extent") or "")
    assert "Somandurai" in (entities.get("village") or "")
    assert "Pollachi" in (entities.get("sro") or "")
    assert "Ramasamy" in (entities.get("borrower") or "")

    # 2. Test multi-paragraph extraction on template fields
    fields = [
        HighlightedField(
            field_id="p1_intro",
            original_text="(Tracing the party’s title for 30 years previous Regd. Title deed and intervening documents if any (e.g. transacting on power of attorney) to present document must be verified.)",
            paragraph_context="p1",
            context_with_marker="[FIELD: intro]",
            location=FieldLocation(location_type="paragraph", paragraph_index=0, run_indices=[0]),
            formatting=FieldFormatting(),
            is_table_cell=False
        ),
        HighlightedField(
            field_id="p2_root",
            original_text="The properties in S.F.No.245/1B measuring an extent of 0.16 Acres originally belonged to Murugesan... registered as Document No:1277/1987...",
            paragraph_context="p2",
            context_with_marker="[FIELD: root]",
            location=FieldLocation(location_type="paragraph", paragraph_index=1, run_indices=[0]),
            formatting=FieldFormatting(),
            is_table_cell=False
        ),
        HighlightedField(
            field_id="p3_corr1",
            original_text="Since one hand written correction was made in Page No.13 of Original Sale deed dated 05.05.1987...",
            paragraph_context="p3",
            context_with_marker="[FIELD: corr1]",
            location=FieldLocation(location_type="paragraph", paragraph_index=2, run_indices=[0]),
            formatting=FieldFormatting(),
            is_table_cell=False
        ),
        HighlightedField(
            field_id="p4_subseq",
            original_text="Subsequently the said Murugesan sold the properties in S.F.No.245/3A2 measuring an extent of 2.57 Acres to Gopalan under the registered Sale deed dated 16.11.1987...",
            paragraph_context="p4",
            context_with_marker="[FIELD: subseq]",
            location=FieldLocation(location_type="paragraph", paragraph_index=3, run_indices=[0]),
            formatting=FieldFormatting(),
            is_table_cell=False
        ),
        HighlightedField(
            field_id="p5_corr2",
            original_text="Since one hand written correction was made in Page No.5 of Original Sale deed dated 16.11.1987...",
            paragraph_context="p5",
            context_with_marker="[FIELD: corr2]",
            location=FieldLocation(location_type="paragraph", paragraph_index=4, run_indices=[0]),
            formatting=FieldFormatting(),
            is_table_cell=False
        ),
        HighlightedField(
            field_id="p6_will",
            original_text="Subsequently the said Gopalan executed a registered Will on 21.10.2023 and the same was registered as Document No.387/BK3/2023...",
            paragraph_context="p6",
            context_with_marker="[FIELD: will]",
            location=FieldLocation(location_type="paragraph", paragraph_index=5, run_indices=[0]),
            formatting=FieldFormatting(),
            is_table_cell=False
        ),
        HighlightedField(
            field_id="p7_conc",
            original_text="Thus the title holder K.MUTHULAKSHMI, W/o G.Kumar derived title to the properties.",
            paragraph_context="p7",
            context_with_marker="[FIELD: conc]",
            location=FieldLocation(location_type="paragraph", paragraph_index=6, run_indices=[0]),
            formatting=FieldFormatting(),
            is_table_cell=False
        ),
    ]

    sources = [
        ExtractedSourceDocument(
            filename="Ramasamy_Partition_4321.pdf",
            file_type="pdf",
            full_text=doc_text,
            char_count=len(doc_text),
            page_or_section_count=1
        )
    ]

    extraction = mock_heuristic_extractor(fields, [], sources, preferred_deed_model="normal_partition")
    val_map = {r.field_id: r.value for r in extraction.fields}

    # Verify intro preserved
    assert val_map["p1_intro"] == fields[0].original_text

    # Verify root deed paragraph has Ramasamy, Somandurai, 185/2, 3.50 Acres
    p2 = val_map["p2_root"]
    assert "Ramasamy" in p2
    assert "Somandurai" in p2
    assert "185/2" in p2
    assert "3.50 Acres" in p2
    assert "4321" in p2

    # Verify intermediate paragraphs are dynamically populated
    all_body_text = " ".join([val_map["p2_root"], val_map["p3_corr1"], val_map["p4_subseq"], val_map["p5_corr2"], val_map["p6_will"]])
    assert "Ramasamy" in all_body_text
    assert "Somandurai" in all_body_text
    assert "185/2" in all_body_text

    # Verify conclusion
    assert "Thus the title holder" in val_map["p7_conc"]
    assert "Ramasamy" in val_map["p7_conc"]

    # Strictly verify zero leakage of Balashanmugam or Muthulakshmi/Gopalan
    for forbidden in ["Balashanmugam", "Kalimuthu", "Senthilraja", "1773/1998", "5035/2012", "Thensangampalayam", "Muthulakshmi", "Gopalan", "1277/1987", "2860/1987", "hand written correction"]:
        assert forbidden not in all_body_text, f"Leaked forbidden string '{forbidden}' in body paragraphs!"

    # 3. Verify deterministic Word doc replacement replaces all template paragraphs cleanly
    doc = docx.Document()
    for f in fields:
        p = doc.add_paragraph()
        r = p.add_run(f.original_text)
        r.font.highlight_color = docx.enum.text.WD_COLOR_INDEX.YELLOW

    buf = BytesIO()
    doc.save(buf)

    out_bio = apply_field_values_to_template(
        template_source=buf.getvalue(),
        fields=fields,
        field_values=val_map,
        clear_highlight=True
    )

    gen_doc = docx.Document(out_bio)
    all_gen_text = "\n".join(p.text for p in gen_doc.paragraphs)

    assert "Ramasamy" in all_gen_text
    assert "Somandurai" in all_gen_text
    assert "185/2" in all_gen_text
    assert "3.50 Acres" in all_gen_text
    assert "4321" in all_gen_text
    assert "Thus the title holder K. Ramasamy, S/o Kandasamy Gounder derived title" in all_gen_text

    for forbidden in ["Balashanmugam", "Kalimuthu", "Senthilraja", "1773/1998", "5035/2012", "Thensangampalayam", "Muthulakshmi", "Gopalan", "1277/1987", "2860/1987", "hand written correction"]:
        assert forbidden not in all_gen_text, f"Generated doc leaked forbidden string '{forbidden}'!"


def test_strip_land_price_from_trace():
    from backend.app.core.deed_models import strip_land_price_from_trace, generate_multi_paragraph_trace

    sample_with_rtgs = (
        "registered as Document No.1931/2026 in Book 1 in the office of the Sub-Registrar of Komangalam "
        "for a valuable sale consideration of Rs.10,30,000/- (Rupees Ten Lakhs Thirty Thousand only) "
        "transferred via RTGS from Bank of Baroda to ICICI Bank. As per the recitals, possession was handed over."
    )
    cleaned = strip_land_price_from_trace(sample_with_rtgs)
    assert "Rs." not in cleaned
    assert "10,30,000" not in cleaned
    assert "Rupees Ten Lakhs" not in cleaned
    assert "RTGS" not in cleaned
    assert "for a valuable sale consideration" in cleaned
    assert "possession was handed over" in cleaned

    sample_with_kist = "measuring an extent of 0.52.0 Hectare (1.28 Acres) with an annual kist of Rs.1.44. Continuous possession."
    cleaned_kist = strip_land_price_from_trace(sample_with_kist)
    assert "Rs.1.44" not in cleaned_kist
    assert "annual kist duly assessed" in cleaned_kist

    # Verify generate_multi_paragraph_trace produces no prices across any deed model
    paras = generate_multi_paragraph_trace("sale_deed", paragraph_count=5)
    for p in paras:
        assert "Rs." not in p
        assert "INR" not in p
        assert "/-" not in p



