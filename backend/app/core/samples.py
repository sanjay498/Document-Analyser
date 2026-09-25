"""
Doc Filler AI - Sample Template and Multi-Source Generator (Phase 2)
Generates realistic sample .docx templates with yellow-highlighted dynamic fields
and variable-length dynamic tables, along with multiple source documents that trigger
multi-source conflict detection and multi-record table population.
"""

from io import BytesIO
from docx import Document
from docx.enum.text import WD_COLOR_INDEX, WD_ALIGN_PARAGRAPH
from docx.shared import Pt, Inches, RGBColor


def generate_sample_template() -> BytesIO:
    """
    Generates a Master Services Agreement (MSA) .docx with yellow highlights in both
    paragraphs and a dynamic milestone items table.
    """
    doc = Document()

    # Title
    p_title = doc.add_paragraph()
    p_title.paragraph_format.space_before = Pt(0)
    p_title.paragraph_format.space_after = Pt(12)
    r_title = p_title.add_run("MASTER SERVICES AGREEMENT & STATEMENT OF WORK")
    r_title.bold = True
    r_title.font.size = Pt(18)
    r_title.font.name = "Calibri"

    # Intro Paragraph
    p_intro = doc.add_paragraph("This Master Services Agreement (the \"Agreement\") is entered into and made effective as of ")
    r_date = p_intro.add_run("January 15, 2026")
    r_date.font.highlight_color = WD_COLOR_INDEX.YELLOW
    r_date.bold = True
    p_intro.add_run(" (the \"Effective Date\"), by and between ")
    r_client = p_intro.add_run("Nexus Enterprise Solutions LLC")
    r_client.font.highlight_color = WD_COLOR_INDEX.YELLOW
    r_client.bold = True
    p_intro.add_run(", a corporation having its principal place of business at ")
    r_address = p_intro.add_run("100 Innovation Way, Suite 400, Austin, TX 78701")
    r_address.font.highlight_color = WD_COLOR_INDEX.YELLOW
    p_intro.add_run(" (\"Client\"), and ")
    r_vendor = p_intro.add_run("Apex Cloud Dynamics Inc.")
    r_vendor.font.highlight_color = WD_COLOR_INDEX.YELLOW
    r_vendor.bold = True
    p_intro.add_run(", (\"Service Provider\").")

    # Section 1: Scope
    p_s1 = doc.add_paragraph()
    r_s1_h = p_s1.add_run("1. SCOPE OF SERVICES & PROJECT DESCRIPTION")
    r_s1_h.bold = True
    
    p_s1_b = doc.add_paragraph("Service Provider agrees to deliver enterprise services consisting of ")
    r_scope = p_s1_b.add_run("Cloud Infrastructure Modernization and Kubernetes Migration")
    r_scope.font.highlight_color = WD_COLOR_INDEX.YELLOW
    r_scope.italic = True
    p_s1_b.add_run(" in accordance with the Statement of Work.")

    # Section 2: Compensation & Payment Terms
    p_s2 = doc.add_paragraph()
    r_s2_h = p_s2.add_run("2. COMPENSATION AND PAYMENT TERMS")
    r_s2_h.bold = True

    p_s2_b = doc.add_paragraph("As total compensation for the initial milestone, Client shall pay a fee of ")
    r_fee = p_s2_b.add_run("$145,000 USD")
    r_fee.font.highlight_color = WD_COLOR_INDEX.YELLOW
    r_fee.bold = True
    p_s2_b.add_run(" payable within ")
    r_terms = p_s2_b.add_run("30 days")
    r_terms.font.highlight_color = WD_COLOR_INDEX.YELLOW
    p_s2_b.add_run(" of invoice receipt.")

    # Section 3: Dynamic Table of Milestones & Deliverables
    p_s3 = doc.add_paragraph()
    r_s3_h = p_s3.add_run("3. PROJECT MILESTONES & DELIVERABLE SCHEDULE (DYNAMIC TABLE)")
    r_s3_h.bold = True

    # Table with Header Row (Row 0) and Dynamic Template Row (Row 1)
    milestone_table = doc.add_table(rows=2, cols=4)
    milestone_table.style = 'Table Grid'

    headers = ["Milestone #", "Deliverable Description", "Completion Date", "Milestone Fee"]
    for idx, text in enumerate(headers):
        cell = milestone_table.cell(0, idx)
        p = cell.paragraphs[0]
        r = p.add_run(text)
        r.bold = True
        r.font.name = "Calibri"

    # Template Row (Highlighted in Yellow)
    template_row = milestone_table.rows[1]
    
    c0 = template_row.cells[0].paragraphs[0].add_run("M-1")
    c0.font.highlight_color = WD_COLOR_INDEX.YELLOW
    c0.bold = True

    c1 = template_row.cells[1].paragraphs[0].add_run("Automated Genomic Pipeline AI & HIPAA Data Lake")
    c1.font.highlight_color = WD_COLOR_INDEX.YELLOW
    c1.italic = True

    c2 = template_row.cells[2].paragraphs[0].add_run("2026-10-30")
    c2.font.highlight_color = WD_COLOR_INDEX.YELLOW

    c3 = template_row.cells[3].paragraphs[0].add_run("$110,000 USD")
    c3.font.highlight_color = WD_COLOR_INDEX.YELLOW
    c3.bold = True

    # Section 4: Governing Law
    p_s4 = doc.add_paragraph()
    r_s4_h = p_s4.add_run("4. GOVERNING LAW AND JURISDICTION")
    r_s4_h.bold = True

    p_s4_b = doc.add_paragraph("This Agreement shall be governed by, and construed in accordance with, the laws of the ")
    r_law = p_s4_b.add_run("State of Delaware")
    r_law.font.highlight_color = WD_COLOR_INDEX.YELLOW
    p_s4_b.add_run(", without regard to its conflict of law principles.")

    # Section 5: Notice Details Table
    p_s5 = doc.add_paragraph()
    r_s5_h = p_s5.add_run("5. FORMAL NOTICE CONTACTS")
    r_s5_h.bold = True

    notice_table = doc.add_table(rows=3, cols=2)
    notice_table.style = 'Table Grid'
    
    notice_table.cell(0, 0).paragraphs[0].text = "Party"
    notice_table.cell(0, 0).paragraphs[0].runs[0].bold = True
    notice_table.cell(0, 1).paragraphs[0].text = "Designated Email for Legal Notices"
    notice_table.cell(0, 1).paragraphs[0].runs[0].bold = True

    notice_table.cell(1, 0).paragraphs[0].text = "Client Contact"
    cp1 = notice_table.cell(1, 1).paragraphs[0]
    r_c_email = cp1.add_run("legal@nexusenterprise.com")
    r_c_email.font.highlight_color = WD_COLOR_INDEX.YELLOW

    notice_table.cell(2, 0).paragraphs[0].text = "Service Provider Contact"
    cp2 = notice_table.cell(2, 1).paragraphs[0]
    r_v_email = cp2.add_run("contracts@apexclouddynamics.io")
    r_v_email.font.highlight_color = WD_COLOR_INDEX.YELLOW

    bio = BytesIO()
    doc.save(bio)
    bio.seek(0)
    return bio


