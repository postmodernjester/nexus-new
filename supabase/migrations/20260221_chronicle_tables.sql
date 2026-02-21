-- Chronicle feature tables
-- Run this in your Supabase SQL Editor

-- New table: chronicle_entries (projects, personal, tech, milestones)
CREATE TABLE chronicle_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_date TEXT,
  end_date TEXT,
  canvas_col TEXT,
  color TEXT,
  fuzzy_start BOOLEAN DEFAULT false,
  fuzzy_end BOOLEAN DEFAULT false,
  note TEXT,
  show_on_resume BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- New table: chronicle_places (geography bands)
CREATE TABLE chronicle_places (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  color TEXT,
  fuzzy_start BOOLEAN DEFAULT false,
  fuzzy_end BOOLEAN DEFAULT false,
  note TEXT,
  show_on_resume BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add chronicle columns to existing work_entries table
ALTER TABLE work_entries ADD COLUMN IF NOT EXISTS chronicle_color TEXT;
ALTER TABLE work_entries ADD COLUMN IF NOT EXISTS chronicle_fuzzy_start BOOLEAN DEFAULT false;
ALTER TABLE work_entries ADD COLUMN IF NOT EXISTS chronicle_fuzzy_end BOOLEAN DEFAULT false;
ALTER TABLE work_entries ADD COLUMN IF NOT EXISTS chronicle_note TEXT;

-- Add chronicle columns to existing contacts table
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS chronicle_color TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS chronicle_fuzzy_start BOOLEAN DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS chronicle_fuzzy_end BOOLEAN DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS chronicle_note TEXT;

-- Enable RLS
ALTER TABLE chronicle_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE chronicle_places ENABLE ROW LEVEL SECURITY;

-- RLS policies for chronicle_entries
CREATE POLICY "Users can view own chronicle entries"
  ON chronicle_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chronicle entries"
  ON chronicle_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chronicle entries"
  ON chronicle_entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chronicle entries"
  ON chronicle_entries FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for chronicle_places
CREATE POLICY "Users can view own chronicle places"
  ON chronicle_places FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chronicle places"
  ON chronicle_places FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chronicle places"
  ON chronicle_places FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chronicle places"
  ON chronicle_places FOR DELETE
  USING (auth.uid() = user_id);
