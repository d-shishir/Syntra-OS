# Day 01: Initial Architecture & Ingestion Setup

## Completed Work

### 1. Repository Initialization & Database Configuration
- Scaffolding monorepo structures: `/frontend`, `/backend`, `/database`, `/docs`, and `/ai`.
- Created database migration schemas in `database/schema.sql`.
- Evaluated and integrated the local Docker PostgreSQL database `baghchal-postgres` running on port `5433`.
- Applied the database schema and confirmed table creation.

### 2. FastAPI Backend Development
- Configured FastAPI environment with custom settings class inside `config.py` loading configurations from `.env`.
- Handled Python 3.13 dependencies in `requirements.txt` by updating SQLAlchemy and `psycopg2-binary`.
- Created the PDF extraction worker module using `pdfplumber`.
- Exposed CRUD routes for document uploads, document list queries, and detail retrievals.

### 3. Frontend App Interface
- Initialized React + TypeScript scaffolding using Vite.
- Implemented Tailwind CSS v4 using the native `@tailwindcss/vite` plugin for faster compiles.
- Created components for drag-and-drop file upload, document lists, and a detail reader drawer.
- Completed full integration connecting API calls between port `5173` and `8000`.

---

## Technical Challenges Resolved
- **Python 3.13 SQLAlchemy Typing Conflict**: Resolved class attributes inheritance collision by locking SQLAlchemy to `>=2.0.50`.
- **PostCSS Tailwind v4 Config**: Migrated PostCSS dependencies to the new `@tailwindcss/vite` compiler configuration.
