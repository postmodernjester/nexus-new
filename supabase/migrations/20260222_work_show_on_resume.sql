-- Add show_on_resume flag to work_entries (defaults to true so existing entries remain visible)
ALTER TABLE work_entries ADD COLUMN IF NOT EXISTS show_on_resume BOOLEAN DEFAULT true;

-- Add show_on_resume flag to education (defaults to true)
ALTER TABLE education ADD COLUMN IF NOT EXISTS show_on_resume BOOLEAN DEFAULT true;
