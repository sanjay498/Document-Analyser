"""
Loan Models & Nature of Loan Classification Constants for Legal Scrutiny Workflows.
"""

from typing import List, Dict, Any

LOAN_NATURE_OPTIONS: List[str] = [
    "House Model",
    "Agri Model",
    "Non Agri Model",
    "Agreement Base Model",
    "Take Over Model",
    "Already Deposited Model",
]

DEFAULT_LOAN_NATURE: str = "House Model"

LOAN_NATURE_METADATA: Dict[str, Dict[str, str]] = {
    "House Model": {
        "label": "House Model",
        "description": "Housing / Residential Property Mortgage & Construction Loan",
        "category": "Residential",
        "facility_type": "Housing Term Loan"
    },
    "Agri Model": {
        "label": "Agri Model",
        "description": "Agricultural Land & Farming Cultivation Credit Facility",
        "category": "Agricultural",
        "facility_type": "Kisan Credit / Agricultural Term Loan"
    },
    "Non Agri Model": {
        "label": "Non Agri Model",
        "description": "Commercial, Industrial & Non-Agricultural Real Estate Conveyance",
        "category": "Commercial",
        "facility_type": "Commercial Mortgage / MSME Loan"
    },
    "Agreement Base Model": {
        "label": "Agreement Base Model",
        "description": "Agreement Based Loan (Under-Construction / Builder Tripartite)",
        "category": "Tripartite",
        "facility_type": "Builder Tie-Up Housing Finance"
    },
    "Take Over Model": {
        "label": "Take Over Model",
        "description": "Takeover of Existing Mortgage Loan from Other Bank / NBFC",
        "category": "Refinance",
        "facility_type": "Takeover / Balance Transfer Facility"
    },
    "Already Deposited Model": {
        "label": "Already Deposited Model",
        "description": "Equitable Mortgage Extension / Title Deeds Already Deposited with Bank",
        "category": "Extension",
        "facility_type": "Top-Up / Extension of Existing Mortgage"
    },
}


def normalize_loan_nature(val: str) -> str:
    """Safely normalizes input to one of the 6 canonical loan model names."""
    if not val or not str(val).strip():
        return DEFAULT_LOAN_NATURE
    cleaned = str(val).strip().lower()
    for opt in LOAN_NATURE_OPTIONS:
        if cleaned == opt.lower():
            return opt
    if "agri" in cleaned and "non" not in cleaned:
        return "Agri Model"
    if "non" in cleaned and "agri" in cleaned:
        return "Non Agri Model"
    if "agreement" in cleaned:
        return "Agreement Base Model"
    if "take" in cleaned or "over" in cleaned:
        return "Take Over Model"
    if "deposit" in cleaned or "already" in cleaned:
        return "Already Deposited Model"
    if "house" in cleaned or "home" in cleaned or "housing" in cleaned:
        return "House Model"
    return DEFAULT_LOAN_NATURE
