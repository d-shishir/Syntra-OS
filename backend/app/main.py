import sys
import os
# Ensure workspace root is in sys.path
root_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if root_path not in sys.path:
    sys.path.insert(0, root_path)

from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, status, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import logging

from .config import settings
from .database import get_db, SessionLocal
from .models import Document
from .schemas import DocumentResponse, DocumentDetailResponse, SearchResultResponse, ChatRequest, ChatResponse, SystemMetricsResponse
from .pdf_processor import extract_text_from_pdf
from .services.extractor import extract_structured_data
from .services.chunker import split_text_into_chunks
from .services.embeddings import get_embedding, get_embedding_with_method
from .services.vector_store import save_document_chunks, search_similar_chunks
from .services.rag_pipeline import ask_question_rag
from .services.metrics import metrics_tracker

# Import the new invoice/payroll automation router
from modules.invoice_automation.router import router as invoice_automation_router
from modules.workflow_engine.router import router as workflow_engine_router
from modules.crm_intelligence.router import router as crm_router
from app.database import engine, Base
import modules.workflow_engine.models  # Ensures models are imported for metadata creation
import modules.crm_intelligence.models  # Ensures crm models are imported for metadata creation

# Auto create tables if not exists
Base.metadata.create_all(bind=engine)

# Migration: Add is_deleted to documents table if it doesn't exist
from sqlalchemy import text
with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE documents ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE"))
        conn.commit()
    except Exception:
        # Ignore if column already exists or database/schema migration not required
        pass

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

app = FastAPI(title=settings.PROJECT_NAME)

# Register the new routers
app.include_router(invoice_automation_router, prefix="/api/v1/invoice-automation", tags=["Invoice & Payroll Automation"])
app.include_router(workflow_engine_router, prefix="/api/v1/workflows", tags=["AI Workflow Engine"])
app.include_router(crm_router, prefix="/api/v1/crm", tags=["CRM & Sales Automation"])

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

@app.get("/health/ai")
def check_ai_connection():
    """
    Checks if the AI model API (OpenAI or OpenRouter) is configured and reachable.
    """
    if not settings.OPENAI_API_KEY:
        return {
            "status": "mock",
            "model": settings.OPENAI_MODEL,
            "embedding_model": settings.OPENAI_EMBEDDING_MODEL,
            "provider": "Mock Engine (Offline)",
            "detail": "No API key configured. Running with local mock fallbacks."
        }
        
    try:
        from openai import OpenAI
        client = OpenAI(
            api_key=settings.OPENAI_API_KEY,
            base_url=settings.OPENAI_API_BASE
        )
        
        # Trigger a minimal 1-token request to verify base connection and authentication
        client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[{"role": "user", "content": "ping"}],
            max_tokens=1
        )
        
        provider = "OpenRouter" if "openrouter" in settings.OPENAI_API_BASE.lower() else "OpenAI"
        return {
            "status": "connected",
            "model": settings.OPENAI_MODEL,
            "embedding_model": settings.OPENAI_EMBEDDING_MODEL,
            "provider": provider,
            "detail": "Successfully reached model API."
        }
    except Exception as e:
        logger.warning(f"AI Connection check failed: {str(e)}")
        return {
            "status": "disconnected",
            "model": settings.OPENAI_MODEL,
            "embedding_model": settings.OPENAI_EMBEDDING_MODEL,
            "provider": "API Connection Failure",
            "detail": str(e)
        }

@app.get("/system-metrics", response_model=SystemMetricsResponse)
def get_system_metrics(db: Session = Depends(get_db)):
    """
    Retrieves high-level performance metrics for the RAG pipeline.
    """
    try:
        return metrics_tracker.get_metrics(db)
    except Exception as e:
        logger.exception("Failed to retrieve system metrics")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compile metrics: {str(e)}"
        )