def generate_sample_source_doc_1() -> BytesIO:
    """
    Source Document 1: Primary Deal Intake Sheet & Statement of Work.
    """
    doc = Document()
    doc.add_heading("Primary SOW & Intake Memorandum", level=1)
    doc.add_paragraph("CONFIDENTIAL DEAL MEMORANDUM\nPrimary Document: SOW-2026-A\n")

    doc.add_heading("1. Counterparty Identification", level=2)
    doc.add_paragraph(
        "Client Legal Name: Horizon BioTech Solutions Inc.\n"
        "Headquarters Address: 742 Evergreen Terrace, Suite 800, Seattle, WA 98101\n"
        "Client Notice Contact: notices@horizonbiotech.com\n"
        "Effective Date: October 1, 2026\n"
    )

    doc.add_heading("2. Vendor Details", level=2)
    doc.add_paragraph(
        "Service Provider: Velocity AI Systems Corp.\n"
        "Notice Contact: legal-dept@velocityaisystems.com\n"
    )

    doc.add_heading("3. Project Scope & Commercial Terms", level=2)
    doc.add_paragraph(
        "Agreed Project Scope: Automated Genomic Pipeline AI & HIPAA-Compliant Data Lake Deployment\n"
        "Initial Milestone Budget: $280,000 USD\n"
        "Payment Terms: 30 days net from milestone sign-off\n"
        "Governing Law: State of Washington\n"
    )

    doc.add_heading("4. Detailed Milestone Schedule", level=2)
    doc.add_paragraph(
        "Milestone 1: Phase 1: Automated Genomic Pipeline AI Architecture - Date: October 30, 2026 - Fee: $110,000 USD\n"
        "Milestone 2: Phase 2: HIPAA-Compliant Data Lake Deployment - Date: December 15, 2026 - Fee: $95,000 USD\n"
        "Milestone 3: Phase 3: Clinical Validation & FDA 21 CFR Part 11 Audit - Date: February 28, 2027 - Fee: $75,000 USD\n"
    )

    bio = BytesIO()
    doc.save(bio)
    bio.seek(0)
    return bio


def generate_sample_source_doc_2() -> BytesIO:
    """
    Source Document 2: Vendor Proposal Addendum.
    Contains a CONFLICTING Payment Term ("60 days net" vs "30 days net")
    to demonstrate multi-source conflict detection!
    """
    doc = Document()
    doc.add_heading("Vendor Proposal Addendum & Commercial Rider", level=1)
    doc.add_paragraph("CONFIDENTIAL ADDENDUM\nDocument: Vendor_RFP_Addendum.docx\n")

    doc.add_heading("1. Commercial Rider", level=2)
    doc.add_paragraph(
        "Client Legal Name: Horizon BioTech Solutions Inc.\n"
        "Service Provider: Velocity AI Systems Corp.\n"
        "Agreed Payment Terms: 60 days net upon milestone invoice delivery.\n"
        "Initial Milestone Fee: $280,000 USD\n"
    )

    bio = BytesIO()
    doc.save(bio)
    bio.seek(0)
    return bio


def generate_sample_tamil_source_doc() -> BytesIO:
    """
    Source Document: Tamil Language Statement of Work & Project Intake Sheet (தமிழ் ஒப்பந்த குறிப்பு).
    Contains full project specifications, commercial terms, and milestone tables in Tamil.
    """
    doc = Document()
    doc.add_heading("முதன்மை திட்ட ஒப்பந்தம் மற்றும் திட்ட வரைவு (Statement of Work)", level=1)
    doc.add_paragraph("இரகசிய வர்த்தக ஆவணம் (CONFIDENTIAL DEAL MEMORANDUM)\nஆவண எண்: SOW-2026-TAMIL-01\n")

    doc.add_heading("1. நிறுவனங்கள் மற்றும் தரப்பினர் விவரம் (Counterparty Identification)", level=2)
    doc.add_paragraph(
        "வாடிக்கையாளர் சட்டப்பூர்வ பெயர்: ஹொரைசன் பயோடெக் சொல்யூஷன்ஸ்\n"
        "தலைமையக முகவரி: 100 அண்ணா சாலை, சூட் 400, சென்னை, தமிழ்நாடு 600002\n"
        "வாடிக்கையாளர் அறிவிப்பு மின்னஞ்சல்: notices@horizonbiotech.com\n"
        "செயல்படும் தேதி: அக்டோபர் 15, 2026\n"
    )

    doc.add_heading("2. சேவை வழங்குநர் விவரம் (Vendor Details)", level=2)
    doc.add_paragraph(
        "சேவை வழங்குநர்: வெலாசிட்டி ஏஐ சிஸ்டம்ஸ் கார்ப்பரேஷன்\n"
        "சேவை வழங்குநர் சட்டப்பிரிவு மின்னஞ்சல்: legal-dept@velocityaisystems.com\n"
    )

    doc.add_heading("3. திட்ட நோக்கம் மற்றும் வர்த்தக விதிமுறைகள் (Project Scope & Commercial Terms)", level=2)
    doc.add_paragraph(
        "திட்ட நோக்கம்: தானியங்கி மரபணு குழாய் ஏஐ மற்றும் ஹிப்பா தரவு ஏரி வரிசைப்படுத்தல்\n"
        "தொடக்க கட்டணம்: $280,000 USD\n"
        "பணம் செலுத்தும் காலக்கெடு: 30 நாட்கள்\n"
        "ஆளுகை சட்டம்: தமிழ்நாடு மாநிலம்\n"
    )

    doc.add_heading("4. விரிவான மைல்கல் மற்றும் விநியோக அட்டவணை (Detailed Milestone Schedule)", level=2)
    doc.add_paragraph(
        "மைல்கல் 1: தானியங்கி மரபணு குழாய் ஏஐ கட்டமைப்பு - தேதி: அக்டோபர் 30, 2026 - கட்டணம்: $110,000 USD\n"
        "மைல்கல் 2: ஹிப்பா தரவு ஏரி வரிசைப்படுத்தல் - தேதி: டிசம்பர் 15, 2026 - கட்டணம்: $95,000 USD\n"
        "மைல்கல் 3: மருத்துவ சரிபார்ப்பு மற்றும் எஃப்டிஏ தணிக்கை - தேதி: பிப்ரவரி 28, 2027 - கட்டணம்: $75,000 USD\n"
    )

    bio = BytesIO()
    doc.save(bio)
    bio.seek(0)
    return bio


