import * as d3 from "d3";

export interface Contact {
  id: string;
  full_name: string;
  relationship_type: string;
  company: string | null;
  role: string | null;
  owner_id: string;
  linked_profile_id: string | null;
  last_contact_date: string | null;
  anonymous_to_connections: boolean | null;
  location: string | null;
  email: string | null;
  how_we_met: string | null;
  ai_summary: string | null;
  mini_summary: string | null;
  next_action_note: string | null;
  resume_data: {
    work?: { title: string; company: string; description?: string | null; location?: string | null }[];
    education?: { institution: string; degree?: string | null; field_of_study?: string | null }[];
    raw_text?: string;
  } | null;
}

export interface Connection {
  id: string;
  inviter_id: string;
  invitee_id: string;
  status: string;
}

export interface NoteStats {
  contact_id: string;
  count: number;
  most_recent: string;
}

export interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  fullName: string;
  type: "self" | "contact" | "connected_user" | "their_contact" | "world" | "third_degree";
  radius: number;
  connectionCount: number;
  relationship_type?: string;
  company?: string;
  role?: string;
  owner_id?: string;
  user_id?: string;
  profileId?: string;
  contactId?: string;
  isAnonymous?: boolean;
  recency?: number;
  searchText?: string;
  anchorNodeId?: string;
  next_action_note?: string;
  pending_action?: string;
  pending_action_due?: string;
  pending_action_importance?: string;
  isLinkedProfile?: boolean;
}

export interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  distance: number;
  thickness: number;
  recency: number;
  isMutual: boolean;
  isLinkedUser: boolean;
  isSecondDegree?: boolean;
  isCrossLink?: boolean;
}
