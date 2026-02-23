-- RPC to fetch 3rd-degree contacts: contacts owned by users who
-- appear as 2nd-degree linked profiles (NEXUS users among the
-- connected users' contacts).
--
-- Chain:  caller → connected users → their contacts (2nd deg)
--         → those contacts' linked_profile_id (a NEXUS user)
--         → THAT user's contacts (3rd deg)
--
-- Uses SECURITY DEFINER to bypass RLS and traverse the chain.

CREATE OR REPLACE FUNCTION public.get_third_degree_contacts(p_user_id uuid)
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
  WITH my_connected AS (
    SELECT CASE
      WHEN conn.inviter_id = p_user_id THEN conn.invitee_id
      ELSE conn.inviter_id
    END AS uid
    FROM connections conn
    WHERE conn.status = 'accepted'
      AND (conn.inviter_id = p_user_id OR conn.invitee_id = p_user_id)
  ),
  second_degree_users AS (
    -- 2nd-degree contacts that are NEXUS users (have linked profiles),
    -- excluding the caller and their direct connections.
    SELECT DISTINCT c2.linked_profile_id AS uid
    FROM contacts c2
    WHERE c2.owner_id IN (SELECT uid FROM my_connected)
      AND c2.linked_profile_id IS NOT NULL
      AND c2.linked_profile_id != p_user_id
      AND c2.linked_profile_id NOT IN (SELECT uid FROM my_connected)
      AND c2.anonymous_to_connections IS NOT TRUE
  ),
  visible_second_degree AS (
    -- Respect the "anonymous beyond first degree" privacy flag
    SELECT sdu.uid
    FROM second_degree_users sdu
    INNER JOIN profiles p ON p.id = sdu.uid
    WHERE p.anonymous_beyond_first_degree IS NOT TRUE
  )
  SELECT c3.*
  FROM contacts c3
  WHERE c3.owner_id IN (SELECT uid FROM visible_second_degree)
    AND c3.anonymous_to_connections IS NOT TRUE
    -- Don't return the caller as a 3rd-degree contact
    AND c3.linked_profile_id IS DISTINCT FROM p_user_id;
END;
$$;
