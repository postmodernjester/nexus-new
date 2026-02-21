-- Allow connected users to read each other's profiles
-- Without this, only public profiles (is_public = true) are readable by others,
-- so linked users' updated names/headlines aren't visible to their connections.

CREATE POLICY "Connected users can view profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.connections
      WHERE status = 'accepted'
      AND (
        (inviter_id = auth.uid() AND invitee_id = profiles.id)
        OR (invitee_id = auth.uid() AND inviter_id = profiles.id)
      )
    )
  );
