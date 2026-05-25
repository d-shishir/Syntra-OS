from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import logging

from .config import settings
from .database import get_db
from .models import Document
from .schemas import DocumentResponse, DocumentDetailResponse
from .pdf_processor import extract_text_from_pdf

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

app = FastAPI(title=settings.PROJECT_NAME)

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "healthy", "service": settings.PROJECT_NAME}

@app.post("/upload-document", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Accepts a PDF document, extracts text, stores it in PostgreSQL database,
    and prepares it for future vector embedding extraction.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF documents are supported."
        )

    try:
        # Read file bytes
        file_bytes = await file.read()
        file_size = len(file_bytes)
        
        # PDF Text Extraction
        logger.info(f"Extracting text from uploaded file: {file.filename}")
        extracted_text = extract_text_from_pdf(file_bytes)
        
        # Save to database
        db_doc = Document(
            filename=file.filename,
            content=extracted_text,
            file_size=file_size,
            mime_type=file.content_type or "application/pdf"
        )
        
        db.add(db_doc)
        db.commit()
        db.refresh(db_doc)
        
        logger.info(f"Successfully stored document: {file.filename} (ID: {db_doc.id})")
        
        # =====================================================================
        # FUTURE RAG PIPELINE EXPANSION HOOK
        # =====================================================================
        # 1. Trigger Async Background Worker (e.g. Celery / FastAPI BackgroundTask)
        # 2. Chunk text: chunks = chunk_text(db_doc.content)
        # 3. Generate Embeddings: embeddings = generate_embeddings(chunks)
        # 4. Save to Vector Store: save_vector_embeddings(db_doc.id, chunks, embeddings)
        # =====================================================================
        
        return db_doc
        
    except ValueError as val_err:
        logger.error(f"Validation error during PDF processing: {str(val_err)}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(val_err)
        )
    except Exception as e:
        logger.exception("Failed to upload and ingest document")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process document: {str(e)}"
        )

@app.get("/documents", response_model=list[DocumentResponse])
def get_documents(db: Session = Depends(get_db)):
    """
    Retrieve list of uploaded documents (excluding heavy text content for performance).
    """
    try:
        documents = db.query(Document).order_by(Document.created_at.desc()).all()
        return documents
    except Exception as e:
        logger.exception("Failed to fetch documents")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database query failed: {str(e)}"
        )

@app.get("/documents/{document_id}", response_model=DocumentDetailResponse)
def get_document_by_id(document_id: str, db: Session = Depends(get_db)):
    """
    Get detailed document data including full extracted text.
    """
    try:
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found."
            )
        return document
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to fetch document details for: {document_id}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database query failed: {str(e)}"
        )
