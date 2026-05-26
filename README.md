# Syntra OS: AI-Powered Operations Platform

A production-ready enterprise platform for document ingestion, raw text extraction, and analytics, designed to serve as a company-wide Retrieval-Augmented Generation (RAG) knowledge base with integrated financial auditing modules.

---

## 🏗️ Monorepo Structure

```text
├── backend/          # FastAPI REST API (Python 3.13)
├── frontend/         # React + TypeScript + Tailwind CSS v4 SPA
├── database/         # PostgreSQL DDL and schema migrations
├── modules/          # Core pluggable business logic modules
│   └── invoice_automation/ # AI Invoice & Payroll auditing services
├── ai/               # RAG, chunking, and embedding workflows
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
- **Database**: PostgreSQL (pgvector, HNSW optimized similarity search, UUID keys)
- **AI/RAG Integration**: Multi-chunk embeddings pipeline (768-dim BAAI bge-base-en-v1.5), cosine similarity matching, OpenAI/OpenRouter chat context completion.
- **Fintech Automation**: Validator calculation auditing engine and statistical anomaly checking.

---

## 🚀 Quick Start Guide

### 1. Database Setup
Ensure PostgreSQL is running. To initialize the base schema on your database:
```bash
# Run base schema script
psql -h <host> -p <port> -U <user> -d <dbname> -f database/schema.sql

# Apply migrations sequentially
psql -h <host> -p <port> -U <user> -d <dbname> -f database/migrations/create_chunks_table.sql
psql -h <host> -p <port> -U <user> -d <dbname> -f database/migrations/add_extracted_json.sql
psql -h <host> -p <port> -U <user> -d <dbname> -f database/migrations/create_invoice_payroll_tables.sql
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
- **System Overview**: [docs/README.md](./docs/README.md)
- **Detailed Design & Dataflow**: [docs/architecture.md](./docs/architecture.md)
- **Pipeline Progress Tracker**: [docs/progress.md](./docs/progress.md)
