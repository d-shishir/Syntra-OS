# Day 02: AI Structured Data Extraction Layer

## Completed Work

### 1. Database Migration
- Created migration script `./database/migrations/add_extracted_json.sql`.
- Added `extracted_json` (JSONB) column mapping to PostgreSQL `documents` table.
- Confirmed database alterations completed successfully.

### 2. Backend Extraction Service (`extractor.py`)
- Integrated OpenAI Python SDK.
- Implemented heuristic classifier detecting document types (invoices vs general text files).
- Configured JSON Mode request format parameters targeting `gpt-4o-mini` models.
- Built JSON validation & formatting repair mechanisms (stripping markdown fences, trailing commas).
- Added a deterministic Mock parser fallback to guarantee offline local functionality if no `OPENAI_API_KEY` is present.
- Exposed the `POST /documents/{id}/extract` FastAPI route.

### 3. Frontend Drawer Interface Upgrade
- Created split-tab layout inside `DocumentViewer.tsx` allowing toggle views between raw text and parsed JSON output cards.
- Integrated trigger controls ("Run AI Extraction") with loading spinner indications.
- Styled formatted JSON previews using color-themed syntax blocks.
