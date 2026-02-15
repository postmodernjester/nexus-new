-- NEXUS Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS & PROFILES
-- ============================================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  slug TEXT UNIQUE,
  avatar_url TEXT,
  location TEXT,
  website TEXT,
  bio TEXT,
  headline TEXT,
  ai_strengths TEXT[],
  ai_interests TEXT[],
  ai_positioning_statement TEXT,
  ai_trajectory_insight TEXT,
  ai_career_themes TEXT[],
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ORGANIZATIONS
-- ============================================

CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  website TEXT,
  logo_url TEXT,
  industry TEXT,
  location TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- WORK EXPERIENCES
-- ============================================

CREATE TABLE public.experiences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  organization_id UUID REFERENCES public.organizations(id),
  organization_name TEXT NOT NULL,
  engagement_type TEXT NOT NULL CHECK (engagement_type IN (
    'Full-time', 'Part-time', 'Contract', 'Freelance', 'Advisory',
    'Internship', 'Project-based', 'Volunteer', 'Board Member',
    'Self-employed', 'Other'
  )),
  start_month INTEGER CHECK (start_month BETWEEN 1 AND 12),
  start_year INTEGER NOT NULL CHECK (start_year BETWEEN 1950 AND 2100),
  end_month INTEGER CHECK (end_month BETWEEN 1 AND 12),
  end_year INTEGER CHECK (end_year BETWEEN 1950 AND 2100),
  is_active BOOLEAN DEFAULT false,
  location TEXT,
  location_type TEXT CHECK (location_type IN (
    'On-site', 'Hybrid', 'Remote', 'Travel-based', 'Multi-location'
  )),
  description TEXT,
  ai_enhanced_description TEXT,
  headline_override TEXT,
  notify_connections BOOLEAN DEFAULT false,
  -- Compensation (private)
  compensation_type TEXT CHECK (compensation_type IN (
    'Salary', 'Hourly', 'Project Fee', 'Retainer', 'Equity', 'Revenue Share'
  )),
  compensation_amount DECIMAL(12,2),
  compensation_currency TEXT DEFAULT 'USD',
  estimated_hours DECIMAL(8,1),
  total_project_value DECIMAL(12,2),
  payment_status TEXT CHECK (payment_status IN (
    'Paid', 'Partially Paid', 'Pending', 'Pro Bono'
  )),
  compensation_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- EDUCATION
-- ============================================

CREATE TABLE public.education (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  institution TEXT NOT NULL,
  degree TEXT,
  field_of_study TEXT,
  start_year INTEGER,
  end_year INTEGER,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PROJECTS
-- ============================================

CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  url TEXT,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SKILLS & TAGS
-- ============================================

CREATE TABLE public.skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.user_skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  endorsed_count INTEGER DEFAULT 0,
  UNIQUE(user_id, skill_id)
);

CREATE TABLE public.experience_skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  experience_id UUID NOT NULL REFERENCES public.experiences(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  UNIQUE(experience_id, skill_id)
);

CREATE TABLE public.tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  color TEXT DEFAULT '#6366f1',
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CONTACTS (CRM)
-- ============================================

CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Link to real user if claimed
  linked_profile_id UUID REFERENCES public.profiles(id),
  -- Contact info
  full_name TEXT NOT NULL,
  company TEXT,
  role TEXT,
  location TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  avatar_url TEXT,
  -- Relationship
  relationship_type TEXT CHECK (relationship_type IN (
    'Colleague', 'Client', 'Vendor', 'Mentor', 'Mentee', 'Friend',
    'Collaborator', 'Investor', 'Advisor', 'Other'
  )),
  how_we_met TEXT,
  met_date DATE,
  -- Status
  is_claimable BOOLEAN DEFAULT false,
  follow_up_status TEXT CHECK (follow_up_status IN (
    'None', 'Pending', 'Scheduled', 'Overdue'
  )) DEFAULT 'None',
  last_contact_date DATE,
  next_action_date DATE,
  next_action_note TEXT,
  -- Metrics
  communication_frequency INTEGER DEFAULT 0,
  collaboration_depth INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.contact_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  UNIQUE(contact_id, tag_id)
);

-- ============================================
-- NOTES (CRM Dossier)
-- ============================================

CREATE TABLE public.notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  note_type TEXT CHECK (note_type IN (
    'General', 'Meeting', 'Call', 'Email', 'Follow-up', 'Observation'
  )) DEFAULT 'General',
  is_private BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- COMMUNICATIONS LOG
-- ============================================

CREATE TABLE public.communications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'Email', 'Phone', 'Video', 'In-person', 'Message', 'Other'
  )),
  subject TEXT,
  summary TEXT,
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RELATIONSHIP EDGES (Graph)
-- ============================================

CREATE TABLE public.relationship_edges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  relationship_type TEXT,
  strength INTEGER DEFAULT 1 CHECK (strength BETWEEN 1 AND 10),
  is_mutual BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (target_user_id IS NOT NULL OR target_contact_id IS NOT NULL)
);

-- ============================================
-- FINANCIAL TRANSACTIONS
-- ============================================