def integrate_document_pipeline(document_id: str, db_session_factory):
    """
    Asynchronous background worker to chunk, embed, classify, extract, and
    validate invoices/payroll documents into postgres and pgvector.
    """
    db = db_session_factory()
    try:
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            logger.error(f"Background pipeline failed: Document {document_id} not found")
            return
            
        logger.info(f"Background task: chunking and indexing document {document.filename} ({document.id})")
        
        # 1. Chunk and index into vector store
        chunks = split_text_into_chunks(document.content)
        indexing_method = None
        if chunks:
            embeddings = []
            indexing_methods = set()
            for c in chunks:
                emb, method = get_embedding_with_method(c["chunk_text"])
                embeddings.append(emb)
                indexing_methods.add(method)
            
            indexing_method = "live" if "live" in indexing_methods else "mock"
            save_document_chunks(db, str(document.id), chunks, embeddings)
            logger.info(f"Background task: indexed {len(chunks)} chunks for document {document_id}")
            
        # 2. Extract structured JSON
        logger.info(f"Background task: extracting structured data for {document_id}")
        extracted_data = extract_structured_data(document.content)
        if indexing_method:
            extracted_data["indexing_method"] = indexing_method
        document.extracted_json = extracted_data
        db.commit()
        
        # 3. Process according to classification
        doc_type = extracted_data.get("document_type")
        if doc_type == "invoice":
            from modules.invoice_automation.invoice_service import process_invoice
            process_invoice(db, str(document.id), extracted_data)
        elif doc_type == "payroll":
            from modules.invoice_automation.payroll_service import process_payroll
            process_payroll(db, str(document.id), extracted_data)
            
        logger.info(f"Background task: successfully completed integration pipeline for document {document_id}")
    except Exception as e:
        logger.exception(f"Background pipeline failed for document {document_id}: {str(e)}")
    finally:
        db.close()

@app.post("/upload-document", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Accepts a PDF document, extracts text, stores it in PostgreSQL database,
    and runs the background integration task to index, extract, and analyze financial data.
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
        
        # Trigger background processing (indexing, extraction, validation, anomalies)
        background_tasks.add_task(integrate_document_pipeline, str(db_doc.id), SessionLocal)
        
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
def get_documents(is_deleted: bool = False, db: Session = Depends(get_db)):
    """
    Retrieve list of uploaded documents (excluding heavy text content for performance).
    """
    try:
        documents = db.query(Document).filter(Document.is_deleted == is_deleted).order_by(Document.created_at.desc()).all()
        
        # Get list of vectorized document IDs in a single query
        from sqlalchemy import text
        vectorized_ids = {
            row[0] for row in db.execute(text("SELECT DISTINCT document_id FROM document_chunks")).fetchall()
        }
        
        result = []
        for doc in documents:
            doc_type = "unclassified"
            if doc.extracted_json:
                doc_type = doc.extracted_json.get("document_type", "generic")
                
            result.append(DocumentResponse(
                filename=doc.filename,
                file_size=doc.file_size,
                mime_type=doc.mime_type,
                id=doc.id,
                extracted_json=doc.extracted_json,
                created_at=doc.created_at,
                is_vectorized=doc.id in vectorized_ids,
                document_type=doc_type,
                is_deleted=doc.is_deleted
            ))
        return result
    except Exception as e:
        logger.exception("Failed to fetch documents")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database query failed: {str(e)}"
        )

@app.post("/documents/{document_id}/trash")
def trash_document(document_id: str, db: Session = Depends(get_db)):
    """
    Move a document to the trash bin (soft delete).
    """
    try:
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found."
            )
        document.is_deleted = True
        db.commit()
        return {"status": "success", "message": "Document moved to trash"}
    except Exception as e:
        db.rollback()
        logger.exception("Failed to trash document")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.post("/documents/{document_id}/restore")
def restore_document(document_id: str, db: Session = Depends(get_db)):
    """
    Restore a document from the trash bin.
    """
    try:
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found."
            )
        document.is_deleted = False
        db.commit()
        return {"status": "success", "message": "Document restored from trash"}
    except Exception as e:
        db.rollback()
        logger.exception("Failed to restore document")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.delete("/documents/{document_id}")
def delete_document(document_id: str, db: Session = Depends(get_db)):
    """
    Permanently delete a document from the database (cascades to related tables).
    """
    try:
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found."
            )
        db.delete(document)
        db.commit()
        return {"status": "success", "message": "Document permanently deleted"}
    except Exception as e:
        db.rollback()
        logger.exception("Failed to permanently delete document")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
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
            
        from sqlalchemy import text
        has_chunks = db.execute(
            text("SELECT 1 FROM document_chunks WHERE document_id = :doc_id LIMIT 1"),
            {"doc_id": document.id}
        ).fetchone() is not None
        
        doc_type = "unclassified"
        if document.extracted_json:
            doc_type = document.extracted_json.get("document_type", "generic")
            
        return DocumentDetailResponse(
            filename=document.filename,
            file_size=document.file_size,
            mime_type=document.mime_type,
            id=document.id,
            extracted_json=document.extracted_json,
            created_at=document.created_at,
            content=document.content,
            is_vectorized=has_chunks,
            document_type=doc_type
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to fetch document details for: {document_id}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database query failed: {str(e)}"
        )

