-- Migration: Add extracted_json column to documents table

ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS extracted_json JSONB;
