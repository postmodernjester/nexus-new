-- Add resume_data JSONB column to contacts for storing parsed resume info
-- Structure: { work: [...], education: [...], raw_text?: string }
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS resume_data JSONB;
