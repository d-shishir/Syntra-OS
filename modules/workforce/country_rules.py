# Country Onboarding & Document Compliance Rules Map

COUNTRY_ONBOARDING_RULES = {
    "United States": {
        "required_documents": [
            "Government ID",
            "W-9 Tax Form",
            "Proof of Address",
            "Signed Agreement"
        ],
        "compliance_notes": "A W-9 tax form is mandatory for US tax status classification. Verify social security or employer identification numbers.",
        "primary_tax_form": "W-9 Tax Form"
    },
    "United Kingdom": {
        "required_documents": [
            "Government ID",
            "Right-to-work Document",
            "Proof of Address",
            "Signed Agreement"
        ],
        "compliance_notes": "Right-to-work checks are legally required in the UK to prevent illegal employment of international workers.",
        "primary_tax_form": "P45 / Starter Checklist"
    },
    "Germany": {
        "required_documents": [
            "Government ID",
            "German Tax ID registration",
            "Proof of Address",
            "Signed Agreement"
        ],
        "compliance_notes": "German tax ID registration registration check is required. Confirm if contractor requires freelance certificate status (Freiberufler).",
        "primary_tax_form": "German Tax ID registration"
    },
    "Nepal": {
        "required_documents": [
            "Nepal Citizenship Card",
            "PAN Registration Form",
            "Proof of Address",
            "Signed Agreement"
        ],
        "compliance_notes": "National Nepal Citizenship verification is mandatory. Validate PAN details for direct withholding calculations.",
        "primary_tax_form": "PAN Registration Form"
    }
}

def get_rules_for_country(country: str) -> dict:
    """
    Returns required documents list and compliance guidelines.
    Falls back to a standard global template if the country is not explicitly configured.
    """
    return COUNTRY_ONBOARDING_RULES.get(country, {
        "required_documents": [
            "Government ID",
            "Tax Form",
            "Proof of Address",
            "Signed Agreement"
        ],
        "compliance_notes": "Verify standard global identity verification and local tax registration forms.",
        "primary_tax_form": "Tax Form"
    })