def generate_sample_tamil_addendum_doc() -> BytesIO:
    """
    Source Document: Tamil Vendor Proposal Addendum with Conflicting Terms (60 நாட்கள் vs 30 நாட்கள்).
    """
    doc = Document()
    doc.add_heading("விற்பனையாளர் முன்மொழிவு திருத்த ஆவணம் (Vendor Proposal Addendum)", level=1)
    doc.add_paragraph("இரகசிய திருத்த ஆவணம் (CONFIDENTIAL ADDENDUM)\nஆவணம்: Vendor_Tamil_Addendum.docx\n")

    doc.add_heading("1. திருத்தப்பட்ட வர்த்தக விதிமுறைகள்", level=2)
    doc.add_paragraph(
        "வாடிக்கையாளர் சட்டப்பூர்வ பெயர்: ஹொரைசன் பயோடெக் சொல்யூஷன்ஸ்\n"
        "சேவை வழங்குநர்: வெலாசிட்டி ஏஐ சிஸ்டம்ஸ் கார்ப்பரேஷன்\n"
        "பணம் செலுத்தும் காலக்கெடு: 60 நாட்கள்\n"
        "தொடக்க கட்டணம்: $280,000 USD\n"
    )

    bio = BytesIO()
    doc.save(bio)
    bio.seek(0)
    return bio


def generate_sample_tamil_title_deed_doc() -> BytesIO:
    """
    Source Document: Tamil General Power of Attorney & Partition Deed (DOC 2001.pdf / DOC_2001_Tamil_Title_Deed.docx).
    Contains:
    - Registered General Power of Attorney Doc No. 5035/2012 at Anaimalai SRO dated 10.12.2012
    - Parent registered Partition Deed Doc No. 1773/1998 at Anaimalai SRO dated 08.10.1998 (Book 1 Vol 961 Pages 113-124 'E' Schedule)
    - Parties: Balashanmugam, Premalatha, Karpagalakshmi, Padmapriya in favour of Senthilraja
    - Property: Coimbatore District, Pollachi Taluk, Thensangampalayam Village, S.F.No. 74/B (3.73 Acres), S.F.No. 75 (0.64 Acres), S.F.No. 76/2 (1.74 Acres) = Total 6.11 Acres.
    """
    doc = Document()
    doc.add_heading("பொது அதிகார ஆவணம் (General Power of Attorney)", level=1)
    doc.add_paragraph(
        "ஆவண எண்: 5035/2012 | பதிவு நாள்: 10-12-2012 (தமிழ் நந்தன வருடம் கார்த்திகை 25 ஆம் தேதி)\n"
        "சார்பதிவாளர் அலுவலகம்: ஆனைமலை\n"
        "பதிவு மாவட்டம்: கோயம்புத்தூர் | வட்டம்: பொள்ளாச்சி | கிராமம்: தென்சங்கம்பாளையம்\n"
    )

    doc.add_heading("1. எழுதி வாங்குபவர் (Power Agent)", level=2)
    doc.add_paragraph(
        "பாலசண்முகம் அவர்களின் குமாரர் செந்தில்ராஜா, அன்னை இந்திரா இல்லம், கதவு எண்.6, விநாயகர் கோவில் வீதி, கோட்டூர் கிராமம், பொள்ளாச்சி வட்டம். (குடும்ப அட்டை எண்: 13/G/1328341)\n"
    )

    doc.add_heading("2. எழுதிக்கொடுத்தவர்கள் (Principals / Co-owners)", level=2)
    doc.add_paragraph(
        "1. பாலசண்முகம், த/பெ. காளிமுத்து செட்டியார் (குடும்ப அட்டை எண்: 13/G/1416780)\n"
        "2. பிரேமலதா, க/பெ. ஆறுமுகம் (வாக்காளர் அட்டை எண்: UYU0139402)\n"
        "3. கற்பகலக்ஷ்மி, க/பெ. சக்திவேல் (வாக்காளர் அட்டை எண்: UYU0367532)\n"
        "4. பத்மபிரியா, க/பெ. முருகானந்தம் (வாக்காளர் அட்டை எண்: GHN3311131)\n"
        "நீங்கள் எங்களில் 1 லக்கமிட்டவருக்கு மகனும், 2 முதல் 4 வரை லக்கமிட்டவர்களுக்கு உடன்பிறந்த சகோதரனும் ஆக வேண்டும்.\n"
    )

    doc.add_heading("3. மூல ஆவண வரலாறு மற்றும் பாத்தியதை (Trace of Title & Partition Deed Recital)", level=2)
    doc.add_paragraph(
        "இப்பவும் இதனடியில் கண்ட சொத்தானது கடந்த 08-10-1998 தேதியில் ஆனைமலை சார்பதிவகத்தில் 1 புத்தகம் 961 தொகுதி 113 முதல் 124 வரை பக்கங்களில் 1998 ஆம் வருடத்திய 1773 ஆம் எண்ணாகப் பதிவாகியுள்ள பாகப் பத்திரப்படி 'E' ஷெட்யூலாக எங்களில் 1 லக்கமிட்ட பாலசண்முகம் அவர்களுக்கு பாத்தியப்பட்டதும், எங்களில் 2 முதல் 4 வரை லக்கமிட்டவர்களுக்கும் உங்களுக்கும் இந்து வாரிசுரிமைச் சட்டப்படி பிதுரார்ஜித பூர்வீக வகையில் பாத்தியப்பட்டதும் ஆகும். இதில் 5ல் 4 பங்கு சொத்துக்களை நிர்வாகம் செய்யவும், கிரைய உடன்படிக்கைகள் செய்யவும், கிரையப் பத்திரம் பதிவு செய்யவும், பட்டா மாறுதல் செய்யவும், அடமான ஆவணங்கள் செய்யவும் பொது அதிகார முகவராக நியமித்து எழுதிக்கொடுத்த பொது அதிகார ஆவணம் ஆகும்.\n"
    )

    doc.add_heading("4. சொத்தின் விவரம் மற்றும் எல்லைகள் (Property Schedule & Boundaries)", level=2)
    doc.add_paragraph(
        "கோவை பதிவு மாவட்டம், ஆனைமலை சார்பதிவக எல்லைக்குட்பட்ட பொள்ளாச்சி வட்டம், தென்சங்கம்பாளையம் கிராமத்தில்:\n"
        "1. க.ச.74/B பு.ஏ.4.76ல் இதில் பு.ஏ.3.73 ஏக்கர் (வடக்கு: மெயின் ரோடு, கிழக்கு: வேணுகோபால் பூமி, தெற்கு: க.ச.83, 76/2, 75, மேற்கு: க.ச.75 ஆறுமுகம் பூமி).\n"
        "2. க.ச.75 பு.ஏ.2.47ல் இதில் பு.ஏ.0.64 ஏக்கர் (வடக்கு & கிழக்கு: க.ச.74/B, மேற்கு: ஆறுமுகம் பூமி, தெற்கு: க.ச.72).\n"
        "3. க.ச.76/2 பு.ஏ.2.59ல் இதில் பு.ஏ.1.74 ஏக்கர் (வடக்கு: க.ச.74/B, 75, கிழக்கு: க.ச.93, தெற்கு: க.ச.76/1, மேற்கு: ஆறுமுகம் பூமி 0.86 ஏக்கர்).\n"
        "ஆக மொத்தம் பு.ஏ.6.11 ஏக்கர் (6.11 Acres) விஸ்தீரணமுள்ள புஞ்சை பூமியும், பொது வண்டிப்பாதை மற்றும் கிணற்று பாத்தியங்களும்.\n"
    )

    bio = BytesIO()
    doc.save(bio)
    bio.seek(0)
    return bio


