-- Fix contacts relationship_type constraint to match what the UI sends
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_relationship_type_check;
ALTER TABLE contacts ADD CONSTRAINT contacts_relationship_type_check 
  CHECK (relationship_type IN ('Family', 'Close Friend', 'Business Contact', 'Acquaintance', 'Stranger'));

-- Fix skills table to work as user-owned skills (not a shared lookup)
-- Drop old skills table and user_skills junction if they exist
DROP TABLE IF EXISTS user_skills CASCADE;
DROP TABLE IF EXISTS skills CASCADE;

-- Create skills table that matches what the resume code expects
CREATE TABLE skills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  proficiency INTEGER DEFAULT 3 CHECK (proficiency >= 1 AND proficiency <= 5),
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on skills
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own skills" ON skills FOR ALL USING (auth.uid() = user_id);

-- Fix education table to have the columns the code expects
-- Add missing columns if they don't exist
DO $$ 
BEGIN
  -- Add is_current if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'education' AND column_name = 'is_current') THEN
    ALTER TABLE education ADD COLUMN is_current BOOLEAN DEFAULT FALSE;
  END IF;
  
  -- Add start_date if missing (code uses start_date instead of start_year)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'education' AND column_name = 'start_date') THEN
    ALTER TABLE education ADD COLUMN start_date DATE;
  END IF;
  
  -- Add end_date if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'education' AND column_name = 'end_date') THEN
    ALTER TABLE education ADD COLUMN end_date DATE;
  END IF;
END $$;

-- Create work_entries table if it doesn't exist (resume code uses this, not experiences)
CREATE TABLE IF NOT EXISTS work_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  is_current BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on work_entries
ALTER TABLE work_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own work_entries" ON work_entries;
CREATE POLICY "Users can manage own work_entries" ON work_entries FOR ALL USING (auth.uid() = user_id);

-- Verify everything
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
