# System Specification: AI Structured Data Extractor

This document outlines the design decisions, schemas, prompt constructs, and error-recovery routines implemented in the LLM Structured Ingestion module.

---

## 🛠️ Design Decisions

- **Framework integration**: The service runs as a stateless processing unit under `/backend/app/services/extractor.py`.
- **JSON Validation**: Enforces standard schemas by utilising OpenAI's JSON Mode (`response_format={"type": "json_object"}`).
- **Self-Healing Layer**: Raw strings are verified using python `json` loads. If decoding errors emerge, regex heuristics remove markdown tags and trail commas. If recovery fails, a fallback parser simulates key features based on keyword pattern matching.

---

## 📂 Target Schemas

### 1. Invoice & Billing Schema
Triggered when document keywords match billing terms:
```json
{
  "document_type": "invoice",
  "vendor": "Name of the merchant",
  "amount": "Total billing amount (string format)",
  "currency": "Three-letter currency code",
  "date": "Issue date (YYYY-MM-DD)",
  "invoice_number": "Reference index"
}
```

### 2. General Document Schema
Default fallback structure:
```json
{
  "document_type": "general",
  "title": "Document Title",
  "summary": "AI summary paragraph",
  "key_points": [
    "Core point 1",
    "Core point 2",
    "Core point 3"
  ]
}
```

---

## 🚀 Execution Flow

```text
[Raw text input]
       │
       ▼
[Heuristic Classification] ──► (Invoice or General Document?)
       │
       ▼
[Build prompt payload] ──► (Inject schemas and strict instructions)
       │
       ├─────────────────────────────────┐
       ▼ (If Key present)                ▼ (If Key missing)
[OpenAI API Call]                 [Mock Fallback Engine]
       │                                 │
       ▼                                 │
[Attempt JSON loads]                     │
       │                                 │
       ├──────────────┐                  │
       ▼ (Success)    ▼ (Failed)         │
[Return JSON]    [Regex Repair]          │
                      │                  │
                      ├─────────┐        │
                      ▼ (Works) ▼ (Fails)│
                 [Return JSON]  [Mock Run] ──► [Return parsed JSON]
```
