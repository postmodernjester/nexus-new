"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Contact, Connection, NoteStats, GraphNode, GraphLink } from "../types";
import { CLOSENESS, SPREAD, computeRecency, lineThickness, nodeSize } from "../utils";
import type { NodeProfile } from "../similarity";

// ─── Raw row types for structured data ───────────────────────
interface WorkRow {
  user_id: string;
  title: string;
  company: string;
  description: string | null;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean | null;
  ai_skills_extracted: string[] | null;
}
interface EduRow {
  user_id: string;
  institution: string;
  degree: string | null;
  field_of_study: string | null;
  start_date: string | null;
  end_date: string | null;
}
interface SkillRow { user_id: string; name: string }
interface ProfileEnrich {
  id: string;
  ai_interests: string[] | null;
  ai_strengths: string[] | null;
  location: string | null;
}

export interface WorldProfile {
  id: string;
  full_name: string;
  headline: string | null;
  location: string | null;
  ai_interests: string[] | null;
  ai_strengths: string[] | null;
}

// ─── Build NodeProfile from available data ───────────────────
function buildProfile(
  nodeId: string,
  node: GraphNode,
  contactCompany: string | undefined,
  contactLocation: string | undefined,
  workRows: WorkRow[],
  eduRows: EduRow[],
  skills: string[],
  enrich: ProfileEnrich | undefined,
): NodeProfile {
  const companies: NodeProfile["companies"] = [];
  const allSkills: string[] = [...skills];

  for (const w of workRows) {
    if (w.company) {
      companies.push({
        name: w.company,
        start: w.start_date || undefined,
        end: w.is_current ? null : (w.end_date || undefined),
      });
    }
    if (w.ai_skills_extracted) allSkills.push(...w.ai_skills_extracted);
  }

  // Add contact-card company if not already represented
  const cc = contactCompany || node.company;
  if (cc) {
    const lower = cc.toLowerCase().trim();
    if (!companies.some(c => c.name.toLowerCase().trim() === lower)) {
      companies.push({ name: cc });
    }
  }

  return {
    companies,
    skills: allSkills,
    education: eduRows.map(e => ({
      institution: e.institution,
      field: e.field_of_study || undefined,
    })),
    location: enrich?.location || contactLocation || undefined,
    interests: enrich?.ai_interests || [],
    tags: [],
  };
}

