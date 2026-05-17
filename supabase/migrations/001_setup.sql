-- =============================================================================
-- Migration 001: Initial Setup
-- =============================================================================
-- Purpose: Enable extensions, create utility functions, set up shared types
-- Dependencies: None (first migration)
-- =============================================================================

-- Enable extensions
-- pgcrypto: not needed for UUIDs (Postgres has gen_random_uuid built-in),
-- but useful for crypto functions if needed later
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- Utility Functions
-- =============================================================================

-- Updates the updated_at column on row modification
-- Used by triggers on all main tables
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Generates a case number in format YYYY-NNN (e.g., 2026-001)
-- Used as default for cases.case_number
CREATE OR REPLACE FUNCTION public.generate_case_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  current_year INT := EXTRACT(YEAR FROM NOW())::INT;
  next_seq INT;
BEGIN
  -- Get the next sequence for the current year
  SELECT COALESCE(MAX(CAST(SPLIT_PART(case_number, '-', 2) AS INT)), 0) + 1
  INTO next_seq
  FROM public.cases
  WHERE case_number LIKE current_year::TEXT || '-%';

  RETURN current_year::TEXT || '-' || LPAD(next_seq::TEXT, 3, '0');
END;
$$;

-- =============================================================================
-- Notes
-- =============================================================================
-- 1. RLS is enabled per-table in their respective migrations
-- 2. Default policies will be defined in 011_rls.sql
-- 3. Audit triggers will be defined in 012_triggers.sql
