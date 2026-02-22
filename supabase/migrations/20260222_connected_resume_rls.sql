-- RLS policies so contact owners can view their linked contact's resume data.
-- A user who has linked_profile_id on a contact can read that profile's
-- profiles, work_entries, chronicle_entries (show_on_resume items), and education.

-- Drop any that may already exist to avoid "already exists" errors
DROP POLICY IF EXISTS "Connected users can view chronicle entries" ON public.chronicle_entries;
DROP POLICY IF EXISTS "Connected users can view education" ON public.education;
DROP POLICY IF EXISTS "Linked contact owners can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Linked contact owners can view work entries" ON public.work_entries;
DROP POLICY IF EXISTS "Linked contact owners can view chronicle entries" ON public.chronicle_entries;
DROP POLICY IF EXISTS "Linked contact owners can view education" ON public.education;

-- Linked contact owners can view the linked user's data
CREATE POLICY "Linked contact owners can view profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.contacts WHERE owner_id = auth.uid() AND linked_profile_id = profiles.id)
  );

CREATE POLICY "Linked contact owners can view work entries" ON public.work_entries
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.contacts WHERE owner_id = auth.uid() AND linked_profile_id = work_entries.user_id)
  );

CREATE POLICY "Linked contact owners can view chronicle entries" ON public.chronicle_entries
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.contacts WHERE owner_id = auth.uid() AND linked_profile_id = chronicle_entries.user_id)
  );

CREATE POLICY "Linked contact owners can view education" ON public.education
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.contacts WHERE owner_id = auth.uid() AND linked_profile_id = education.user_id)
  );
