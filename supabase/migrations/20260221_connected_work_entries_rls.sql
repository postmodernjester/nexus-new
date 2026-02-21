-- Allow connected users to read each other's work_entries
-- Without this, only the owner and public-profile viewers can see work entries.
-- This lets your linked connections' resume entries show on your contact card for them.

CREATE POLICY "Connected users can view work entries" ON public.work_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.connections
      WHERE status = 'accepted'
      AND (
        (inviter_id = auth.uid() AND invitee_id = work_entries.user_id)
        OR (invitee_id = auth.uid() AND inviter_id = work_entries.user_id)
      )
    )
  );
