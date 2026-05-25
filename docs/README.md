# Engineering Documentation: IngestEngine Portal

Welcome to the engineering portal for IngestEngine. This documentation outlines the system requirements, architectural plans, daily progression, and functional designs for our AI Document Intelligence system.

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

- **System Architecture**: [docs/architecture.md](file:///Users/shishirlamichhane/Documents/Projects/AI%20DOCUMENT%20INGESTION%20SYSTEM/docs/architecture.md)
  - Detail on data flows, layer descriptions, and future vector database migrations.
- **System Specifications**:
  - [Document Processor Module](file:///Users/shishirlamichhane/Documents/Projects/AI%20DOCUMENT%20INGESTION%20SYSTEM/docs/systems/document-processor.md)
  - [Future RAG System Spec](file:///Users/shishirlamichhane/Documents/Projects/AI%20DOCUMENT%20INGESTION%20SYSTEM/docs/systems/future-rag-system.md)
- **Progress Tracking**:
  - [30-Day Progress Log](file:///Users/shishirlamichhane/Documents/Projects/AI%20DOCUMENT%20INGESTION%20SYSTEM/docs/progress.md)
  - [Day 01 Progress Log](file:///Users/shishirlamichhane/Documents/Projects/AI%20DOCUMENT%20INGESTION%20SYSTEM/docs/days/day-01.md)