// ─── Hook ────────────────────────────────────────────────────
export function useNetworkData() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [graphData, setGraphData] = useState<{
    nodes: GraphNode[];
    links: GraphLink[];
  }>({ nodes: [], links: [] });
  const [nodeProfiles, setNodeProfiles] = useState<Record<string, NodeProfile>>({});
  const [networkProfileIds, setNetworkProfileIds] = useState<Set<string>>(new Set());
  const [profileNodeMap, setProfileNodeMap] = useState<Record<string, string>>({});

  useEffect(() => {
    async function fetchAll() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const [myContactsRes, connectionsRes, notesRes, profileRes] =
        await Promise.all([
          supabase.from("contacts").select("*").eq("owner_id", user.id),
          supabase
            .from("connections")
            .select("*")
            .eq("status", "accepted")
            .or(`inviter_id.eq.${user.id},invitee_id.eq.${user.id}`),
          supabase.from("contact_notes").select("contact_id, entry_date, content, action_text, action_due_date, action_completed, importance, context"),
          supabase
            .from("profiles")
            .select("full_name, headline")
            .eq("id", user.id)
            .single(),
        ]);

      const myContacts: Contact[] = myContactsRes.data || [];
      const connections: Connection[] = connectionsRes.data || [];
      const allNotes = notesRes.data || [];

      // Build pending action map from contact_notes: first pending action per contact
      const pendingActionMap: Record<string, { action_text: string; action_due_date?: string; importance?: string }> = {};
      for (const n of allNotes) {
        if (n.action_text && !n.action_completed && !pendingActionMap[n.contact_id]) {
          pendingActionMap[n.contact_id] = {
            action_text: n.action_text,
            action_due_date: n.action_due_date || undefined,
            importance: n.importance || undefined,
          };
        }
      }

      const noteMap: Record<string, NoteStats> = {};
      const noteTextMap: Record<string, string> = {};
      for (const n of allNotes) {
        if (!noteMap[n.contact_id]) {
          noteMap[n.contact_id] = {
            contact_id: n.contact_id,
            count: 0,
            most_recent: n.entry_date,
          };
        }
        noteMap[n.contact_id].count++;
        if (n.entry_date > noteMap[n.contact_id].most_recent) {
          noteMap[n.contact_id].most_recent = n.entry_date;
        }
        const noteParts = [n.content, n.action_text, n.context].filter(Boolean);
        if (noteParts.length) {
          noteTextMap[n.contact_id] = (noteTextMap[n.contact_id] || "") + " " + noteParts.join(" ");
        }
      }

      const rawMutualUserIds = new Set<string>();
      for (const conn of connections) {
        if (conn.inviter_id === user.id) rawMutualUserIds.add(conn.invitee_id);
        else if (conn.invitee_id === user.id)
          rawMutualUserIds.add(conn.inviter_id);
      }

      const linkedToUserIds = new Set(
        myContacts
          .filter(c => c.linked_profile_id)
          .map(c => c.linked_profile_id!)
      );
      const mutualUserIds = new Set<string>();
      for (const uid of rawMutualUserIds) {
        if (linkedToUserIds.has(uid)) {
          mutualUserIds.add(uid);
        }
      }

      const connectedProfiles: Record<
        string,
        { full_name: string; headline: string; anonymous_beyond_first_degree: boolean }
      > = {};
      if (mutualUserIds.size > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, headline, anonymous_beyond_first_degree")
          .in("id", Array.from(mutualUserIds));
        if (profilesError) console.warn("Network: profile fetch error", profilesError);
        for (const p of profiles || []) {
          connectedProfiles[p.id] = {
            full_name: p.full_name || "Unknown",
            headline: p.headline || "",
            anonymous_beyond_first_degree: p.anonymous_beyond_first_degree || false,
          };
        }
        for (const uid of Array.from(mutualUserIds)) {
          if (!connectedProfiles[uid]) {
            const { data: p } = await supabase
              .from("profiles")
              .select("id, full_name, headline, anonymous_beyond_first_degree")
              .eq("id", uid)
              .single();
            if (p) {
              connectedProfiles[p.id] = {
                full_name: p.full_name || "Unknown",
                headline: p.headline || "",
                anonymous_beyond_first_degree: p.anonymous_beyond_first_degree || false,
              };
            }
          }
        }
      }

      const linkedProfileIds = myContacts
        .filter((c) => c.linked_profile_id && !mutualUserIds.has(c.linked_profile_id))
        .map((c) => c.linked_profile_id!)
        .filter((id, i, arr) => arr.indexOf(id) === i);

      const anonymousProfiles = new Set<string>();
      if (linkedProfileIds.length > 0) {
        const { data: lps } = await supabase
          .from("profiles")
          .select("id, anonymous_beyond_first_degree")
          .in("id", linkedProfileIds)
          .eq("anonymous_beyond_first_degree", true);
        for (const p of lps || []) {
          anonymousProfiles.add(p.id);
        }
      }

      // ── Enriched data for search + similarity ──────────────
      // Include self in profile list for similarity scoring
      const allSearchableProfileIds = [
        user.id,
        ...myContacts.filter(c => c.linked_profile_id).map(c => c.linked_profile_id!),
        ...Array.from(mutualUserIds),
      ].filter((id, i, arr) => arr.indexOf(id) === i);

      const workTextMap: Record<string, string> = {};
      const eduTextMap: Record<string, string> = {};
      const workEntriesMap: Record<string, WorkRow[]> = {};
      const eduEntriesMap: Record<string, EduRow[]> = {};
      const skillsMap: Record<string, string[]> = {};
      const profileEnrichMap: Record<string, ProfileEnrich> = {};

      if (allSearchableProfileIds.length > 0) {
        const [workRes, eduRes, skillsRes, enrichRes] = await Promise.all([
          supabase.from("work_entries")
            .select("user_id, title, company, description, location, start_date, end_date, is_current, ai_skills_extracted")
            .in("user_id", allSearchableProfileIds),
          supabase.from("education")
            .select("user_id, institution, degree, field_of_study, start_date, end_date")
            .in("user_id", allSearchableProfileIds),
          supabase.from("skills")
            .select("user_id, name")
            .in("user_id", allSearchableProfileIds),
          supabase.from("profiles")
            .select("id, ai_interests, ai_strengths, location")
            .in("id", allSearchableProfileIds),
        ]);

        for (const w of (workRes.data || []) as WorkRow[]) {
          workTextMap[w.user_id] = (workTextMap[w.user_id] || "") + ` ${w.title || ""} ${w.company || ""} ${w.description || ""} ${w.location || ""} ${(w.ai_skills_extracted || []).join(" ")}`;
          if (!workEntriesMap[w.user_id]) workEntriesMap[w.user_id] = [];
          workEntriesMap[w.user_id].push(w);
        }
        for (const e of (eduRes.data || []) as EduRow[]) {
          eduTextMap[e.user_id] = (eduTextMap[e.user_id] || "") + ` ${e.institution || ""} ${e.degree || ""} ${e.field_of_study || ""}`;
          if (!eduEntriesMap[e.user_id]) eduEntriesMap[e.user_id] = [];
          eduEntriesMap[e.user_id].push(e);
        }
        for (const s of (skillsRes.data || []) as SkillRow[]) {
          if (!skillsMap[s.user_id]) skillsMap[s.user_id] = [];
          skillsMap[s.user_id].push(s.name);
        }
        for (const p of (enrichRes.data || []) as ProfileEnrich[]) {
          profileEnrichMap[p.id] = p;
        }
      }

      // Fetch connected users' contacts via SECURITY DEFINER RPC
      let theirContacts: Contact[] = [];
      if (mutualUserIds.size > 0) {
        const { data: rpcContacts, error: rpcError } = await supabase.rpc(
          "get_connected_users_contacts",
          { p_user_id: user.id }
        );
        if (rpcError) {
          console.warn("get_connected_users_contacts RPC failed:", rpcError.message,
            "— 2nd degree contacts will not appear. Ensure the SQL function exists.");
        }
        theirContacts = (rpcContacts || []).filter(
          (c: Contact) => mutualUserIds.has(c.owner_id)
        );
      }

      // === DEDUP ===
      const myContactsLinkedToConnectedUser = new Map<string, Contact>();
      for (const c of myContacts) {
        if (c.linked_profile_id && mutualUserIds.has(c.linked_profile_id)) {
          myContactsLinkedToConnectedUser.set(c.linked_profile_id, c);
        }
      }

      const profileToNodeId: Record<string, string> = {};
      const nameToNodeId: Record<string, string> = {};
      const nodes: GraphNode[] = [];
      const links: GraphLink[] = [];
      // Track contact metadata for profile building (location, company)
      const nodeContactMeta: Record<string, { company?: string; location?: string }> = {};

      // 1) Self
      const myName = profileRes.data?.full_name || "You";
      const myLastName = myName.split(" ").slice(-1)[0] || myName;
      const selfConnCount = myContacts.length + mutualUserIds.size;
      nodes.push({
        id: "self",
        label: myLastName,
        fullName: myName,
        type: "self",
        radius: nodeSize(selfConnCount),
        connectionCount: selfConnCount,
        user_id: user.id,
        profileId: user.id,
        recency: 1.0,
        searchText: myName.toLowerCase(),
      });
      profileToNodeId[user.id] = "self";
      nameToNodeId[myName.toLowerCase()] = "self";

      // 2) Connected users
      for (const uid of Array.from(mutualUserIds)) {
        const profile = connectedProfiles[uid];
        const myCard = myContactsLinkedToConnectedUser.get(uid);
        const name = profile?.full_name || myCard?.full_name || "Connected User";
        const nameParts = name.split(" ");
        const lastName = nameParts.length > 1 ? nameParts.slice(-1)[0] : name;
        const theirCount = theirContacts.filter(
          (c) => c.owner_id === uid
        ).length;
        const nodeId = `user-${uid}`;

        const stats = myCard ? noteMap[myCard.id] : null;
        const relType = myCard?.relationship_type || "Acquaintance";

        const rec = computeRecency(
          stats?.most_recent || myCard?.last_contact_date || null
        );

        const cuSearchParts = [name, relType, myCard?.company, profile?.headline, myCard?.role, myCard?.location, myCard?.email, myCard?.how_we_met, myCard?.ai_summary, myCard?.mini_summary, myCard?.next_action_note];
        const cuNoteText = myCard ? noteTextMap[myCard.id] || "" : "";
        const cuWorkText = workTextMap[uid] || "";
        const cuEduText = eduTextMap[uid] || "";
        const cuSkills = (skillsMap[uid] || []).join(" ");
        const cuEnrich = profileEnrichMap[uid];
        const cuStrengths = (cuEnrich?.ai_strengths || []).join(" ");
        const cuInterests = (cuEnrich?.ai_interests || []).join(" ");
        // resume_data for non-linked contacts (fallback work/edu)
        const cuResumeText = myCard?.resume_data
          ? [
              ...(myCard.resume_data.work || []).map(w => [w.title, w.company, w.description, w.location].filter(Boolean).join(" ")),
              ...(myCard.resume_data.education || []).map(e => [e.institution, e.degree, e.field_of_study].filter(Boolean).join(" ")),
              myCard.resume_data.raw_text || "",
            ].join(" ")
          : "";

        nodes.push({
          id: nodeId,
          label: lastName,
          fullName: name,
          type: "connected_user",
          radius: nodeSize(theirCount + 1),
          connectionCount: theirCount + 1,
          user_id: uid,
          profileId: uid,
          contactId: myCard?.id,
          relationship_type: relType,
          company: myCard?.company ?? undefined,
          role: profile?.headline || (myCard?.role ?? undefined),
          recency: rec,
          searchText: [...cuSearchParts.filter(Boolean), cuNoteText, cuWorkText, cuEduText, cuSkills, cuStrengths, cuInterests, cuResumeText].join(" ").toLowerCase(),
          next_action_note: myCard?.next_action_note ?? undefined,
          pending_action: myCard ? pendingActionMap[myCard.id]?.action_text : undefined,
          pending_action_due: myCard ? pendingActionMap[myCard.id]?.action_due_date : undefined,
          pending_action_importance: myCard ? pendingActionMap[myCard.id]?.importance : undefined,
        });

        profileToNodeId[uid] = nodeId;
        nameToNodeId[name.toLowerCase()] = nodeId;
        nodeContactMeta[nodeId] = { company: myCard?.company || undefined, location: myCard?.location || undefined };

        const baseDist = CLOSENESS[relType] || 200;
        const [spreadMin, spreadRange] = SPREAD[relType] || [0.85, 0.30];
        const dist = baseDist * (spreadMin + Math.random() * spreadRange);
        const thick = lineThickness(stats?.count || 0);

        links.push({
          source: "self",
          target: nodeId,
          distance: dist,
          thickness: thick,
          recency: rec,
          isMutual: true,
          isLinkedUser: true,
        });
      }

      // 3) My contacts (not linked to connected user)
      for (const c of myContacts) {
        if (
          c.linked_profile_id &&
          mutualUserIds.has(c.linked_profile_id)
        ) {
          continue;
        }

        const nodeId = `contact-${c.id}`;
        const stats = noteMap[c.id];
        const relType = c.relationship_type || "Acquaintance";
        const cParts = c.full_name.split(" ");
        const cLastName = cParts.length > 1 ? cParts.slice(-1)[0] : c.full_name;
        const rec = computeRecency(
          stats?.most_recent || c.last_contact_date || null
        );

        const cSearchParts = [c.full_name, relType, c.company, c.role, c.location, c.email, c.how_we_met, c.ai_summary, c.mini_summary, c.next_action_note];
        const cNoteText = noteTextMap[c.id] || "";
        const cWorkText = c.linked_profile_id ? workTextMap[c.linked_profile_id] || "" : "";
        const cEduText = c.linked_profile_id ? eduTextMap[c.linked_profile_id] || "" : "";
        const cSkills = c.linked_profile_id ? (skillsMap[c.linked_profile_id] || []).join(" ") : "";
        const cEnrich = c.linked_profile_id ? profileEnrichMap[c.linked_profile_id] : undefined;
        const cStrengths = (cEnrich?.ai_strengths || []).join(" ");
        const cInterests = (cEnrich?.ai_interests || []).join(" ");
        // resume_data fallback: for non-linked contacts this is their resume info
        const cResumeText = c.resume_data
          ? [
              ...(c.resume_data.work || []).map(w => [w.title, w.company, w.description, w.location].filter(Boolean).join(" ")),
              ...(c.resume_data.education || []).map(e => [e.institution, e.degree, e.field_of_study].filter(Boolean).join(" ")),
              c.resume_data.raw_text || "",
            ].join(" ")
          : "";

        nodes.push({
          id: nodeId,
          label: cLastName,
          fullName: c.full_name,
          type: "contact",
          radius: nodeSize(1),
          connectionCount: 1,
          relationship_type: relType,
          company: c.company ?? undefined,
          role: c.role ?? undefined,
          owner_id: c.owner_id,
          contactId: c.id,
          recency: rec,
          searchText: [...cSearchParts.filter(Boolean), cNoteText, cWorkText, cEduText, cSkills, cStrengths, cInterests, cResumeText].join(" ").toLowerCase(),
          next_action_note: c.next_action_note ?? undefined,
          pending_action: pendingActionMap[c.id]?.action_text,
          pending_action_due: pendingActionMap[c.id]?.action_due_date,
          pending_action_importance: pendingActionMap[c.id]?.importance,
        });

        nameToNodeId[c.full_name.toLowerCase()] = nodeId;
        if (c.linked_profile_id) {
          profileToNodeId[c.linked_profile_id] = nodeId;
        }
        nodeContactMeta[nodeId] = { company: c.company || undefined, location: c.location || undefined };

        const baseDist = CLOSENESS[relType] || 200;
        const [spreadMin, spreadRange] = SPREAD[relType] || [0.85, 0.30];
        const dist = baseDist * (spreadMin + Math.random() * spreadRange);
        const thick = lineThickness(stats?.count || 0);

        links.push({
          source: "self",
          target: nodeId,
          distance: dist,
          thickness: thick,
          recency: rec,
          isMutual: false,
          isLinkedUser: !!c.linked_profile_id,
        });
      }

      // 4) Their contacts (second-degree)
      const addedSecondDegreeIds = new Set<string>();
      for (const tc of theirContacts) {
        if (tc.linked_profile_id === user.id) continue;

        const ownerProfile = connectedProfiles[tc.owner_id];
        if (ownerProfile?.anonymous_beyond_first_degree) continue;

        if (tc.linked_profile_id && anonymousProfiles.has(tc.linked_profile_id)) continue;
        if (tc.anonymous_to_connections) continue;

        let existingNodeId: string | undefined;
        if (tc.linked_profile_id) {
          existingNodeId = profileToNodeId[tc.linked_profile_id];
        }
        if (!existingNodeId) {
          existingNodeId = nameToNodeId[tc.full_name.toLowerCase()];
        }

        const ownerNodeId = profileToNodeId[tc.owner_id];
        if (!ownerNodeId) continue;

        if (existingNodeId) {
          const alreadyLinked = links.some(
            (l) =>
              (((l.source as GraphNode).id || l.source) === ownerNodeId &&
                ((l.target as GraphNode).id || l.target) === existingNodeId) ||
              (((l.source as GraphNode).id || l.source) === existingNodeId &&
                ((l.target as GraphNode).id || l.target) === ownerNodeId)
          );
          if (!alreadyLinked) {
            const existingNode = nodes.find((n) => n.id === existingNodeId);
            const isCrossLink = existingNode?.type === "contact";
            links.push({
              source: ownerNodeId,
              target: existingNodeId,
              distance: 80,
              thickness: isCrossLink ? 1.5 : 1,
              recency: 0.3,
              isMutual: true,
              isLinkedUser: false,
              isSecondDegree: true,
              isCrossLink,
            });
          }
          const existingNode = nodes.find((n) => n.id === existingNodeId);
          if (existingNode) {
            existingNode.connectionCount++;
            existingNode.radius = nodeSize(existingNode.connectionCount);
          }
          continue;
        }

        const dedupKey = tc.linked_profile_id || `name:${tc.full_name.toLowerCase()}`;
        if (addedSecondDegreeIds.has(dedupKey)) continue;
        addedSecondDegreeIds.add(dedupKey);

        const nodeId = `their-${tc.id}`;
        const isLinked = !!tc.linked_profile_id;
        const jobLabel = tc.role || "";

        const tcSearchParts = [tc.full_name, tc.relationship_type, tc.company, tc.role, tc.location];
        nodes.push({
          id: nodeId,
          label: isLinked ? jobLabel : "",
          fullName: tc.full_name,
          type: "their_contact",
          radius: 6,
          connectionCount: 1,
          relationship_type: tc.relationship_type || undefined,
          company: tc.company ?? undefined,
          role: tc.role ?? undefined,
          owner_id: tc.owner_id,
          isAnonymous: false,
          recency: 0.5,
          searchText: tcSearchParts.filter(Boolean).join(" ").toLowerCase(),
          isLinkedProfile: isLinked,
        });

        if (tc.linked_profile_id) profileToNodeId[tc.linked_profile_id] = nodeId;
        nameToNodeId[tc.full_name.toLowerCase()] = nodeId;
        nodeContactMeta[nodeId] = { company: tc.company || undefined, location: tc.location || undefined };

        links.push({
          source: ownerNodeId,
          target: nodeId,
          distance: 25 * (0.85 + Math.random() * 0.3),
          thickness: 1,
          recency: 0.3,
          isMutual: false,
          isLinkedUser: isLinked,
          isSecondDegree: true,
        });
      }

      // ── Build NodeProfile for each node (for similarity clustering) ──
      const profiles: Record<string, NodeProfile> = {};
      for (const node of nodes) {
        const pid = node.profileId || node.user_id;
        const meta = nodeContactMeta[node.id];
        profiles[node.id] = buildProfile(
          node.id,
          node,
          meta?.company,
          meta?.location,
          pid ? workEntriesMap[pid] || [] : [],
          pid ? eduEntriesMap[pid] || [] : [],
          pid ? skillsMap[pid] || [] : [],
          pid ? profileEnrichMap[pid] : undefined,
        );
      }

      // Track which profile IDs are already in the network (for world list exclusion)
      const inNetwork = new Set<string>();
      inNetwork.add(user.id);
      for (const uid of mutualUserIds) inNetwork.add(uid);
      for (const c of myContacts) {
        if (c.linked_profile_id) inNetwork.add(c.linked_profile_id);
      }

      setGraphData({ nodes, links });
      setNodeProfiles(profiles);
      setNetworkProfileIds(inNetwork);
      setProfileNodeMap(profileToNodeId);
      setLoading(false);
    }

    fetchAll();
  }, [router]);

  // ── World list fetcher (called on toggle) ──────────────────
  const fetchWorldData = useCallback(async (): Promise<{
    nodes: GraphNode[];
    profiles: Record<string, NodeProfile>;
  }> => {
    const { data: worldProfiles } = await supabase
      .from("profiles")
      .select("id, full_name, headline, location, ai_interests, ai_strengths")
      .eq("is_public", true);

    if (!worldProfiles || worldProfiles.length === 0) {
      return { nodes: [], profiles: {} };
    }

    // Exclude profiles already in the network
    const filtered = worldProfiles.filter(
      (p: WorldProfile) => !networkProfileIds.has(p.id)
    );

    // Fetch work_entries + education for world profiles (for richer similarity)
    const worldIds = filtered.map((p: WorldProfile) => p.id);
    let worldWork: WorkRow[] = [];
    let worldEdu: EduRow[] = [];
    let worldSkills: SkillRow[] = [];

    if (worldIds.length > 0) {
      const [wRes, eRes, sRes] = await Promise.all([
        supabase.from("work_entries")
          .select("user_id, title, company, description, location, start_date, end_date, is_current, ai_skills_extracted")
          .in("user_id", worldIds),
        supabase.from("education")
          .select("user_id, institution, degree, field_of_study, start_date, end_date")
          .in("user_id", worldIds),
        supabase.from("skills")
          .select("user_id, name")
          .in("user_id", worldIds),
      ]);
      worldWork = (wRes.data || []) as WorkRow[];
      worldEdu = (eRes.data || []) as EduRow[];
      worldSkills = (sRes.data || []) as SkillRow[];
    }

    // Build structured maps
    const wMap: Record<string, WorkRow[]> = {};
    const eMap: Record<string, EduRow[]> = {};
    const sMap: Record<string, string[]> = {};
    for (const w of worldWork) {
      if (!wMap[w.user_id]) wMap[w.user_id] = [];
      wMap[w.user_id].push(w);
    }
    for (const e of worldEdu) {
      if (!eMap[e.user_id]) eMap[e.user_id] = [];
      eMap[e.user_id].push(e);
    }
    for (const s of worldSkills) {
      if (!sMap[s.user_id]) sMap[s.user_id] = [];
      sMap[s.user_id].push(s.name);
    }

    const worldNodes: GraphNode[] = [];
    const worldProfs: Record<string, NodeProfile> = {};

    for (const p of filtered as WorldProfile[]) {
      const nameParts = p.full_name.split(" ");
      const lastName = nameParts.length > 1 ? nameParts.slice(-1)[0] : p.full_name;
      const nodeId = `world-${p.id}`;

      worldNodes.push({
        id: nodeId,
        label: lastName,
        fullName: p.full_name,
        type: "world",
        radius: 5,
        connectionCount: 0,
        profileId: p.id,
        role: p.headline || undefined,
        recency: 0.35,
        searchText: [
          p.full_name, p.headline, p.location,
          ...(sMap[p.id] || []),
          ...(p.ai_strengths || []),
          ...(p.ai_interests || []),
          ...(wMap[p.id] || []).map(w => [w.title, w.company, w.description, w.location, ...(w.ai_skills_extracted || [])].filter(Boolean).join(" ")),
          ...(eMap[p.id] || []).map(e => [e.institution, e.degree, e.field_of_study].filter(Boolean).join(" ")),
        ].filter(Boolean).join(" ").toLowerCase(),
      });

      const enrich: ProfileEnrich = {
        id: p.id,
        ai_interests: p.ai_interests,
        ai_strengths: p.ai_strengths,
        location: p.location,
      };

      worldProfs[nodeId] = buildProfile(
        nodeId,
        worldNodes[worldNodes.length - 1],
        undefined,
        p.location || undefined,
        wMap[p.id] || [],
        eMap[p.id] || [],
        sMap[p.id] || [],
        enrich,
      );
    }

    return { nodes: worldNodes, profiles: worldProfs };
  }, [networkProfileIds]);

  // ── 3rd-degree fetcher (called on toggle) ──────────────────
  const fetchThirdDegreeData = useCallback(async (): Promise<{
    nodes: GraphNode[];
  }> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { nodes: [] };

    const { data: thirdDegreeContacts, error } = await supabase.rpc(
      "get_third_degree_contacts",
      { p_user_id: user.id }
    );

    if (error) {
      console.warn("get_third_degree_contacts RPC failed:", error.message,
        "— 3rd degree contacts will not appear. Ensure the SQL function exists.");
      return { nodes: [] };
    }

    // Build set of existing identifiers for dedup
    const existingNames = new Set(graphData.nodes.map(n => n.fullName.toLowerCase()));
    const existingProfileIds = new Set<string>();
    for (const n of graphData.nodes) {
      if (n.profileId) existingProfileIds.add(n.profileId);
      if (n.user_id) existingProfileIds.add(n.user_id);
    }

    const nodes: GraphNode[] = [];
    const seen = new Set<string>();

    for (const c of (thirdDegreeContacts || []) as Contact[]) {
      // Skip if already in graph
      if (c.linked_profile_id && existingProfileIds.has(c.linked_profile_id)) continue;
      if (existingNames.has(c.full_name.toLowerCase())) continue;

      const dedupKey = c.linked_profile_id || `name:${c.full_name.toLowerCase()}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);

      // Find anchor: the 2nd-degree node whose linked profile owns this contact
      const anchorNodeId = profileNodeMap[c.owner_id];
      if (!anchorNodeId) continue; // can't place without an anchor

      const nameParts = c.full_name.split(" ");
      const lastName = nameParts.length > 1 ? nameParts.slice(-1)[0] : c.full_name;

      nodes.push({
        id: `third-${c.id}`,
        label: lastName,
        fullName: c.full_name,
        type: "third_degree",
        radius: 4,
        connectionCount: 0,
        company: c.company ?? undefined,
        role: c.role ?? undefined,
        owner_id: c.owner_id,
        anchorNodeId,
        recency: 0.18,
        searchText: [c.full_name, c.company, c.role].filter(Boolean).join(" ").toLowerCase(),
      });
    }

    return { nodes };
  }, [graphData.nodes, profileNodeMap]);

  return { graphData, nodeProfiles, loading, fetchWorldData, fetchThirdDegreeData };
}
