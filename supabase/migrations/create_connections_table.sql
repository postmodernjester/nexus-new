-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- Connections table: links two NEXUS users
CREATE TABLE IF NOT EXISTS connections (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  inviter_id uuid REFERENCES auth.users(id) NOT NULL,
  invitee_id uuid REFERENCES auth.users(id),
  contact_id uuid REFERENCES contacts(id),  -- links to inviter's contact record for this person
  invite_code varchar(8) UNIQUE NOT NULL,
  status varchar(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz DEFAULT now(),
  accepted_at timestamptz
);

-- Index for fast code lookups
CREATE INDEX idx_connections_invite_code ON connections(invite_code);
CREATE INDEX idx_connections_inviter ON connections(inviter_id);
CREATE INDEX idx_connections_invitee ON connections(invitee_id);

-- RLS
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;

-- Users can see connections they're part of
CREATE POLICY "Users can view own connections"
  ON connections FOR SELECT
  USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

-- Users can create invites
CREATE POLICY "Users can create invites"
  ON connections FOR INSERT
  WITH CHECK (auth.uid() = inviter_id);

-- Users can update connections they're invited to (accept/decline)
CREATE POLICY "Invitees can accept connections"
  ON connections FOR UPDATE
  USING (auth.uid() = invitee_id OR auth.uid() = inviter_id);

-- Anyone can look up an invite code (needed for the accept flow before they're the invitee)
CREATE POLICY "Anyone can lookup invite codes"
  ON connections FOR SELECT
  USING (status = 'pending');
