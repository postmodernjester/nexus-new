-- 1. RLS policy: connected users can READ each other's contacts (for 2nd degree network view)
CREATE POLICY "Connected users can view contacts"
  ON public.contacts FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.connections
      WHERE status = 'accepted'
      AND (
        (inviter_id = auth.uid() AND invitee_id = contacts.owner_id)
        OR (invitee_id = auth.uid() AND inviter_id = contacts.owner_id)
      )
    )
  );

-- 2. SECURITY DEFINER function for bidirectional connect
--    Runs as the DB owner, bypassing RLS, so it can create contact cards for both users.
CREATE OR REPLACE FUNCTION public.connect_users(
  p_current_user_id uuid,
  p_target_user_id  uuid,
  p_existing_contact_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_profile  record;
  v_target_profile   record;
  v_current_contact_id uuid;
  v_target_contact_id  uuid;
  v_invite_code text;
  v_existing record;
BEGIN
  -- Verify the caller is the current user (prevent impersonation)
  IF auth.uid() IS DISTINCT FROM p_current_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Self-check
  IF p_current_user_id = p_target_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'You cannot connect with yourself');
  END IF;

  -- Already connected?
  SELECT id INTO v_existing FROM connections
    WHERE status = 'accepted'
      AND ((inviter_id = p_current_user_id AND invitee_id = p_target_user_id)
        OR (inviter_id = p_target_user_id AND invitee_id = p_current_user_id))
    LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already connected');
  END IF;

  -- Fetch profiles
  SELECT id, full_name, email, avatar_url, location, bio, headline, website
    INTO v_current_profile FROM profiles WHERE id = p_current_user_id;
  SELECT id, full_name, email, avatar_url, location, bio, headline, website
    INTO v_target_profile FROM profiles WHERE id = p_target_user_id;

  IF v_current_profile IS NULL OR v_target_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Could not find user profiles');
  END IF;

  -- Ensure current user has a contact card for target
  SELECT id INTO v_current_contact_id FROM contacts
    WHERE owner_id = p_current_user_id AND linked_profile_id = p_target_user_id
    LIMIT 1;

  IF v_current_contact_id IS NULL THEN
    -- Try email match
    SELECT id INTO v_current_contact_id FROM contacts
      WHERE owner_id = p_current_user_id
        AND linked_profile_id IS NULL
        AND lower(email) = lower(v_target_profile.email)
      LIMIT 1;

    IF v_current_contact_id IS NOT NULL THEN
      UPDATE contacts SET linked_profile_id = p_target_user_id WHERE id = v_current_contact_id;
    ELSE
      INSERT INTO contacts (owner_id, linked_profile_id, full_name, email)
        VALUES (p_current_user_id, p_target_user_id, v_target_profile.full_name, v_target_profile.email)
        RETURNING id INTO v_current_contact_id;
    END IF;
  END IF;

  -- Ensure target user has a contact card for current user
  SELECT id INTO v_target_contact_id FROM contacts
    WHERE owner_id = p_target_user_id AND linked_profile_id = p_current_user_id
    LIMIT 1;

  IF v_target_contact_id IS NULL THEN
    IF p_existing_contact_id IS NOT NULL THEN
      -- Link the specified card
      UPDATE contacts SET linked_profile_id = p_current_user_id
        WHERE id = p_existing_contact_id AND owner_id = p_target_user_id;
      v_target_contact_id := p_existing_contact_id;
    ELSE
      -- Try email match
      SELECT id INTO v_target_contact_id FROM contacts
        WHERE owner_id = p_target_user_id
          AND linked_profile_id IS NULL
          AND lower(email) = lower(v_current_profile.email)
        LIMIT 1;

      IF v_target_contact_id IS NOT NULL THEN
        UPDATE contacts SET linked_profile_id = p_current_user_id WHERE id = v_target_contact_id;
      ELSE
        INSERT INTO contacts (owner_id, linked_profile_id, full_name, email)
          VALUES (p_target_user_id, p_current_user_id, v_current_profile.full_name, v_current_profile.email)
          RETURNING id INTO v_target_contact_id;
      END IF;
    END IF;
  END IF;

  -- Generate invite code
  v_invite_code := 'DC-' || substr(md5(random()::text), 1, 6);

  -- Create the connection (inviter = current user who clicked the link)
  INSERT INTO connections (inviter_id, invitee_id, contact_id, invite_code, status, accepted_at)
    VALUES (p_current_user_id, p_target_user_id, v_current_contact_id, v_invite_code, 'accepted', now());

  RETURN jsonb_build_object('success', true);

EXCEPTION WHEN unique_violation THEN
  -- invite_code collision — retry once
  v_invite_code := 'DC-' || substr(md5(random()::text || clock_timestamp()::text), 1, 6);
  INSERT INTO connections (inviter_id, invitee_id, contact_id, invite_code, status, accepted_at)
    VALUES (p_current_user_id, p_target_user_id, v_current_contact_id, v_invite_code, 'accepted', now());
  RETURN jsonb_build_object('success', true);
END;
$$;
