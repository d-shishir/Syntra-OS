from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from .models import Lead
from .lead_service import LeadService
from .crm_workflows import enrichment_engine, scoring_engine, outreach_generator
from pydantic import BaseModel, EmailStr
from typing import List, Dict, Any, Optional
from modules.auth_system.access_policies import PermissionGuard

router = APIRouter()
lead_service = LeadService()

# Schemas
class LeadCreateSchema(BaseModel):
    name: str
    email: str
    company: str
    role: Optional[str] = None
    country: Optional[str] = None
    source: Optional[str] = None
    trigger_workflow: Optional[bool] = True

class LeadStatusUpdateSchema(BaseModel):
    status: str

@router.post("/leads/create", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
def create_lead(payload: LeadCreateSchema, db: Session = Depends(get_db), _ = Depends(PermissionGuard("crm_records", "write"))):
    """
    Creates a lead and triggers onboarding pipeline context workflows (enrich, score, outreach).
    """
    try:
        lead, run = lead_service.create_lead(
            db=db,
            name=payload.name,
            email=payload.email,
            company=payload.company,
            role=payload.role,
            country=payload.country,
            source=payload.source,
            trigger_workflow=payload.trigger_workflow
        )
        res = lead.to_dict()
        if run:
            res["workflow_run_id"] = str(run.id)
            res["workflow_status"] = run.status
        return res
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create lead: {str(e)}"
        )

@router.get("/leads", response_model=List[Dict[str, Any]])
def list_leads(
    status: Optional[str] = None,
    min_score: Optional[int] = None,
    db: Session = Depends(get_db),
    _ = Depends(PermissionGuard("crm_records", "read"))
):
    """
    List leads with optional filtering options.
    """
    try:
        leads = lead_service.list_leads(db, status=status, min_score=min_score)
        return [l.to_dict() for l in leads]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.get("/leads/search", response_model=List[Dict[str, Any]])
def search_leads(query: str, db: Session = Depends(get_db), _ = Depends(PermissionGuard("crm_records", "read"))):
    """
    Search leads by matching keyword on name, company, email or industry.
    """
    if not query or not query.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Search query parameter cannot be empty."
        )
    
    keyword = f"%{query.strip()}%"
    leads = db.query(Lead).filter(
        (Lead.name.ilike(keyword)) |
        (Lead.company.ilike(keyword)) |
        (Lead.email.ilike(keyword)) |
        (Lead.industry.ilike(keyword))
    ).all()
    
    return [l.to_dict() for l in leads]

@router.get("/leads/{lead_id}", response_model=Dict[str, Any])
def get_lead_details(lead_id: str, db: Session = Depends(get_db), _ = Depends(PermissionGuard("crm_records", "read"))):
    lead = lead_service.get_lead(db, lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found"
        )
    return lead.to_dict()

@router.post("/leads/enrich/{lead_id}", response_model=Dict[str, Any])
def enrich_lead(lead_id: str, db: Session = Depends(get_db), _ = Depends(PermissionGuard("crm_records", "write"))):
    """
    Manually triggers AI RAG lead enrichment.
    """
    lead = lead_service.get_lead(db, lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found"
        )
    
    try:
        enrich_data = enrichment_engine.enrich_lead(db, lead.name, lead.company)
        lead.company_description = enrich_data.get("company_description")
        lead.industry = enrich_data.get("industry")
        lead.estimated_size = enrich_data.get("estimated_size")
        lead.relevance_score = enrich_data.get("relevance_score")
        db.commit()
        return lead.to_dict()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/leads/score/{lead_id}", response_model=Dict[str, Any])
def score_lead(lead_id: str, db: Session = Depends(get_db), _ = Depends(PermissionGuard("crm_records", "write"))):
    """
    Manually triggers AI lead quality scoring.
    """
    lead = lead_service.get_lead(db, lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found"
        )
    
    try:
        score_data = scoring_engine.score_lead(lead.to_dict())
        lead.lead_score = score_data.get("lead_score", 0)
        lead.scoring_reasoning = score_data.get("reasoning", "")
        db.commit()
        return lead.to_dict()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/leads/generate-outreach/{lead_id}", response_model=Dict[str, Any])
def generate_outreach(lead_id: str, db: Session = Depends(get_db), _ = Depends(PermissionGuard("crm_records", "write"))):
    """
    Manually triggers customized sales outreach templates copywriting.
    """
    lead = lead_service.get_lead(db, lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found"
        )
    
    try:
        outreach = outreach_generator.generate_outreach(lead.to_dict())
        lead.outreach_templates = outreach
        db.commit()
        return lead.to_dict()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/leads/{lead_id}/status", response_model=Dict[str, Any])
def update_lead_status(lead_id: str, payload: LeadStatusUpdateSchema, db: Session = Depends(get_db), _ = Depends(PermissionGuard("crm_records", "write"))):
    """
    Update lead stage status.
    """
    try:
        lead = lead_service.update_lead_status(db, lead_id, payload.status)
        return lead.to_dict()
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(val_err)
        )
