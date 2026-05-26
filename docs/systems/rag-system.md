# System Specification: Grounded RAG Chat Engine

This document details the layout, query sequences, prompt instructions, and reference mappings implemented in Syntra OS's RAG Chat Assistant Workspace.

---

## 🛠️ Pipeline Architecture

```text
[User Q&A Query]
       │
       ▼
  1. [Embed query] ──► (768-dimensional BAAI vector representation)
       │
       ▼
  2. [pgvector search] ──► (Retrieve Top-4 closest document chunks via HNSW index)
       │
       ▼
  3. [Assemble payload] ──► (Compile SYSTEM instructions + CONTEXT block + USER query)
       │
       ├─────────────────────────────────┐
       ▼ (If Key present)                ▼ (If Key missing)
  4. [OpenAI API Call]             [Mock RAG Solver]
       │                                 │
       ▼                                 │
  5. [Grounded Answer Output]             │
       │                                 │
       ▼                                 ▼
  6. [Assemble Response JSON] ◄───────────┘
       │
       ▼
(Payload returns answer + filename citations + similarity scores)
```

---

## 1. System Prompt Constraints
Located in [prompt_builder.py](../../backend/app/services/prompt_builder.py).
- **Core Instruction**: The LLM acts as a strict document QA assistant. It must base its answers *solely* on the injected context block.
- **Strict Grounding Shield**: If the information is not directly explicitly contained in the matched chunks, the LLM is instructed to respond with the exact statement: `"Not found in documents"`. This mitigates hallucinated statements.
- **Citations and Metadata mapping**: Each returned answer maps the source database UUID, the raw chunk string content, the matching similarity score, and the target filename.

---

## 2. RAG Route Handler
Exposed at the API gateway layer inside [main.py](../../backend/app/main.py):
* **Endpoint**: `POST /chat-with-documents`
* **Schema**:
  * Request: `{"query": "User Question"}`
  * Response:
    ```json
    {
      "answer": "Grounded answer text...",
      "sources": [
        {
          "document_id": "UUID-Reference",
          "chunk_text": "Content snippet...",
          "score": 0.954,
          "filename": "Source.pdf"
        }
      ]
    }
    ```
* **Offline Mock Execution**: If `OPENAI_API_KEY` is not present, `rag_pipeline.py` filters chunk lines against query keywords to construct a grounded response paragraph locally.