@app.post("/documents/{document_id}/extract", response_model=DocumentDetailResponse)
def extract_document_data(document_id: str, db: Session = Depends(get_db)):
    """
    Extract structured JSON from raw document content and save it in the database.
    """
    try:
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found."
            )
            
        logger.info(f"Triggering structured extraction for document: {document.filename} ({document.id})")
        
        # Invoke LLM-powered extraction service
        extracted_data = extract_structured_data(document.content)
        
        # Preserve indexing_method if it already exists in the database
        if document.extracted_json and "indexing_method" in document.extracted_json:
            extracted_data["indexing_method"] = document.extracted_json["indexing_method"]
            
        # Save JSON to Database
        document.extracted_json = extracted_data
        db.commit()
        db.refresh(document)
        
        # Sync invoice or payroll automation layers
        doc_type = extracted_data.get("document_type")
        if doc_type == "invoice":
            from modules.invoice_automation.invoice_service import process_invoice
            process_invoice(db, str(document.id), extracted_data)
        elif doc_type == "payroll":
            from modules.invoice_automation.payroll_service import process_payroll
            process_payroll(db, str(document.id), extracted_data)
            
        # Check if vectorized
        from sqlalchemy import text
        has_chunks = db.execute(
            text("SELECT 1 FROM document_chunks WHERE document_id = :doc_id LIMIT 1"),
            {"doc_id": document.id}
        ).fetchone() is not None
            
        logger.info(f"Successfully saved extracted structured data to DB for document: {document.id}")
        
        return DocumentDetailResponse(
            filename=document.filename,
            file_size=document.file_size,
            mime_type=document.mime_type,
            id=document.id,
            extracted_json=document.extracted_json,
            created_at=document.created_at,
            content=document.content,
            is_vectorized=has_chunks,
            document_type=doc_type or "generic"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Structured data extraction failed for: {document_id}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Extraction failed: {str(e)}"
        )

@app.post("/documents/{document_id}/index")
def index_document(document_id: str, db: Session = Depends(get_db)):
    """
    Splits the document text into semantic chunks, generates vector embeddings for each chunk,
    and indexes them in the pgvector database.
    """
    try:
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found."
            )
            
        logger.info(f"Chunking and embedding document: {document.filename} ({document.id})")
        
        # 1. Chunk the document text
        chunks = split_text_into_chunks(document.content)
        if not chunks:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="No text chunks could be created. Is the document empty?"
            )
            
        # 2. Generate embeddings for each chunk and detect which method was used
        logger.info(f"Generating embeddings for {len(chunks)} chunks...")
        embeddings = []
        indexing_methods_used = set()
        for chunk in chunks:
            vector, method = get_embedding_with_method(chunk["chunk_text"])
            embeddings.append(vector)
            indexing_methods_used.add(method)
        
        indexing_method = "live" if "live" in indexing_methods_used else "mock"
            
        # 3. Store chunks + embeddings in pgvector
        save_document_chunks(db, str(document.id), chunks, embeddings)
        
        # 4. Persist the indexing_method into extracted_json so the frontend can read it later
        existing_json = document.extracted_json or {}
        existing_json["indexing_method"] = indexing_method
        document.extracted_json = existing_json
        db.commit()
        
        return {"status": "success", "chunks_indexed": len(chunks), "indexing_method": indexing_method}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Document indexing failed for: {document_id}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Indexing failed: {str(e)}"
        )

@app.get("/search", response_model=list[SearchResultResponse])
def search_documents(query: str, limit: int = 5, db: Session = Depends(get_db)):
    """
    Semantic search over indexed document chunks using cosine similarity.
    """
    if not query or not query.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Query parameter is required."
        )
        
    try:
        logger.info(f"Executing semantic search for query: {query}")
        
        # 1. Generate query embedding vector
        query_vector = get_embedding(query)
        
        # 2. Retrieve top matching chunks using pgvector distance operations
        results = search_similar_chunks(db, query_vector, limit=limit)
        return results
        
    except Exception as e:
        logger.exception("Semantic search query failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Search failed: {str(e)}"
        )

@app.post("/chat-with-documents", response_model=ChatResponse)
def chat_with_documents(request: ChatRequest, db: Session = Depends(get_db)):
    """
    RAG QA Chat endpoint: retrieves context from pgvector, prompts LLM,
    and returns a grounded answer alongside expandable citations.
    """
    if not request.query or not request.query.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Query query text is required."
        )
        
    try:
        logger.info(f"RAG chat request received: {request.query}")
        response = ask_question_rag(db, request.query)
        return response
    except Exception as e:
        logger.exception("RAG chat query execution failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Chat pipeline failed: {str(e)}"
        )
