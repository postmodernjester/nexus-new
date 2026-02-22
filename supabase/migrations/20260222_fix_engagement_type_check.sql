-- Fix engagement_type CHECK to include 'self-employed' (present in UI but missing from constraint)
ALTER TABLE work_entries DROP CONSTRAINT IF EXISTS work_entries_engagement_type_check;
ALTER TABLE work_entries ADD CONSTRAINT work_entries_engagement_type_check
  CHECK (engagement_type IN ('full-time', 'part-time', 'contract', 'freelance', 'consulting', 'volunteer', 'internship', 'project-based', 'self-employed'));
