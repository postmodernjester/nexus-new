-- Link invitations: proper invitation workflow for the World page.
-- Users can invite others to link; the recipient accepts or declines.

CREATE TABLE IF NOT EXISTS public.link_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  responded_at TIMESTAMPTZ,
  UNIQUE(from_user_id, to_user_id)
);

CREATE INDEX idx_link_inv_from ON public.link_invitations(from_user_id);
CREATE INDEX idx_link_inv_to ON public.link_invitations(to_user_id);
CREATE INDEX idx_link_inv_status ON public.link_invitations(status);

-- RLS
ALTER TABLE public.link_invitations ENABLE ROW LEVEL SECURITY;

-- Users can see invitations they sent or received
CREATE POLICY "Users can view own invitations"
  ON public.link_invitations FOR SELECT
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- Users can create invitations (as sender)
CREATE POLICY "Users can send invitations"
  ON public.link_invitations FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);

-- Recipients can update (accept/decline)
CREATE POLICY "Users can respond to invitations"
  ON public.link_invitations FOR UPDATE
  USING (auth.uid() = to_user_id OR auth.uid() = from_user_id);

-- ─── SECURITY DEFINER RPC to accept a link invitation ───
-- Creates contact cards on both sides and a connection record.
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

  -- Create contact card for sender → about recipient (if doesn't exist)
  SELECT id INTO v_from_contact_id FROM contacts
    WHERE owner_id = v_inv.from_user_id AND linked_profile_id = v_inv.to_user_id
    LIMIT 1;
  IF v_from_contact_id IS NULL THEN
    INSERT INTO contacts (owner_id, linked_profile_id, full_name, email)
      VALUES (v_inv.from_user_id, v_inv.to_user_id, v_to_profile.full_name, v_to_profile.email)
      RETURNING id INTO v_from_contact_id;
  END IF;

  -- Create contact card for recipient → about sender (if doesn't exist)
  SELECT id INTO v_to_contact_id FROM contacts
    WHERE owner_id = v_inv.to_user_id AND linked_profile_id = v_inv.from_user_id
    LIMIT 1;
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