def generate_legal_opinion_title_report_template() -> BytesIO:
    """
    Generates the Bank of Maharashtra Legal Opinion & Title Search Report template (.docx)
    with all dynamic placeholders and narrative clauses highlighted in YELLOW per user requirements.
    """
    doc = Document()

    # Document Header & Date
    p_date = doc.add_paragraph()
    p_date.paragraph_format.space_after = Pt(6)
    p_date.add_run("Date: ")
    r_date = p_date.add_run("08.07.2026")
    r_date.font.highlight_color = WD_COLOR_INDEX.YELLOW
    r_date.bold = True

    p_to = doc.add_paragraph()
    p_to.paragraph_format.space_after = Pt(12)
    p_to.add_run("To\nThe Branch Manager,\nBank of Maharashtra,\n")
    r_branch1 = p_to.add_run("Vanjiyapuram Pirivu Branch, Pollachi.")
    r_branch1.font.highlight_color = WD_COLOR_INDEX.YELLOW

    # Title / Subject
    p_sub = doc.add_paragraph()
    p_sub.paragraph_format.space_after = Pt(10)
    r_sub_h = p_sub.add_run("Legal opinion\nSub: Title report on properties owned by ")
    r_sub_h.bold = True
    r_borrower_sub = p_sub.add_run("K.MUTHULAKSHMI, W/o G.Kumar")
    r_borrower_sub.font.highlight_color = WD_COLOR_INDEX.YELLOW
    r_borrower_sub.bold = True

    p_names = doc.add_paragraph()
    p_names.paragraph_format.space_after = Pt(12)
    p_names.add_run("Name of the Branch: ")
    r_branch2 = p_names.add_run("Vanjiyapuram Pirivu Branch")
    r_branch2.font.highlight_color = WD_COLOR_INDEX.YELLOW
    p_names.add_run("\nName of the Borrower : ")
    r_borrower_main = p_names.add_run("K.MUTHULAKSHMI, W/o G.Kumar")
    r_borrower_main.font.highlight_color = WD_COLOR_INDEX.YELLOW
    r_borrower_main.bold = True

    # Description of Documents scrutinized
    doc.add_heading("Description of Documents scrutinized:", level=2)
    t_docs = doc.add_table(rows=1, cols=6)
    t_docs.style = 'Table Grid'
    hdr_cells = t_docs.rows[0].cells
    hdr_titles = [
        "Sr. No.", "Date of Execution of Document", "Details of registration of Document / conveyance",
        "Place sub-regd., office", "Property falls under sub-registrar", "Remarks"
    ]
    for i, t in enumerate(hdr_titles):
        hdr_cells[i].text = t
        for p in hdr_cells[i].paragraphs:
            for r in p.runs:
                r.bold = True

    sample_doc_rows = [
        ("1.", "05.05.1987", "Sale deed executed by Murugesan in favour of Gopalan (Doc No.1277/1987)", "SRO Pollachi", "SRO Pollachi", "Original"),
        ("2.", "05.05.1987", "Sale deed executed by Murugesan in favour of Gopalan (Doc No.1277/1987)", "SRO Pollachi", "SRO Pollachi", "Registration copy"),
        ("3.", "16.11.1987", "Sale deed executed by Murugesan in favour of Gopalan (Doc.No.2860/1987)", "SRO Pollachi", "SRO Pollachi", "Original"),
        ("4.", "16.11.1987", "Sale deed executed by Murugesan in favour of Gopalan (Doc.No.2860/1987)", "SRO Pollachi", "SRO Pollachi", "Registration copy"),
        ("5.", "21.10.2023", "Will executed by Gopalan in favour of Muthulakshmi (Doc No.387/BK3/2023)", "SRO Pollachi", "SRO Pollachi", "Original"),
        ("6.", "21.10.2023", "Will executed by Gopalan in favour of Muthulakshmi (Doc No.387/BK3/2023)", "SRO Pollachi", "SRO Pollachi", "Registration Copy"),
        ("7.", "06.05.2025", "Death certificate of Gopalan", "--", "--", "Photo copy"),
        ("8.", "03.06.2026", "Possession certificate issued by Village Administrative Officer, Mannur Village, Pollachi Taluk.", "--", "--", "Original"),
        ("9.", "04.07.2026", "Computerized Chitta", "---", "---", "Online Copy"),
        ("10.", "03.07.2026", "Sketch", "--", "--", "Online Copy"),
        ("11.", "03.06.2026", "Topho Sketch", "--", "--", "True Copy"),
        ("12.", "03.06.2026", "Adangal", "--", "--", "True Copy"),
        ("13.", "01.07.2026", "Encumbrance certificate for period from 01.01.1987 to 25.06.2026 (ECA/Online/No.195476108/2026)", "SRO Pollachi", "SRO Pollachi", "SRO Digital Copy"),
    ]

    for r_data in sample_doc_rows:
        row_cells = t_docs.add_row().cells
        for col_idx, text_val in enumerate(r_data):
            p = row_cells[col_idx].paragraphs[0]
            run = p.add_run(text_val)
            if col_idx > 0:  # Highlight dynamic columns in yellow
                run.font.highlight_color = WD_COLOR_INDEX.YELLOW

    # Section 1) Description of Property/properties/Nature of title
    doc.add_heading("1) Description of Property/properties/Nature of title", level=2)
    t_prop = doc.add_table(rows=1, cols=8)
    t_prop.style = 'Table Grid'
    prop_headers = [
        "Sr. No.", "Name of the owner/ Mortgagor", "Extent of area(in acres/hec)",
        "Survey no/ Gut No./CST No. / House no.", "Is property leasehold/freehold/Govt.grant etc.",
        "Nature of property", "Location", "Boundaries"
    ]
    for i, t in enumerate(prop_headers):
        t_prop.rows[0].cells[i].text = t
        for p in t_prop.rows[0].cells[i].paragraphs:
            for r in p.runs:
                r.bold = True

    prop_rows = [
        ("01. (1st ITEM)", "K.MUTHULAKSHMI, W/o G.Kumar", "0.16 ACRES", "S.F.No. 245/1B", "Freehold", "Agri", "In Coimbatore South Registration District, In Pollachi Sub Registration District, In Pollachi Taluk, In Mannur Village", "Full Extent"),
        ("-Do-", "-Do-", "1.84 ACRES", "S.F.No. 245/3A2", "Freehold", "-Do-", "-Do-", "West of Below mentioned properties in 2nd Item, North of Properties belonging to Ammasai gounder, East of Properties in S.F.No.245/1B, South of Properties belonging to Kathirvel and others. Along with Well, 5 HP EMP Set, Service Connection, PAP Arani, Madai, Vaikkal rights, Mamool cart track rights and pathway rights."),
        ("01. (2ND ITEM)", "K.MUTHULAKSHMI, W/o G.Kumar", "2.57 ACRES", "S.F.No. 245/3A2", "Freehold", "Agri", "In Coimbatore South Registration District, In Pollachi Sub Registration District, In Pollachi Taluk, In Mannur Village", "North of Properties belonging to Ammasai gounder, East of Above mentioned properties measuring an extent of 1.84 Acres, South of Properties belonging to Kathirvel, West of Properties belonging to Nataraju gounder. Along with PAP Arani, Madai, Vaikkal rights, Mamool cart track rights."),
    ]

    for p_data in prop_rows:
        row_cells = t_prop.add_row().cells
        for col_idx, text_val in enumerate(p_data):
            p = row_cells[col_idx].paragraphs[0]
            run = p.add_run(text_val)
            if col_idx > 0:
                run.font.highlight_color = WD_COLOR_INDEX.YELLOW

    p_tot = doc.add_paragraph()
    p_tot.add_run("Thus Totally measuring an extent of ")
    r_tot = p_tot.add_run("4.57 Acres .")
    r_tot.font.highlight_color = WD_COLOR_INDEX.YELLOW
    r_tot.bold = True

    # Possession Certificate Table
    p_pos_h = doc.add_paragraph()
    r_pos_h = p_pos_h.add_run("AS PER POSSESSION CERTIFICATE")
    r_pos_h.bold = True
    t_pos = doc.add_table(rows=1, cols=2)
    t_pos.style = 'Table Grid'
    t_pos.rows[0].cells[0].text = "S.F.No."
    t_pos.rows[0].cells[1].text = "Extent"
    for c in t_pos.rows[0].cells:
        for p in c.paragraphs:
            for r in p.runs:
                r.bold = True
    pos_rows = [
        ("245/1B", "0.06.50 HEC"),
        ("345/3A2", "1.78.50 HEC"),
        ("TOTAL", "1.85.00 HEC")
    ]
    for sf, ext in pos_rows:
        row_c = t_pos.add_row().cells
        r_sf = row_c[0].paragraphs[0].add_run(sf)
        r_sf.font.highlight_color = WD_COLOR_INDEX.YELLOW
        r_e = row_c[1].paragraphs[0].add_run(ext)
        r_e.font.highlight_color = WD_COLOR_INDEX.YELLOW

    # Section 2) Trace of Title / History of Passing of title. Details of antecedent title deeds
    doc.add_heading("2) Trace of Title/ History of Passing of title. Details of antecedent title deeds", level=2)
    
    p_tr_intro = doc.add_paragraph()
    r_tr_intro = p_tr_intro.add_run("(Tracing the party’s title for 30 years previous Regd. Title deed and intervening documents if any (e.g. transacting on power of attorney) to present document must be verified.)")
    r_tr_intro.italic = True

    p_tr1 = doc.add_paragraph()
    r_tr1 = p_tr1.add_run("The properties in S.F.No.245/1B measuring an extent of 0.16 Acres and in S.F.No.245/3A2 measuring an extent of 4.41 Acres originally belongs to Murugesan. Subsequently the said Murugesan sold the properties in S.F.No.245/1B measuring an extent of 0.16 Acres and in S.F.No.245/3A2 measuring an extent of 1.84 Acres to Gopalan under the registered Sale deed dated 05.05.1987 and the same was registered as Document No:1277/1987. As per recital of the Sale deed, Gopalan was put into possession and enjoyment of the properties as its absolute owner. The Original Sale deed is here with produced.")
    r_tr1.font.highlight_color = WD_COLOR_INDEX.YELLOW

    p_tr2 = doc.add_paragraph()
    r_tr2 = p_tr2.add_run("Since one hand written correction was made in Page No.13 of Original Sale deed dated 05.05.1987 and the same was registered as Document No:1277/1987, the applicant has herewith produced Registration Copy of the Sale deed dated 05.05.1987 and the same was registered as Document No:1277/1987 to prove the genuineness of the document and same is found correct and valid.")
    r_tr2.font.highlight_color = WD_COLOR_INDEX.YELLOW

    p_tr3 = doc.add_paragraph()
    r_tr3 = p_tr3.add_run("Subsequently the said Murugesan sold the properties in S.F.No.245/3A2 measuring an extent of 2.57 Acres to Gopalan under the registered Sale deed dated 16.11.1987 and the same was registered as Document No:2860/1987. As per recital of the Sale deed, Gopalan was put into possession and enjoyment of the properties as its absolute owner. The Original Sale deed is here with produced.")
    r_tr3.font.highlight_color = WD_COLOR_INDEX.YELLOW

    p_tr4 = doc.add_paragraph()
    r_tr4 = p_tr4.add_run("Since one hand written correction was made in Page No.5 of Original Sale deed dated 16.11.1987 and the same was registered as Document No:2860/1987, the applicant has herewith produced Registration Copy of the Sale deed dated 16.11.1987 and the same was registered as Document No:2860/1987 to prove the genuineness of the document and same is found correct and valid.")
    r_tr4.font.highlight_color = WD_COLOR_INDEX.YELLOW

    p_tr5 = doc.add_paragraph()
    r_tr5 = p_tr5.add_run("Subsequently the said Gopalan executed a registered Will on 21.10.2023 and the same was registered as Document No.387/BK3/2023. As per the recital of the Will, Gopalan bequeathed the properties in S.F.No.245/1B measuring an extent of 0.16 Acres and in S.F.No.245/3A2 measuring an extent of 1.84 Acres (1st Item) and in S.F.No.245/3A2 measuring an extent of 2.57 Acres (2nd Item) in favour of his daughter-in-law Muthulakshmi. Subsequently Gopalan died on 23.04.2025 and after his death, the Will dated 21.10.2023 came into force and Muthulakshmi succeeded to the properties as per the terms of the Will. The Original Will deed is herewith produced. The Photo Copy of the death certificate of Gopalan is herewith produced.")
    r_tr5.font.highlight_color = WD_COLOR_INDEX.YELLOW

    p_tr6 = doc.add_paragraph()
    p_tr6.add_run("Thus the title holder ")
    r_tr6_name = p_tr6.add_run("K.MUTHULAKSHMI, W/o G.Kumar")
    r_tr6_name.font.highlight_color = WD_COLOR_INDEX.YELLOW
    r_tr6_name.bold = True
    p_tr6.add_run(" derived title to the properties.")

    # Section 3) Detailed information about property to be mortgaged
    doc.add_heading("3) Detailed information about property to be mortgaged:", level=2)
    t_quest = doc.add_table(rows=1, cols=2)
    t_quest.style = 'Table Grid'
    t_quest.rows[0].cells[0].text = "Details"
    t_quest.rows[0].cells[1].text = "Remark of counsel"
    for c in t_quest.rows[0].cells:
        for p in c.paragraphs:
            for r in p.runs:
                r.bold = True

    questions = [
        ("1. Whether the documents of title given raise any doubts or suspicion", "No"),
        ("2. Have the title deeds has been compared with those at registrars office & particulars tally.", "Certified Copy of title deed obtained, compared with Original and found correct."),
        ("3. Whether any of the property intended to be given by way of mortgage is subject to any minor’s or any other claims? If yes, state whether requisite permission from the concerned court has been obtained and produced?", "No Minor interest is involved."),
        ("4. Whether the property proposed to be mortgaged is subject to the provisions contained under any special enactment /local laws. State implications of such enactment on the charge proposed to be created?", "No"),
        ("5. Whether property to be mortgaged is coming under any restrictions on transfer & whether required permission/ consent as per terms of grant/allotment etc. obtained", "There is no restriction."),
        ("6. Whether provisions of urban ceiling Act are applicable? If applicable whether permission obtained.", "Not Applicable"),
        ("7. Whether the user land has been converted under land revenue law? Whether N.A. Permission /change of user permission is obtained?", "Computerized Chitta, Possession Certificate, Adangal which stands in the name of Muthulakshmi are herewith produced to prove that she is in possession and enjoyment of the property"),
        ("8. Whether required documents are available for creating valid equitable mortgage?", "Yes"),
        ("9. What is the tenure of land? (In case of Lease Property) and whether necessary consent permission of lessor obtained.", "Not Applicable"),
        ("10. Whether the land is adiwasi( Tribal) Land?", "Not Applicable"),
        ("11. Whether the land /property is joint family property? If yes are other joint owners ready to mortgage their share or give consent for mortgage by borrower.", "Not Applicable"),
        ("12. Whether any prohibitory order from Income Tax/ Wealth Tax or other authorities?", "Not Applicable"),
        ("13. Is land/ property subject to any reservations/ acquisitions/ requisitions?", "Not Applicable"),
        ("14. Whether plans for constructions are sanctioned?", "Not applicable"),
        ("15. Whether Commencement certificate issued?", "Not Applicable"),
        ("16. Whether Completion certificate obtained?", "Not Applicable"),
        ("17. Whether there are any restriction from Corporation such as “education Zone”, “Green Zone” Etc.?", "Not Applicable"),
        ("18. Is the land taken on lease from State Industrial Development Corporation? If yes whether tripartite agreement executed?", "Not Applicable"),
        ("19. Whether there are any prior encumbrances. If yes details thereof?", "The applicant K.MUTHULAKSHMI, W/o G.Kumar has produced an encumbrance certificate for the period from 01.01.1987 to 25.06.2026 which discloses three transactions in total. The 1st transaction is dated 16.11.1987 Sale deed executed by Murugesan in favour of Gopalan. The 2nd transaction is dated 11.07.2001 Mortgage deed executed by Gopal @ Gopalan in favour of Ramanathapuram Primary Agriculture Co-operative Credit Society. The 3rd transaction is dated 11.01.2007 Discharge receipt executed by Ramanathapuram Primary Agriculture Co-operative Credit Society in favour of Gopal @ Gopalan. The above said transactions are not encumbrances. Hence there are no subsisting encumbrances over the property as on 25.06.2026."),
        ("Evidence of possession -- Findings on documents and revenue records, details of property tax, land revenue, society maintenance charges or any other statutory dues paid upto date or payable.)", "Computerized Chitta, Possession Certificate, Adangal which stands in the name of Muthulakshmi are herewith produced to prove that she is in possession and enjoyment of the property."),
        ("20. In case of companies /societies /association /trust Whether", "Not Applicable"),
        ("a) Memorandum/byelaws of the company /society/association authorize to offer its property (ies) as security.", "Not Applicable"),
        ("b) Requisite resolutions have been duly passed by the Company/Society/Association permitting mortgage of the properties in favour of the Bank.", "Not Applicable"),
        ("c) Such resolution sets out the names of the persons who are authorized to create charge over the properties.", "Not Applicable"),
        ("d) Resolution U/s. 293 (i) (a) and 293 (i) (d) of Companies Act passed.", "Not Applicable"),
        ("e) Details of the properties together with the documents are mentioned under such resolutions.", "Not Applicable"),
        ("f) In case of Public Limited Companies, certificate of commencement of business has been obtained and affixation of common seal is necessary in terms of articles of association.", "Not Applicable"),
        ("g) In case of public charitable trust whether permission of charity commissioner for borrowing & mortgaging trust property is obtained and conditions stipulated if any.", "Not Applicable"),
        ("21. In case of devolution of property by a will/ succession", "Not Applicable"),
        ("A) Whether probate of will/ succession certificate/Letters of Administration obtained? Details thereof", "Not Applicable"),
        ("B) If probate/ succession certificate/ Letters of Administration not obtained, then how the mortgagor proposes to prove the title?", "Not Applicable"),
        ("C) The safeguards suggested to ensure title to the property offered as security.", "Not Applicable"),
        ("26) Whether title deeds perused are in conformity with the search taken", "Not Applicable"),
        ("27) Whether the chain of title is complete without any missing links", "The title is complete and applicant K.MUTHULAKSHMI, W/o G.Kumar has clear, valid and marketable title over the property and can validly create mortgage liability in favour of our bank by depositing the Original documents along with documents mentioned in list."),
        ("28) Whether any other documents to be obtained/compliances to be made so as to create valid mortgage.", "The title is complete and K.MUTHULAKSHMI, W/o G.Kumar has clear, valid and marketable title over the property and can validly create mortgage liability in favour of our bank by depositing the Original documents along with documents mentioned in list."),
        ("29) Whether property complied under SERFAESI Act", "Yes. Agricultural property and hence proceedings under SARFAESI Act is Not enforceable."),
    ]

    for q, ans in questions:
        row = t_quest.add_row().cells
        row[0].paragraphs[0].add_run(q)
        r_ans = row[1].paragraphs[0].add_run(ans)
        if "MUTHULAKSHMI" in ans or "Yes" in ans or "Certified Copy" in ans or "Clear, valid" in ans.lower():
            r_ans.font.highlight_color = WD_COLOR_INDEX.YELLOW

    # Section 4) Certificate of title and No encumbrance
    doc.add_heading("4) Certificate of title and No encumbrance", level=2)
    p_cert1 = doc.add_paragraph()
    p_cert1.add_run("I have examined the Original title deeds relating to the property/ies situated at ")
    r_loc = p_cert1.add_run("Pollachi Taluk Mannur Village")
    r_loc.font.highlight_color = WD_COLOR_INDEX.YELLOW
    p_cert1.add_run(" and offered as security by way of Equitable Mortgage. I have also taken search with the Sub-Registrar of Assurances & Record of Rights for last 36 years (Original fee receipts enclosed). I certify that ")
    r_cert_name = p_cert1.add_run("K.MUTHULAKSHMI, W/o G.Kumar")
    r_cert_name.font.highlight_color = WD_COLOR_INDEX.YELLOW
    r_cert_name.bold = True
    p_cert1.add_run(" has an absolute, clear and marketable title over the property.")

    p_cert2 = doc.add_paragraph()
    p_cert2.add_run("I further certify that the documents of title refereed to under the opinion are perfect evidence of right, title and interest of the borrower / mortgagor and that if the said equitable mortgage by deposit of title deeds created in the manner required by law, it will satisfy the requirements of creation of equitable mortgage.")

    # Section 5) The following documents are to be obtained by the Bank for creation of simple mortgage/equitable mortgage:
    doc.add_heading("5) The following documents are to be obtained by the Bank for creation of simple mortgage/equitable mortgage:", level=2)
    t_docs2 = doc.add_table(rows=1, cols=6)
    t_docs2.style = 'Table Grid'
    for i, t in enumerate(hdr_titles):
        t_docs2.rows[0].cells[i].text = t
        for p in t_docs2.rows[0].cells[i].paragraphs:
            for r in p.runs:
                r.bold = True
    for r_data in sample_doc_rows:
        row_cells = t_docs2.add_row().cells
        for col_idx, text_val in enumerate(r_data):
            p = row_cells[col_idx].paragraphs[0]
            run = p.add_run(text_val)
            if col_idx > 0:
                run.font.highlight_color = WD_COLOR_INDEX.YELLOW

    # Status Table
    p_stat_intro = doc.add_paragraph("All the documents as described in the above section No.4 of this opinion vide document Nos. 1 to 13 are to be received as follows:-")
    t_stat = doc.add_table(rows=1, cols=3)
    t_stat.style = 'Table Grid'
    stat_hdrs = ["Sl. No.", "Description of Documents", "Status"]
    for i, t in enumerate(stat_hdrs):
        t_stat.rows[0].cells[i].text = t
        for p in t_stat.rows[0].cells[i].paragraphs:
            for r in p.runs:
                r.bold = True
    stat_rows = [
        ("01.", "Documents mentioned in Sl.No. 1,3,5", "Original"),
        ("02.", "Documents mentioned in Sl.No. 2,4, 6", "Registration Copy"),
        ("03.", "Receipts to confirm the discharge of the loans borrowed by the Borrowers", "--"),
        ("04.", "Memorandum of deposit of title deeds to be created in favour of Bank of Maharastra", "Original"),
        ("06.", "Encumbrance certificate for a period from 1987 to till date of execution of equitable mortgage in favour of the Bank with “Nil” encumbrance.", "SRO Digital Copy"),
    ]
    for s_no, desc, st in stat_rows:
        row_cells = t_stat.add_row().cells
        row_cells[0].paragraphs[0].add_run(s_no)
        row_cells[1].paragraphs[0].add_run(desc)
        r_st = row_cells[2].paragraphs[0].add_run(st)
        r_st.font.highlight_color = WD_COLOR_INDEX.YELLOW

    # Signatures
    p_sig1 = doc.add_paragraph()
    p_sig1.paragraph_format.space_before = Pt(14)
    p_sig1.add_run("Date:- ")
    r_sd1 = p_sig1.add_run("08.07.2026")
    r_sd1.font.highlight_color = WD_COLOR_INDEX.YELLOW
    p_sig1.add_run("\nPlace: ")
    r_sp1 = p_sig1.add_run("Pollachi")
    r_sp1.font.highlight_color = WD_COLOR_INDEX.YELLOW
    p_sig1.add_run("\t\t\t\t\tSignature & Seal of Advocate: ")
    r_sa1 = p_sig1.add_run("K.KANDAKUMARRAJ")
    r_sa1.font.highlight_color = WD_COLOR_INDEX.YELLOW
    r_sa1.bold = True

    # ANNEXURE I
    doc.add_page_break()
    p_ann = doc.add_heading("ANNEXURE I\nSUMMARY LEGAL TITLE SEARCH REPORT ON THE PROPERTY OWNED BY ", level=1)
    p_ann.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_ann_borrower = p_ann.add_run("K.MUTHULAKSHMI, W/o G.Kumar")
    r_ann_borrower.font.highlight_color = WD_COLOR_INDEX.YELLOW

    t_ann = doc.add_table(rows=1, cols=3)
    t_ann.style = 'Table Grid'
    ann_hdrs = ["Sr.No.", "Particulars", "Compliance"]
    for i, t in enumerate(ann_hdrs):
        t_ann.rows[0].cells[i].text = t
        for p in t_ann.rows[0].cells[i].paragraphs:
            for r in p.runs:
                r.bold = True

    ann_rows = [
        ("1.", "Name of the Branch", "Vanjiyapuram Pirivu, Pollachi"),
        ("2.", "Name of the Borrower", "K.MUTHULAKSHMI, W/o G.Kumar"),
        ("3.", "Name of the Advocate", "K.KANDAKUMARRAJ"),
        ("4.", "Searches made with Registrar of Conveyance Revenue and Municipality Corporation record and verified", "The applicant K.MUTHULAKSHMI, W/o G.Kumar has produced an encumbrance certificate for the period from 01.01.1987 to 25.06.2026 which discloses three transactions in total (all discharged/valid). Hence there are no subsisting encumbrances over the property as on 25.06.2026."),
        ("5.", "Description of the Property / Properties / Nature of Title", "All that piece and parcel of Agricultural property situated at Mannur Village, Pollachi Taluk, comprised in S.F.No.245/1B and S.F.No.245/3A2, totally measuring an extent of 4.57 Acres. Nature of Title: Absolute ownership with good, clear, marketable and unencumbered freehold title."),
        ("a)", "Name of the Borrower/Owner as per title deed", "K.MUTHULAKSHMI, W/o G.Kumar,"),
        ("b)", "Extent of area (in acres/hectares/sq.mtrs/sq.ft.)", "Totally measuring an extent of 4.57 Acres"),
        ("c)", "Survey no/Gut no/CST no/House no.", "S.F.No.245/1B measuring an extent of 0.16 Acres and in S.F.No.245/3A2 measuring an extent of 4.41 Acres"),
        ("d)", "Boundaries", "North by: Lands belonging to Murugesan; South by: East-West cart track; East by: Lands in S.F.No. 246; West by: Mannur Village road and cart track."),
        ("e)", "Type of land", "Agricultural"),
        ("f)", "Nature of Property", "Agricultural"),
        ("g)", "Location", "Mannur Village, Pollachi Taluk"),
        ("h)", "Appears in land Acquisitions/requisitions/reservations", "Verified with relevant Revenue authorities and records. The property is not subject to any Land Acquisition, requisition, or reservation proceedings."),
        ("i)", "Plans for construction are sanctioned", "Agricultural property (vacant land); hence building sanction plan is not applicable."),
        ("j)", "Taxes paid up to date", "Computerized Chitta, Possession Certificate, Adangal which stands in the name of Muthulakshmi are herewith produced to prove that she is in possession and enjoyment of the property ."),
        ("k)", "Trace of Title/ History of passing of title deed (Details of antecedent of title deeds)", "Title traces through registered Sale Deeds Doc No. 1277/1987 and Doc No. 2860/1987 followed by registered Will Doc No. 387/BK3/2023 registered at SRO Pollachi, establishing continuous, defect-free chain of title for over 30 years."),
        ("l)", "Encumbrance Status", "Nil Encumbrance. Verified through Encumbrance Certificate for the period from 01.01.1987 to 25.06.2026 issued by SRO Pollachi. Free from all mortgages, charges, liens, attachments, and claims as on 25.06.2026."),
    ]

    for s_no, part, comp in ann_rows:
        row_cells = t_ann.add_row().cells
        row_cells[0].paragraphs[0].add_run(s_no)
        row_cells[1].paragraphs[0].add_run(part)
        r_c = row_cells[2].paragraphs[0].add_run(comp)
        r_c.font.highlight_color = WD_COLOR_INDEX.YELLOW

    p_final = doc.add_paragraph()
    p_final.paragraph_format.space_before = Pt(14)
    p_final.add_run("Date: ")
    r_fd = p_final.add_run("08.07.2026")
    r_fd.font.highlight_color = WD_COLOR_INDEX.YELLOW
    p_final.add_run("\t\t\t\t\t\t\tYours faithfully,\nPlace: ")
    r_fp = p_final.add_run("Pollachi")
    r_fp.font.highlight_color = WD_COLOR_INDEX.YELLOW
    p_final.add_run("\t\t\t\t\t\t\t")
    r_fa = p_final.add_run("K.KANDAKUMARRAJ, Advocate & Notary")
    r_fa.font.highlight_color = WD_COLOR_INDEX.YELLOW
    r_fa.bold = True

    bio = BytesIO()
    doc.save(bio)
    bio.seek(0)
    return bio