CREATE TABLE public.financial_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id),
  experience_id UUID REFERENCES public.experiences(id),
  project_id UUID REFERENCES public.projects(id),
  description TEXT,
  amount DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  type TEXT CHECK (type IN ('Income', 'Expense', 'Invoice', 'Payment')),
  status TEXT CHECK (status IN ('Completed', 'Pending', 'Cancelled')) DEFAULT 'Pending',
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MEDIA ITEMS
-- ============================================

CREATE TABLE public.media_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  experience_id UUID REFERENCES public.experiences(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('Image', 'PDF', 'Link', 'Video', 'Audio', 'Book')),
  url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_experiences_user ON public.experiences(user_id);
CREATE INDEX idx_experiences_org ON public.experiences(organization_id);
CREATE INDEX idx_contacts_owner ON public.contacts(owner_id);
CREATE INDEX idx_contacts_linked ON public.contacts(linked_profile_id);
CREATE INDEX idx_notes_contact ON public.notes(contact_id);
CREATE INDEX idx_notes_owner ON public.notes(owner_id);
CREATE INDEX idx_communications_contact ON public.communications(contact_id);
CREATE INDEX idx_edges_source ON public.relationship_edges(source_user_id);
CREATE INDEX idx_edges_target_user ON public.relationship_edges(target_user_id);
CREATE INDEX idx_edges_target_contact ON public.relationship_edges(target_contact_id);
CREATE INDEX idx_financial_owner ON public.financial_transactions(owner_id);
CREATE INDEX idx_financial_contact ON public.financial_transactions(contact_id);
CREATE INDEX idx_media_experience ON public.media_items(experience_id);
CREATE INDEX idx_media_project ON public.media_items(project_id);
CREATE INDEX idx_profiles_slug ON public.profiles(slug);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.education ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relationship_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experience_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_tags ENABLE ROW LEVEL SECURITY;

-- Profiles: public read, owner write
CREATE POLICY "Public profiles are viewable" ON public.profiles
  FOR SELECT USING (is_public = true);
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Experiences: public read, owner write
CREATE POLICY "Public experiences viewable" ON public.experiences
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id AND is_public = true)
  );
CREATE POLICY "Owner manages experiences" ON public.experiences
  FOR ALL USING (auth.uid() = user_id);

-- Education: public read, owner write
CREATE POLICY "Public education viewable" ON public.education
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id AND is_public = true)
  );
CREATE POLICY "Owner manages education" ON public.education
  FOR ALL USING (auth.uid() = user_id);

-- Projects: public read, owner write
CREATE POLICY "Public projects viewable" ON public.projects
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id AND is_public = true)
  );
CREATE POLICY "Owner manages projects" ON public.projects
  FOR ALL USING (auth.uid() = user_id);

-- Contacts: owner only
CREATE POLICY "Owner manages contacts" ON public.contacts
  FOR ALL USING (auth.uid() = owner_id);

-- Notes: owner only
CREATE POLICY "Owner manages notes" ON public.notes
  FOR ALL USING (auth.uid() = owner_id);

-- Communications: owner only
CREATE POLICY "Owner manages communications" ON public.communications
  FOR ALL USING (auth.uid() = owner_id);

-- Relationship edges: owner only
CREATE POLICY "Owner manages edges" ON public.relationship_edges
  FOR ALL USING (auth.uid() = source_user_id);
CREATE POLICY "Target can view edges" ON public.relationship_edges
  FOR SELECT USING (auth.uid() = target_user_id);

-- Financial: owner only
CREATE POLICY "Owner manages finances" ON public.financial_transactions
  FOR ALL USING (auth.uid() = owner_id);

-- Media: public read for public profiles, owner write
CREATE POLICY "Public media viewable" ON public.media_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id AND is_public = true)
  );
CREATE POLICY "Owner manages media" ON public.media_items
  FOR ALL USING (auth.uid() = user_id);

-- Organizations: anyone can read, authenticated can create
CREATE POLICY "Anyone can view orgs" ON public.organizations
  FOR SELECT USING (true);
CREATE POLICY "Auth users create orgs" ON public.organizations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Skills: anyone can read, authenticated can create
CREATE POLICY "Anyone can view skills" ON public.skills
  FOR SELECT USING (true);
CREATE POLICY "Auth users create skills" ON public.skills
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- User skills: public read, owner write
CREATE POLICY "Public user skills viewable" ON public.user_skills
  FOR SELECT USING (true);
CREATE POLICY "Owner manages user skills" ON public.user_skills
  FOR ALL USING (auth.uid() = user_id);

-- Experience skills: public read, owner write
CREATE POLICY "Public exp skills viewable" ON public.experience_skills
  FOR SELECT USING (true);
CREATE POLICY "Owner manages exp skills" ON public.experience_skills
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.experiences WHERE id = experience_id AND user_id = auth.uid())
  );

-- Tags: owner read/write
CREATE POLICY "Anyone can view tags" ON public.tags
  FOR SELECT USING (true);
CREATE POLICY "Auth users create tags" ON public.tags
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Contact tags: owner only
CREATE POLICY "Owner manages contact tags" ON public.contact_tags
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.contacts WHERE id = contact_id AND owner_id = auth.uid())
  );

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, slug)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    LOWER(REPLACE(COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), ' ', '-')) || '-' || SUBSTR(NEW.id::text, 1, 8)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_experiences_updated_at
  BEFORE UPDATE ON public.experiences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
