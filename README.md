# IngestEngine: AI Document Ingestion System

A production-ready internal platform for document ingestion, raw text extraction, and analytics, designed to serve as the foundation for a company-wide Retrieval-Augmented Generation (RAG) knowledge base.

---

## 🏗️ Monorepo Structure

```text
├── backend/          # FastAPI REST API (Python 3.13)
├── frontend/         # React + TypeScript + Tailwind CSS v4 SPA
├── database/         # PostgreSQL DDL and schema migrations
├── ai/               # Future RAG, chunking, and embedding workflows
├── docs/             # Technical System Engineering Documentation
│   ├── README.md     # Engineering portal overview
│   ├── architecture.md# Detailed system layers and data flows
│   ├── systems/      # System-specific developer specs
│   ├── days/         # Iteration progress logs
│   └── progress.md   # 30-day development milestones tracking
└── .gitignore        # Universal ignore rules
```

---

## 🛠️ Tech Stack & Key Layers

- **Frontend**: React 18, TypeScript, Tailwind CSS v4, Vite, Lucide Icons
- **Backend**: FastAPI, SQLAlchemy (v2), pdfplumber (Text Extraction), Uvicorn
- **Database**: PostgreSQL (UUID keys, optimization indexes, future-ready vector store)
- **AI/RAG Readiness**: Modular text block schema ready for embedding vectors and similarity indexing.

---

## 🚀 Quick Start Guide

### 1. Database Setup
Ensure PostgreSQL is running. To initialize the ingestion schema on your database:
```bash
# Run schema definition script against your local postgres server
psql -h <host> -p <port> -U <user> -d <dbname> -f database/schema.sql
```

### 2. Backend API Setup
Configure and spin up the FastAPI service:
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python run.py
```
*Note: The API server will run at [http://localhost:8000](http://localhost:8000).*

### 3. Frontend Portal Setup
Start the client interface:
```bash
cd frontend
npm install
npm run dev
```
*Note: The React client will run at [http://localhost:5173](http://localhost:5173).*

---

## 🔒 Security Practices
1. **Secrets Management**: Database passwords and API endpoints are loaded via environment variables (`.env`) using `pydantic-settings`. Do not hardcode database URIs in source control.
2. **File Validation**: File size limits (max 20MB) and mime-type checks (strictly `application/pdf`) are enforced at both frontend and backend entry points.
3. **ORM Injection Defense**: Database operations are parametrized using SQLAlchemy’s expression language to prevent SQL Injection vectors.

---

## 📖 System Documentation
Detailed engineering design documents can be found inside the `/docs` folder:
- **System Overview**: [docs/README.md](file:///Users/shishirlamichhane/Documents/Projects/AI%20DOCUMENT%20INGESTION%20SYSTEM/docs/README.md)
- **Detailed Design & Dataflow**: [docs/architecture.md](file:///Users/shishirlamichhane/Documents/Projects/AI%20DOCUMENT%20INGESTION%20SYSTEM/docs/architecture.md)
- **Pipeline Progress Tracker**: [docs/progress.md](file:///Users/shishirlamichhane/Documents/Projects/AI%20DOCUMENT%20INGESTION%20SYSTEM/docs/progress.md)
