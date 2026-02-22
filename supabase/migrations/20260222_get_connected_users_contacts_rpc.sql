-- RPC to fetch contacts owned by users connected to the caller.
-- Uses SECURITY DEFINER so it bypasses RLS and doesn't depend on the
-- "Connected users can view contacts" policy being present.

CREATE OR REPLACE FUNCTION public.get_connected_users_contacts(p_user_id uuid)
RETURNS SETOF public.contacts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only the authenticated user can call this for themselves
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT c.*
  FROM contacts c
  WHERE c.owner_id IN (
    SELECT CASE
      WHEN conn.inviter_id = p_user_id THEN conn.invitee_id
      ELSE conn.inviter_id
    END
    FROM connections conn
    WHERE conn.status = 'accepted'
    AND (conn.inviter_id = p_user_id OR conn.invitee_id = p_user_id)
  )
  AND c.owner_id != p_user_id;
END;
$$;
