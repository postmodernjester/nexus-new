-- Fix: contact_notes table was missing UPDATE/DELETE RLS policies.
-- This caused action item checkbox toggles to silently fail (0 rows affected).

-- Ensure RLS is enabled
ALTER TABLE public.contact_notes ENABLE ROW LEVEL SECURITY;

-- Drop any existing per-operation policies to avoid conflicts
DROP POLICY IF EXISTS "Owner can view contact notes" ON public.contact_notes;
DROP POLICY IF EXISTS "Owner can insert contact notes" ON public.contact_notes;
DROP POLICY IF EXISTS "Owner can update contact notes" ON public.contact_notes;
DROP POLICY IF EXISTS "Owner can delete contact notes" ON public.contact_notes;
DROP POLICY IF EXISTS "Owner manages contact notes" ON public.contact_notes;

-- Single ALL policy: owner can SELECT, INSERT, UPDATE, DELETE their own notes
CREATE POLICY "Owner manages contact notes" ON public.contact_notes
  FOR ALL USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);
