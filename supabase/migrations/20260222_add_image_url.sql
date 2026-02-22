-- Add image_url column to chronicle_entries for project images
ALTER TABLE chronicle_entries ADD COLUMN IF NOT EXISTS image_url TEXT;
