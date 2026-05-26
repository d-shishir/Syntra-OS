import sys
import os
import uuid
from datetime import datetime

# Adjust sys.path to include backend and root
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend")))

from app.database import SessionLocal, engine
from app.models import Document
from app.services.extractor import extract_structured_data
from app.services.chunker import split_text_into_chunks
from app.services.embeddings import get_embedding
from app.services.vector_store import save_document_chunks
from app.services.rag_pipeline import ask_question_rag
from modules.invoice_automation.models import Invoice, PayrollRecord, Anomaly, ProcessingLog
from modules.invoice_automation.invoice_service import process_invoice
from modules.invoice_automation.payroll_service import process_payroll

def run_tests():
    print("=== Starting Financial Document Integration Pipeline Tests ===")
    
    # 1. DB connection check
    db = SessionLocal()
    try:
        # Clear existing test documents to start fresh
        db.query(Document).filter(Document.filename.like("test_%.pdf")).delete(synchronize_session=False)
        db.commit()
        print("[1] Cleaned previous test documents from PostgreSQL.")
    except Exception as e:
        print(f"[ERROR] Database connection failed: {str(e)}")
        sys.exit(1)

    # 2. Test Invoice Processing
    print("\n[2] Ingesting test invoice...")
    invoice_text = """
    ACME Corporation Solutions Ltd
    INVOICE
    Invoice Number: INV-992211
    Date: 2026-05-26
    Due Date: 2026-06-25
    Bill To: Syntra OS Org
    
    Subtotal: 10000.00
    Tax Amount: 1500.00
    Total Amount: 11500.00
    
    Payment Terms: Net 30
    """
    
    doc_inv = Document(
        id=uuid.uuid4(),
        filename="test_acme_invoice.pdf",
        content=invoice_text,
        file_size=len(invoice_text),
        mime_type="application/pdf"
    )
    db.add(doc_inv)
    db.commit()
    db.refresh(doc_inv)
    print(f"Created Document record: {doc_inv.filename} (ID: {doc_inv.id})")
    
    # Index into Vector DB
    print("Indexing text chunks into pgvector...")
    chunks = split_text_into_chunks(doc_inv.content)
    embeddings = [get_embedding(c["chunk_text"]) for c in chunks]
    save_document_chunks(db, str(doc_inv.id), chunks, embeddings)
    print(f"Indexed {len(chunks)} chunks.")
    
    # Run structured AI extraction
    print("Running structured AI extraction...")
    extracted_inv = extract_structured_data(doc_inv.content)
    print("Extracted Data JSON:", extracted_inv)
    
    # Run invoice service
    print("Running invoice processing & auditing pipeline...")
    invoice_record = process_invoice(db, str(doc_inv.id), extracted_inv)
    print(f"Created Invoice: Vendor={invoice_record.vendor_name}, Total={invoice_record.total_amount}, Status={invoice_record.status}")
    
    # Verify anomalies
    anoms = db.query(Anomaly).filter(Anomaly.invoice_id == invoice_record.id).all()
    print(f"Anomalies detected: {len(anoms)}")
    for a in anoms:
        print(f"  - [{a.severity}] {a.rule_name}: {a.description}")
        
    # 3. Test Payroll Processing
    print("\n[3] Ingesting test payroll...")
    payroll_text = """
    EMPLOYEE PAYSLIP - Syntra OS Org
    Employee Name: John Miller
    Payment Date: 2026-05-26
    Basic Monthly Salary: 6500.00
    Deductions:
      - Federal Tax: 500.00
      - Health Premium: 150.00
    Net Pay: 5850.00
    """
    
    doc_pay = Document(
        id=uuid.uuid4(),
        filename="test_john_payroll.pdf",
        content=payroll_text,
        file_size=len(payroll_text),
        mime_type="application/pdf"
    )
    db.add(doc_pay)
    db.commit()
    db.refresh(doc_pay)
    print(f"Created Document record: {doc_pay.filename} (ID: {doc_pay.id})")
    
    # Index payroll
    chunks_p = split_text_into_chunks(doc_pay.content)
    embeddings_p = [get_embedding(c["chunk_text"]) for c in chunks_p]
    save_document_chunks(db, str(doc_pay.id), chunks_p, embeddings_p)
    print(f"Indexed {len(chunks_p)} chunks.")
    
    # Extract & process payroll
    extracted_pay = extract_structured_data(doc_pay.content)
    print("Extracted Payroll JSON:", extracted_pay)
    
    payroll_record = process_payroll(db, str(doc_pay.id), extracted_pay)
    print(f"Created Payroll: Employee={payroll_record.employee_name}, Net={payroll_record.net_pay}, Status={payroll_record.status}")
    
    anoms_p = db.query(Anomaly).filter(Anomaly.payroll_record_id == payroll_record.id).all()
    print(f"Anomalies detected: {len(anoms_p)}")
    for a in anoms_p:
        print(f"  - [{a.severity}] {a.rule_name}: {a.description}")

    # 4. Test Anomalies (Inconsistent invoice total)
    print("\n[4] Ingesting anomalous invoice (inconsistent total)...")
    bad_invoice_text = """
    Beta Corp Inc
    INVOICE
    Invoice Number: INV-0044
    Date: 2026-05-26
    Due Date: 2026-06-25
    Bill To: Syntra OS Org
    
    Subtotal: 5000.00
    Tax Amount: 500.00
    Total Amount: 9999.00
    """
    
    doc_bad = Document(
        id=uuid.uuid4(),
        filename="test_beta_anomalous_invoice.pdf",
        content=bad_invoice_text,
        file_size=len(bad_invoice_text),
        mime_type="application/pdf"
    )
    db.add(doc_bad)
    db.commit()
    db.refresh(doc_bad)
    
    extracted_bad = extract_structured_data(doc_bad.content)
    bad_invoice_record = process_invoice(db, str(doc_bad.id), extracted_bad)
    print(f"Created Invoice: Vendor={bad_invoice_record.vendor_name}, Total={bad_invoice_record.total_amount}, Status={bad_invoice_record.status}")
    
    anoms_bad = db.query(Anomaly).filter(Anomaly.invoice_id == bad_invoice_record.id).all()
    print(f"Anomalies detected (should be >0): {len(anoms_bad)}")
    for a in anoms_bad:
        print(f"  - [{a.severity}] {a.rule_name}: {a.description}")

    # 5. Test RAG Queries
    print("\n[5] Testing financial RAG queries...")
    queries = [
        "What is the invoice number for INV-992211?",
        "Show John Miller's payroll net pay"
    ]
    
    for q in queries:
        print(f"Query: '{q}'")
        rag_res = ask_question_rag(db, q)
        print(f"Answer: {rag_res['answer']}")
        print(f"Sources cited: {[s['filename'] for s in rag_res['sources']]}\n")

    print("=== All Integration Pipeline Tests Executed ===")
    db.close()

if __name__ == "__main__":
    run_tests()
