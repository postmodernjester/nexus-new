-- Work Experience Entries
CREATE TABLE work_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  company TEXT,
  engagement_type TEXT CHECK (engagement_type IN ('full-time', 'part-time', 'contract', 'freelance', 'consulting', 'volunteer', 'internship', 'project-based')),
  start_date DATE,
  end_date DATE,
  is_current BOOLEAN DEFAULT false,
  description TEXT,
  location TEXT,
  remote_type TEXT CHECK (remote_type IN ('onsite', 'remote', 'hybrid')),
  compensation_amount NUMERIC,
  compensation_currency TEXT DEFAULT 'USD',
  compensation_period TEXT CHECK (compensation_period IN ('hourly', 'daily', 'weekly', 'monthly', 'annually', 'project', 'retainer')),
  compensation_notes TEXT,
  is_compensation_private BOOLEAN DEFAULT true,
  media_urls TEXT[] DEFAULT '{}',
  ai_summary TEXT,
  ai_skills_extracted TEXT[] DEFAULT '{}',
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Skills
CREATE TABLE skills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  proficiency TEXT CHECK (proficiency IN ('beginner', 'intermediate', 'advanced', 'expert')),
  years_experience NUMERIC,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Work Entry Skills (junction table)
CREATE TABLE work_entry_skills (
  work_entry_id UUID REFERENCES work_entries(id) ON DELETE CASCADE,
  skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
  PRIMARY KEY (work_entry_id, skill_id)
);

-- Education
CREATE TABLE education (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  institution TEXT NOT NULL,
  degree TEXT,
  field_of_study TEXT,
  start_date DATE,
  end_date DATE,
  is_current BOOLEAN DEFAULT false,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Projects
CREATE TABLE projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  url TEXT,
  role TEXT,
  start_date DATE,
  end_date DATE,
  is_current BOOLEAN DEFAULT false,
  media_urls TEXT[] DEFAULT '{}',
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE work_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_entry_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE education ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Users can CRUD their own work entries
CREATE POLICY "Users can view own work entries" ON work_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own work entries" ON work_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own work entries" ON work_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own work entries" ON work_entries FOR DELETE USING (auth.uid() = user_id);

-- Users can CRUD their own skills
CREATE POLICY "Users can view own skills" ON skills FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own skills" ON skills FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own skills" ON skills FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own skills" ON skills FOR DELETE USING (auth.uid() = user_id);

-- Work entry skills follow work entry ownership
CREATE POLICY "Users can view own work entry skills" ON work_entry_skills FOR SELECT 
  USING (EXISTS (SELECT 1 FROM work_entries WHERE id = work_entry_id AND user_id = auth.uid()));
CREATE POLICY "Users can insert own work entry skills" ON work_entry_skills FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM work_entries WHERE id = work_entry_id AND user_id = auth.uid()));
CREATE POLICY "Users can delete own work entry skills" ON work_entry_skills FOR DELETE 
  USING (EXISTS (SELECT 1 FROM work_entries WHERE id = work_entry_id AND user_id = auth.uid()));

-- Users can CRUD their own education
CREATE POLICY "Users can view own education" ON education FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own education" ON education FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own education" ON education FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own education" ON education FOR DELETE USING (auth.uid() = user_id);

-- Users can CRUD their own projects
CREATE POLICY "Users can view own projects" ON projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own projects" ON projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON projects FOR DELETE USING (auth.uid() = user_id);

-- Public can view work entries for public profiles (no compensation)
CREATE POLICY "Public can view public work entries" ON work_entries FOR SELECT 
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = work_entries.user_id AND is_public = true));

-- Updated_at trigger function (reuse if exists)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER work_entries_updated_at BEFORE UPDATE ON work_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER education_updated_at BEFORE UPDATE ON education FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
