-- Migration 004: Add investment_data column to evaluations table
-- Stores the full LLM-generated investment recommendation output as JSONB.
-- Null for users who ran evaluation before investment matching was introduced (v3.7).

ALTER TABLE evaluations
  ADD COLUMN IF NOT EXISTS investment_data jsonb;
