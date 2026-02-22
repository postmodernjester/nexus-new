-- Add fuzzy duration columns for uncertain start/end visualization
-- These store how many months the uncertainty zone extends

ALTER TABLE chronicle_entries ADD COLUMN IF NOT EXISTS fuzzy_start_months INTEGER DEFAULT 6;
ALTER TABLE chronicle_entries ADD COLUMN IF NOT EXISTS fuzzy_end_months INTEGER DEFAULT 6;

ALTER TABLE chronicle_places ADD COLUMN IF NOT EXISTS fuzzy_start_months INTEGER DEFAULT 6;
ALTER TABLE chronicle_places ADD COLUMN IF NOT EXISTS fuzzy_end_months INTEGER DEFAULT 6;

ALTER TABLE work_entries ADD COLUMN IF NOT EXISTS chronicle_fuzzy_start_months INTEGER DEFAULT 6;
ALTER TABLE work_entries ADD COLUMN IF NOT EXISTS chronicle_fuzzy_end_months INTEGER DEFAULT 6;

ALTER TABLE education ADD COLUMN IF NOT EXISTS chronicle_fuzzy_start_months INTEGER DEFAULT 6;
ALTER TABLE education ADD COLUMN IF NOT EXISTS chronicle_fuzzy_end_months INTEGER DEFAULT 6;
