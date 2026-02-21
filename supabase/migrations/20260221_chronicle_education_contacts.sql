-- Chronicle columns for education table (like work_entries)
ALTER TABLE education ADD COLUMN IF NOT EXISTS chronicle_color TEXT;
ALTER TABLE education ADD COLUMN IF NOT EXISTS chronicle_fuzzy_start BOOLEAN DEFAULT false;
ALTER TABLE education ADD COLUMN IF NOT EXISTS chronicle_fuzzy_end BOOLEAN DEFAULT false;
ALTER TABLE education ADD COLUMN IF NOT EXISTS chronicle_note TEXT;

-- Show on chronicle flag for contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS show_on_chronicle BOOLEAN DEFAULT false;
