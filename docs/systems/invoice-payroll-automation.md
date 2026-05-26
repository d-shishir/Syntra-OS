# System Specification: AI Invoice & Payroll Automation

This document outlines the system architecture, database design patterns, compliance audit validation rules, and statistical anomaly detection algorithms implemented in the **AI Invoice & Payroll Automation** module of **Syntra OS**.

---

## 🛠️ Architecture Overview

The system runs a fully automated background pipeline on document upload, integrating structured PostgreSQL extraction with high-dimensional vector search.

```text
                                  [PDF Upload]
                                       │
                                       ▼
                             [Text Extracted]
                               /            \
                              /              \
                             ▼                ▼
                     [Semantic Chunks]   [Structured AI
                             │             Extraction]
                             ▼                │
                    [pgvector Chunks]         ▼
                                       [Audit Verification]
                                       [Anomaly Scanning]
                                              │
                                              ▼
                                     [PostgreSQL Database]
```

---

## 1. Database Schema Specifications

Implemented tables located in the schema migration [create_invoice_payroll_tables.sql](../../database/migrations/create_invoice_payroll_tables.sql):

### 1.1 Invoices Table
Stores metadata relating to company bills and receipts:
* `subtotal`, `tax_amount`, `total_amount` stored as exact `NUMERIC(12, 2)` to prevent floating point inaccuracies.
* Indexed on `vendor_name` and `document_id`.

### 1.2 Payroll Records Table
Stores salary outlays for company workers:
* `deductions` array stored using `JSONB` to support variable tax codes, healthcare premiums, and retirement contributions.
* Indexed on `employee_name` and `document_id`.

### 1.3 Anomalies Table
Stores compliance flags and audit alerts:
* Cascading foreign key relationships to both parent logs (`invoice_id`, `payroll_record_id`) and core file records (`document_id`).
* Active status flag `resolved` (default false).

### 1.4 Processing Logs Table
Logs lifecycle events (`extraction`, `validation`, `anomaly_detection`, `indexing`) for full operational traceability.

---

## 2. Compliance Auditing (Validator Engine)
Located in [validator.py](../../modules/invoice_automation/validator.py), the engine evaluates parsed fields:

* **Field Requirements**: Verifies basic keys exist (e.g. `vendor_name`, `total_amount`, `due_date` for invoices).
* **Invoice Verification**: Confirms calculation accuracy:
  $$\text{Subtotal} + \text{Tax Amount} = \text{Total Amount} \pm \$0.05$$
* **Payroll Verification**: Confirms net compensation consistency:
  $$\text{Basic Salary} - \sum(\text{Deductions}) = \text{Net Pay} \pm \$0.05$$
* **Threshold Flags**: Identifies negative entries, or abnormally high outlays ($> \$100,000$ for invoices or $> \$50,000$ for monthly salaries).

---

## 3. Statistical Anomaly Detector
Located in [anomaly_detector.py](../../modules/invoice_automation/anomaly_detector.py), the engine evaluates entries against historical data in PostgreSQL:

* **Vendor Inconsistencies**: Computes the historical average of invoice totals for a vendor:
  $$\text{Invoice Total} > 2 \times \text{Vendor Average}$$
* **Salary Spikes**: Compares current net pays against employee averages:
  $$\text{Payroll Net Pay} > 1.5 \times \text{Employee Average}$$
* **Tax Rate Fluctuations**: Flags tax rates ($\frac{\text{Tax}}{\text{Subtotal}}$) falling outside standard $2\% - 35\%$ bounds.
* **Duplicate Numbers**: Verifies invoice numbers are unique for each vendor.

---

## 4. API Endpoint Register
Endpoints registered in [router.py](../../modules/invoice_automation/router.py) with prefix `/api/v1/invoice-automation`:

* `GET /invoices`: Returns paginated lists of invoices with vendor and status filters.
* `GET /payroll-records`: Returns paginated lists of employee payroll entries.
* `GET /anomalies`: Lists active risk alerts.
* `POST /anomalies/{anomaly_id}/resolve`: Resolves an alert and updates parent record status.
* `GET /stats`: Aggregates Operational Risk index gauges, outlay values, and severity counters.
* `POST /reprocess/{document_id}`: Re-runs the extraction, audit, indexing, and validation pipeline.
