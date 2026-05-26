# Engineering Documentation: Syntra OS Portal

Welcome to the engineering portal for Syntra OS. This documentation outlines the system requirements, architectural layers, milestones progress, and system specifications for our AI-powered Operations Platform.

---

## 🎯 System Goals

1. **Clean Text Extraction**: Standardize raw PDF extraction to output clean text streams, handling multi-column formats and document section boundaries.
2. **Postgres Ingestion Core**: Store text and metadata in a structured, relational SQL environment, optimized for high-performance reading and analytical queries.
3. **RAG Expansion Readiness**: Structure the database, schemas, and processing modules in a loose-coupled format so they can interface with vector databases (like `pgvector` or Pinecone) and LLM prompt orchestrators.
4. **User-Friendly Dashboard**: Provide a visual interface showing processing indicators, metrics, and text previews.

---

## 💻 Tech Stack Summary

| Component | Technology | Version / Spec |
|---|---|---|
| **Frontend UI** | React, TypeScript, Tailwind CSS v4, Vite | SPA Dashboard |
| **Backend API** | FastAPI, Python 3.13, Uvicorn | REST, Async |
| **PDF Extraction** | pdfplumber | Stream processing |
| **Database** | PostgreSQL | Docker container v15+ |
| **Security** | Pydantic Settings, CORS policies, parametrizations | - |

---

## 📂 Documentation Navigational Index

- **System Architecture**: [docs/architecture.md](./architecture.md)
  - Detail on data flows, layer descriptions, and vector database migrations.
- **System Specifications**:
  - [Document Processor Module](./systems/document-processor.md)
  - [RAG QA Chat System Spec](./systems/rag-system.md)
  - [Vector Storage & Semantic Search](./systems/vector-storage.md)
  - [AI Invoice & Payroll Automation Spec](./systems/invoice-payroll-automation.md)
- **Progress Tracking**:
  - [30-Day Progress Log](./progress.md)
  - [Day 01 Progress Log](./days/day-01.md)
  - [Day 02 Progress Log](./days/day-02.md)
  - [Day 03 Progress Log](./days/day-03.md)
  - [Day 04 Progress Log](./days/day-04.md)
  - [Day 05 Progress Log](./days/day-05.md)
