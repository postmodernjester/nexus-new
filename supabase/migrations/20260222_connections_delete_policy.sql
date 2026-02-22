-- Allow users to delete connection records they are part of (needed for unlink flow)
CREATE POLICY "Users can delete own connections"
  ON connections FOR DELETE
  USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);
