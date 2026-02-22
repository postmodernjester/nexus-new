-- Allow connected users to read each other's chronicle_entries (for resume view on contact page)
CREATE POLICY "Connected users can view chronicle entries" ON public.chronicle_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.connections
      WHERE status = 'accepted'
      AND (
        (inviter_id = auth.uid() AND invitee_id = chronicle_entries.user_id)
        OR (invitee_id = auth.uid() AND inviter_id = chronicle_entries.user_id)
      )
    )
  );

-- Allow connected users to read each other's education entries
CREATE POLICY "Connected users can view education" ON public.education
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.connections
      WHERE status = 'accepted'
      AND (
        (inviter_id = auth.uid() AND invitee_id = education.user_id)
        OR (invitee_id = auth.uid() AND inviter_id = education.user_id)
      )
    )
  );

-- Also allow viewing data for users linked via contacts (linked_profile_id)
-- This covers the case where a contact is linked but no formal connection exists
CREATE POLICY "Linked contact owners can view profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.contacts
      WHERE owner_id = auth.uid()
      AND linked_profile_id = profiles.id
    )
  );

CREATE POLICY "Linked contact owners can view work entries" ON public.work_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.contacts
      WHERE owner_id = auth.uid()
      AND linked_profile_id = work_entries.user_id
    )
  );

CREATE POLICY "Linked contact owners can view chronicle entries" ON public.chronicle_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.contacts
      WHERE owner_id = auth.uid()
      AND linked_profile_id = chronicle_entries.user_id
    )
  );

CREATE POLICY "Linked contact owners can view education" ON public.education
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.contacts
      WHERE owner_id = auth.uid()
      AND linked_profile_id = education.user_id
    )
  );
