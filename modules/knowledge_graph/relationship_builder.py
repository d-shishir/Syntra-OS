from typing import List, Dict, Any

class RelationshipBuilder:
    def __init__(self):
        pass

    def build_invoice_relationships(self, extracted_entities: List[Dict[str, Any]], invoice_record: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Creates relationships among entities extracted from an invoice context.
        """
        relationships = []
        
        # Helper to find node by type
        def find_entity_name(etype: str) -> str:
            for ent in extracted_entities:
                if ent["entity_type"] == etype:
                    return ent["name"]
            return None

        invoice_name = find_entity_name("invoice")
        company_name = find_entity_name("company")
        person_name = find_entity_name("person")
        dept_name = find_entity_name("department")

        # 1. Person -> submitted -> Invoice
        if person_name and invoice_name:
            relationships.append({
                "source_name": person_name,
                "source_type": "person",
                "target_name": invoice_name,
                "target_type": "invoice",
                "relationship_type": "submitted",
                "properties": {}
            })

        # 2. Invoice -> belongs_to -> Company
        if invoice_name and company_name:
            relationships.append({
                "source_name": invoice_name,
                "source_type": "invoice",
                "target_name": company_name,
                "target_type": "company",
                "relationship_type": "belongs_to",
                "properties": {}
            })

        # 3. Person -> works_for -> Company
        if person_name and company_name:
            relationships.append({
                "source_name": person_name,
                "source_type": "person",
                "target_name": company_name,
                "target_type": "company",
                "relationship_type": "works_for",
                "properties": {}
            })

        # 4. Invoice -> belongs_to -> Department
        if invoice_name and dept_name:
            relationships.append({
                "source_name": invoice_name,
                "source_type": "invoice",
                "target_name": dept_name,
                "target_type": "department",
                "relationship_type": "belongs_to",
                "properties": {}
            })

        return relationships

    def build_crm_relationships(self, extracted_entities: List[Dict[str, Any]], crm_record: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Creates relationships among entities extracted from a CRM lead context.
        """
        relationships = []
        
        # Find person (lead), company, owner
        lead_name = None
        company_name = None
        owner_name = None

        for ent in extracted_entities:
            if ent["entity_type"] == "person":
                if ent.get("properties", {}).get("is_employee"):
                    owner_name = ent["name"]
                else:
                    lead_name = ent["name"]
            elif ent["entity_type"] == "company":
                company_name = ent["name"]

        # 1. Lead Person -> works_for -> Company
        if lead_name and company_name:
            relationships.append({
                "source_name": lead_name,
                "source_type": "person",
                "target_name": company_name,
                "target_type": "company",
                "relationship_type": "works_for",
                "properties": {}
            })

        # 2. Owner Person -> owns -> Lead Person
        if owner_name and lead_name:
            relationships.append({
                "source_name": owner_name,
                "source_type": "person",
                "target_name": lead_name,
                "target_type": "person",
                "relationship_type": "owns",
                "properties": {"role": "sales_owner"}
            })

        # 3. Owner Person -> works_for -> Company (Syntra OS internal context if applicable)
        return relationships

    def build_workflow_relationships(self, extracted_entities: List[Dict[str, Any]], workflow_record: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Creates relationships for workflows.
        """
        relationships = []
        
        workflow_name = None
        person_name = None
        
        for ent in extracted_entities:
            if ent["entity_type"] == "workflow":
                workflow_name = ent["name"]
            elif ent["entity_type"] == "person":
                person_name = ent["name"]

        # 1. Person -> submitted/triggered -> Workflow
        if person_name and workflow_name:
            relationships.append({
                "source_name": person_name,
                "source_type": "person",
                "target_name": workflow_name,
                "target_type": "workflow",
                "relationship_type": "submitted",
                "properties": {}
            })

        # 2. Workflow references/processes targeted invoices/documents in metadata
        target_id = workflow_record.get("target_id")
        target_type = workflow_record.get("target_type") # e.g. "invoice", "document"
        if workflow_name and target_id:
            target_name = f"{target_type.upper()}-{target_id}" if target_type else str(target_id)
            relationships.append({
                "source_name": workflow_name,
                "source_type": "workflow",
                "target_name": target_name,
                "target_type": target_type or "document",
                "relationship_type": "references",
                "properties": {}
            })

        return relationships

    def build_approval_relationships(self, extracted_entities: List[Dict[str, Any]], approval_record: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Creates relationships for human review approvals.
        """
        relationships = []
        
        approval_name = None
        reviewer_name = None
        
        for ent in extracted_entities:
            if ent["entity_type"] == "approval":
                approval_name = ent["name"]
            elif ent["entity_type"] == "person":
                reviewer_name = ent["name"]

        # 1. Reviewer Person -> reviewed_by -> Approval (or approved/rejected)
        if reviewer_name and approval_name:
            action = approval_record.get("status", "reviewed")
            rel_type = "approved" if action == "approved" else ("rejected" if action == "rejected" else "reviewed_by")
            relationships.append({
                "source_name": reviewer_name,
                "source_type": "person",
                "target_name": approval_name,
                "target_type": "approval",
                "relationship_type": rel_type,
                "properties": {}
            })

        # 2. Approval -> references -> target
        target_id = approval_record.get("target_id")
        target_type = approval_record.get("target_type") or "invoice"
        if approval_name and target_id:
            target_name = f"{target_type.upper()}-{target_id}" if target_type else str(target_id)
            relationships.append({
                "source_name": approval_name,
                "source_type": "approval",
                "target_name": target_name,
                "target_type": target_type,
                "relationship_type": "references",
                "properties": {}
            })

        return relationships

    def build_text_relationships(self, extracted_entities: List[Dict[str, Any]], document_name: str) -> List[Dict[str, Any]]:
        """
        Builds basic relationships directly from text matching.
        """
        relationships = []
        
        companies = [e for e in extracted_entities if e["entity_type"] == "company"]
        people = [e for e in extracted_entities if e["entity_type"] == "person"]
        invoices = [e for e in extracted_entities if e["entity_type"] == "invoice"]

        # 1. Match people to companies (simple heuristic: if document mentions one company and one person, they probably work_for)
        if len(companies) == 1 and len(people) >= 1:
            for p in people:
                relationships.append({
                    "source_name": p["name"],
                    "source_type": "person",
                    "target_name": companies[0]["name"],
                    "target_type": "company",
                    "relationship_type": "works_for",
                    "properties": {}
                })

        # 2. Match people to invoices
        if len(invoices) >= 1 and len(people) >= 1:
            for p in people:
                for inv in invoices:
                    relationships.append({
                        "source_name": p["name"],
                        "source_type": "person",
                        "target_name": inv["name"],
                        "target_type": "invoice",
                        "relationship_type": "submitted",
                        "properties": {}
                    })

        # 3. Match invoices to companies
        if len(invoices) >= 1 and len(companies) >= 1:
            for inv in invoices:
                for c in companies:
                    relationships.append({
                        "source_name": inv["name"],
                        "source_type": "invoice",
                        "target_name": c["name"],
                        "target_type": "company",
                        "relationship_type": "belongs_to",
                        "properties": {}
                    })

        # 4. Link everything to the parent document
        for ent in extracted_entities:
            relationships.append({
                "source_name": ent["name"],
                "source_type": ent["entity_type"],
                "target_name": document_name,
                "target_type": "document",
                "relationship_type": "related_to",
                "properties": {}
            })

        return relationships
