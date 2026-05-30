import re
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

class EntityExtractor:
    def __init__(self):
        # Setup regex compiled expressions
        self.email_pattern = re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}')
        self.invoice_num_pattern = re.compile(r'\b(?:INV|INVOICE)-\d{3,6}\b', re.IGNORECASE)
        self.company_pattern = re.compile(r'\b([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)*\s+(?:Corp|Corporation|Inc|Llc|Ltd|Limited|Co|Company|Systems|SaaS|Technologies|OS))\b')
        self.person_name_pattern = re.compile(r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b')
        self.common_stop_words = {"The", "A", "An", "In", "On", "At", "For", "To", "With", "By", "From", "Syntra", "Syntra OS", "API", "RAG", "CRM", "Invoice", "Payroll", "Workflow", "Approval"}

    def extract_from_text(self, text: str) -> List[Dict[str, Any]]:
        """
        Processes a block of text to extract entities.
        Uses heuristics and pattern matching.
        """
        entities = []
        if not text:
            return entities

        # 1. Extract Companies
        companies = self.company_pattern.findall(text)
        for comp in set(companies):
            entities.append({
                "entity_type": "company",
                "name": comp.strip(),
                "properties": {"source": "text_heuristic"}
            })

        # 2. Extract Invoices
        invoices = self.invoice_num_pattern.findall(text)
        for inv in set(invoices):
            entities.append({
                "entity_type": "invoice",
                "name": inv.upper().strip(),
                "properties": {"source": "text_heuristic", "invoice_code": inv.upper().strip()}
            })

        # 3. Extract People (matching Title Case names, avoiding company names or stop words)
        people = self.person_name_pattern.findall(text)
        for person in set(people):
            words = person.split()
            if any(w in self.common_stop_words or w in [c.split()[0] for c in companies if c.split()] for w in words):
                continue
            entities.append({
                "entity_type": "person",
                "name": person.strip(),
                "properties": {"source": "text_heuristic"}
            })

        return entities

    def extract_from_invoice(self, invoice_record: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Extracts structured entities directly from an invoice database dictionary.
        """
        entities = []
        
        # 1. Invoice entity itself
        inv_code = invoice_record.get("invoice_number") or invoice_record.get("invoice_id") or f"INV-{invoice_record.get('id')}"
        entities.append({
            "entity_type": "invoice",
            "name": str(inv_code).strip(),
            "properties": {
                "amount": invoice_record.get("amount"),
                "status": invoice_record.get("status"),
                "id": str(invoice_record.get("id"))
            }
        })

        # 2. Vendor / Company entity
        vendor = invoice_record.get("vendor") or invoice_record.get("vendor_name")
        if vendor:
            entities.append({
                "entity_type": "company",
                "name": str(vendor).strip(),
                "properties": {"is_vendor": True}
            })

        # 3. Submitter / Person entity
        submitted_by = invoice_record.get("submitted_by") or invoice_record.get("employee_name")
        if submitted_by:
            entities.append({
                "entity_type": "person",
                "name": str(submitted_by).strip(),
                "properties": {}
            })

        # 4. Department
        dept = invoice_record.get("department")
        if dept:
            entities.append({
                "entity_type": "department",
                "name": str(dept).strip(),
                "properties": {}
            })

        return entities

    def extract_from_crm(self, crm_record: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Extracts entities from a CRM record dictionary.
        """
        entities = []
        
        lead_name = crm_record.get("name") or crm_record.get("lead_name")
        if lead_name:
            entities.append({
                "entity_type": "person",
                "name": str(lead_name).strip(),
                "properties": {
                    "email": crm_record.get("email"),
                    "phone": crm_record.get("phone"),
                    "crm_id": str(crm_record.get("id"))
                }
            })

        company = crm_record.get("company") or crm_record.get("company_name")
        if company:
            entities.append({
                "entity_type": "company",
                "name": str(company).strip(),
                "properties": {}
            })

        owner = crm_record.get("owner") or crm_record.get("assigned_to")
        if owner:
            entities.append({
                "entity_type": "person",
                "name": str(owner).strip(),
                "properties": {"is_employee": True}
            })

        return entities

    def extract_from_workflow_log(self, workflow_record: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Extracts entities from a workflow run execution structure.
        """
        entities = []
        
        w_name = workflow_record.get("name") or workflow_record.get("workflow_name") or f"Workflow-{workflow_record.get('id')}"
        entities.append({
            "entity_type": "workflow",
            "name": str(w_name).strip(),
            "properties": {
                "workflow_id": str(workflow_record.get("id")),
                "status": workflow_record.get("status")
            }
        })

        trigger_by = workflow_record.get("triggered_by") or workflow_record.get("created_by")
        if trigger_by:
            entities.append({
                "entity_type": "person",
                "name": str(trigger_by).strip(),
                "properties": {}
            })

        return entities

    def extract_from_approval(self, approval_record: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Extracts entities from a human-in-the-loop review/approval record.
        """
        entities = []
        
        app_name = f"Approval-{approval_record.get('id')}"
        entities.append({
            "entity_type": "approval",
            "name": app_name,
            "properties": {
                "approval_id": str(approval_record.get("id")),
                "status": approval_record.get("status"),
                "module": approval_record.get("module")
            }
        })

        reviewer = approval_record.get("reviewer") or approval_record.get("assigned_reviewer") or approval_record.get("reviewed_by")
        if reviewer:
            entities.append({
                "entity_type": "person",
                "name": str(reviewer).strip(),
                "properties": {"is_reviewer": True}
            })

        return entities
