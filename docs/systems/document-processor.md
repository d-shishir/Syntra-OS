# System Specification: Document Processor Module

This document outlines the mechanics, constraints, and validation protocols implemented in the PDF Text Processing module.

---

## 🛠️ Technology Choices
- **Library**: `pdfplumber` (v0.11.0)
- **Rationale**: Unlike standard alternatives like PyPDF2, `pdfplumber` provides finer control over layout extraction, handles table structures gracefully, and returns character metadata containing coordinates—essential for future layout-aware chunking strategies.

---

## 🔍 Ingestion Pipeline Flow

```text
[Raw PDF Bytes] ──> [io.BytesIO Stream] ──> [pdfplumber Open]
                                                   │
                                          ┌────────┴────────┐
                                          ▼                 ▼
                                    [Page Loop]       [Validation]
                                          │                 │
                                    [extract_text]   [Check Blank Pages]
                                          │                 │
                                          ▼                 ▼
                                    [Sanitize]        [Empty Check]
                                          │                 │
                                          └────────┬────────┘
                                                   ▼
                                          [SQL Insert Record]
```

---

## 🔒 Security & Validation Gating

To prevent Denial of Service (DoS) attacks and malicious inputs, the document processor enforces the following rules:

1. **Size Limits**: Gated to a maximum of 20MB (`20 * 1024 * 1024` bytes) at the API gateway layer to prevent resource starvation.
2. **Format Constraints**: Verifies that the file header begins with `%PDF` and checking that file media extensions match `application/pdf`.
3. **Empty Text Guard**: If the extracted output consists of only whitespace (typical of scanned files or empty files), the processor raises an `HTTP 422 Unprocessable Entity` response, asking the user to upload a text-readable PDF.

---

## 🧩 Code Extraction Signature
Located in [pdf_processor.py](file:///Users/shishirlamichhane/Documents/Projects/AI%20DOCUMENT%20INGESTION%20SYSTEM/backend/app/pdf_processor.py):
```python
def extract_text_from_pdf(file_bytes: bytes) -> str:
    # Extracts text on page-by-page iteration
    # Inserts custom Page Break boundaries: "\n\n--- Page Break ---\n\n"
```
