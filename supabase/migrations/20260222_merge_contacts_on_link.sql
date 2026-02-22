-- Upgrade accept_link_invitation to auto-merge on email match
-- and add a merge_duplicate_contact RPC for manual name-match merging.

-- ─── Updated accept_link_invitation ───
CREATE OR REPLACE FUNCTION public.accept_link_invitation(p_invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv record;
  v_from_profile record;
  v_to_profile record;
  v_from_contact_id uuid;
  v_to_contact_id uuid;
  v_invite_code text;
BEGIN
  -- Fetch the invitation
  SELECT * INTO v_inv FROM link_invitations WHERE id = p_invitation_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation not found');
  END IF;

  -- Only the recipient can accept
  IF auth.uid() IS DISTINCT FROM v_inv.to_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  IF v_inv.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation already responded to');
  END IF;

  -- Fetch profiles
  SELECT id, full_name, email, avatar_url, location, bio, headline, website
    INTO v_from_profile FROM profiles WHERE id = v_inv.from_user_id;
  SELECT id, full_name, email, avatar_url, location, bio, headline, website
    INTO v_to_profile FROM profiles WHERE id = v_inv.to_user_id;

  IF v_from_profile IS NULL OR v_to_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Could not find user profiles');
  END IF;

  -- === SENDER's contact card for recipient ===
  -- 1. Already linked?
  SELECT id INTO v_from_contact_id FROM contacts
    WHERE owner_id = v_inv.from_user_id AND linked_profile_id = v_inv.to_user_id
    LIMIT 1;
  -- 2. Email match (auto-merge)
  IF v_from_contact_id IS NULL AND v_to_profile.email IS NOT NULL THEN
    SELECT id INTO v_from_contact_id FROM contacts
      WHERE owner_id = v_inv.from_user_id
        AND linked_profile_id IS NULL
        AND lower(email) = lower(v_to_profile.email)
      LIMIT 1;
    IF v_from_contact_id IS NOT NULL THEN
      UPDATE contacts SET linked_profile_id = v_inv.to_user_id WHERE id = v_from_contact_id;
    END IF;
  END IF;
  -- 3. Create new if still not found
  IF v_from_contact_id IS NULL THEN
    INSERT INTO contacts (owner_id, linked_profile_id, full_name, email)
      VALUES (v_inv.from_user_id, v_inv.to_user_id, v_to_profile.full_name, v_to_profile.email)
      RETURNING id INTO v_from_contact_id;
  END IF;

  -- === RECIPIENT's contact card for sender ===
  -- 1. Already linked?
  SELECT id INTO v_to_contact_id FROM contacts
    WHERE owner_id = v_inv.to_user_id AND linked_profile_id = v_inv.from_user_id
    LIMIT 1;
  -- 2. Email match (auto-merge)
  IF v_to_contact_id IS NULL AND v_from_profile.email IS NOT NULL THEN
    SELECT id INTO v_to_contact_id FROM contacts
      WHERE owner_id = v_inv.to_user_id
        AND linked_profile_id IS NULL
        AND lower(email) = lower(v_from_profile.email)
      LIMIT 1;
    IF v_to_contact_id IS NOT NULL THEN
      UPDATE contacts SET linked_profile_id = v_inv.from_user_id WHERE id = v_to_contact_id;
    END IF;
  END IF;
  -- 3. Create new if still not found
  IF v_to_contact_id IS NULL THEN
    INSERT INTO contacts (owner_id, linked_profile_id, full_name, email)
      VALUES (v_inv.to_user_id, v_inv.from_user_id, v_from_profile.full_name, v_from_profile.email)
      RETURNING id INTO v_to_contact_id;
  END IF;

  -- Create connection record (if not already connected)
  IF NOT EXISTS (
    SELECT 1 FROM connections WHERE status = 'accepted'
    AND ((inviter_id = v_inv.from_user_id AND invitee_id = v_inv.to_user_id)
      OR (inviter_id = v_inv.to_user_id AND invitee_id = v_inv.from_user_id))
  ) THEN
    v_invite_code := 'LI-' || substr(md5(random()::text), 1, 6);
    INSERT INTO connections (inviter_id, invitee_id, contact_id, invite_code, status, accepted_at)
      VALUES (v_inv.from_user_id, v_inv.to_user_id, v_from_contact_id, v_invite_code, 'accepted', now());
  END IF;

  -- Mark invitation as accepted
  UPDATE link_invitations
    SET status = 'accepted', responded_at = now()
    WHERE id = p_invitation_id;

  RETURN jsonb_build_object('success', true);

EXCEPTION WHEN unique_violation THEN
  -- invite_code collision — retry with different code
  v_invite_code := 'LI-' || substr(md5(random()::text || clock_timestamp()::text), 1, 6);
  INSERT INTO connections (inviter_id, invitee_id, contact_id, invite_code, status, accepted_at)
    VALUES (v_inv.from_user_id, v_inv.to_user_id, v_from_contact_id, v_invite_code, 'accepted', now());
  UPDATE link_invitations
    SET status = 'accepted', responded_at = now()
    WHERE id = p_invitation_id;
  RETURN jsonb_build_object('success', true);
END;
$$;


-- ─── merge_duplicate_contact: keep one card, absorb the linked profile, delete the other ───
CREATE OR REPLACE FUNCTION public.merge_duplicate_contact(
  p_keep_id uuid,     -- the existing card (has notes, dossier, etc.)
  p_remove_id uuid    -- the newly-created linked card to absorb and delete
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_keep record;
  v_remove record;
BEGIN
  -- Verify caller owns both cards
  SELECT * INTO v_keep FROM contacts WHERE id = p_keep_id AND owner_id = auth.uid();
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contact to keep not found');
  END IF;

  SELECT * INTO v_remove FROM contacts WHERE id = p_remove_id AND owner_id = auth.uid();
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contact to remove not found');
  END IF;

  IF v_remove.linked_profile_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No linked profile to merge');
  END IF;

  -- Move linked_profile_id to the kept card
  UPDATE contacts SET linked_profile_id = v_remove.linked_profile_id WHERE id = p_keep_id;

  -- Point any connection records at the kept card
  UPDATE connections SET contact_id = p_keep_id WHERE contact_id = p_remove_id;

  -- Delete the duplicate
  DELETE FROM contacts WHERE id = p_remove_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
