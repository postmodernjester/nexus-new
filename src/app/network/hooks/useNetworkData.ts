"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Contact, Connection, NoteStats, GraphNode, GraphLink } from "../types";
import { CLOSENESS, computeRecency, lineThickness, nodeSize } from "../utils";

export function useNetworkData() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [graphData, setGraphData] = useState<{
    nodes: GraphNode[];
    links: GraphLink[];
  }>({ nodes: [], links: [] });

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
          supabase.from("contact_notes").select("contact_id, entry_date, content"),
          supabase
            .from("profiles")
            .select("full_name, headline")
            .eq("id", user.id)
            .single(),
        ]);

      const myContacts: Contact[] = myContactsRes.data || [];
      const connections: Connection[] = connectionsRes.data || [];
      const allNotes = notesRes.data || [];

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
        if (n.content) {
          noteTextMap[n.contact_id] = (noteTextMap[n.contact_id] || "") + " " + n.content;
        }
      }

      const rawMutualUserIds = new Set<string>();
      for (const conn of connections) {
        if (conn.inviter_id === user.id) rawMutualUserIds.add(conn.invitee_id);
        else if (conn.invitee_id === user.id)
          rawMutualUserIds.add(conn.inviter_id);
      }

      // Filter out stale connections: if a connection exists but my contact
      // for that user was unlinked (linked_profile_id cleared) or deleted,
      // the connection record is a ghost from a failed DELETE (missing RLS policy).
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
        // Fallback: fetch missing profiles individually (batch .in() can be
        // blocked by RLS even when individual .eq() works)
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

      // Fetch work entries & education for all linked profiles (for smart search)
      const allSearchableProfileIds = [
        ...myContacts.filter(c => c.linked_profile_id).map(c => c.linked_profile_id!),
        ...Array.from(mutualUserIds),
      ].filter((id, i, arr) => arr.indexOf(id) === i);

      const workTextMap: Record<string, string> = {};
      const eduTextMap: Record<string, string> = {};
      if (allSearchableProfileIds.length > 0) {
        const [workRes, eduRes] = await Promise.all([
          supabase.from("work_entries").select("user_id, title, company, description, location").in("user_id", allSearchableProfileIds),
          supabase.from("education").select("user_id, institution, degree, field_of_study").in("user_id", allSearchableProfileIds),
        ]);
        for (const w of workRes.data || []) {
          workTextMap[w.user_id] = (workTextMap[w.user_id] || "") + ` ${w.title || ""} ${w.company || ""} ${w.description || ""} ${w.location || ""}`;
        }
        for (const e of eduRes.data || []) {
          eduTextMap[e.user_id] = (eduTextMap[e.user_id] || "") + ` ${e.institution || ""} ${e.degree || ""} ${e.field_of_study || ""}`;
        }
      }

      // Fetch connected users' contacts via SECURITY DEFINER RPC
      // (bypasses RLS so we don't depend on the contacts SELECT policy)
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

      // 1) Self -- show last name, golden warm color
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

      // 2) Connected users (linked via connections table) -- "F. LastName" format
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

        // Build search text from all available data
        const cuSearchParts = [name, relType, myCard?.company, profile?.headline, myCard?.role, myCard?.location, myCard?.email, myCard?.how_we_met, myCard?.ai_summary, myCard?.next_action_note];
        const cuNoteText = myCard ? noteTextMap[myCard.id] || "" : "";
        const cuWorkText = workTextMap[uid] || "";
        const cuEduText = eduTextMap[uid] || "";

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
          searchText: [...cuSearchParts.filter(Boolean), cuNoteText, cuWorkText, cuEduText].join(" ").toLowerCase(),
        });

        profileToNodeId[uid] = nodeId;
        nameToNodeId[name.toLowerCase()] = nodeId;

        const baseDist = CLOSENESS[relType] || 200;
        const dist = baseDist * (0.85 + Math.random() * 0.3);
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

      // 3) My contacts (that are NOT linked to a connected user) -- "F. LastName" format
      for (const c of myContacts) {
        if (
          c.linked_profile_id &&
          mutualUserIds.has(c.linked_profile_id)
        ) {
          continue; // skip -- already shown as connected_user node
        }

        const nodeId = `contact-${c.id}`;
        const stats = noteMap[c.id];
        const relType = c.relationship_type || "Acquaintance";
        const cParts = c.full_name.split(" ");
        const cLastName = cParts.length > 1 ? cParts.slice(-1)[0] : c.full_name;
        const rec = computeRecency(
          stats?.most_recent || c.last_contact_date || null
        );

        // Build search text from all available data
        const cSearchParts = [c.full_name, relType, c.company, c.role, c.location, c.email, c.how_we_met, c.ai_summary, c.next_action_note];
        const cNoteText = noteTextMap[c.id] || "";
        const cWorkText = c.linked_profile_id ? workTextMap[c.linked_profile_id] || "" : "";
        const cEduText = c.linked_profile_id ? eduTextMap[c.linked_profile_id] || "" : "";

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
          searchText: [...cSearchParts.filter(Boolean), cNoteText, cWorkText, cEduText].join(" ").toLowerCase(),
        });

        nameToNodeId[c.full_name.toLowerCase()] = nodeId;
        if (c.linked_profile_id) {
          profileToNodeId[c.linked_profile_id] = nodeId;
        }

        const baseDist = CLOSENESS[relType] || 200;
        const dist = baseDist * (0.85 + Math.random() * 0.3);
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

      // 4) Their contacts (second-degree) -- contacts owned by connected users
      const addedSecondDegreeIds = new Set<string>();
      for (const tc of theirContacts) {
        // Skip if this contact is actually me
        if (tc.linked_profile_id === user.id) continue;

        // Check if this person's profile opted for anonymity beyond first degree
        const ownerProfile = connectedProfiles[tc.owner_id];
        if (ownerProfile?.anonymous_beyond_first_degree) continue;

        // Check if contact itself is anonymous
        if (tc.linked_profile_id && anonymousProfiles.has(tc.linked_profile_id)) continue;
        if (tc.anonymous_to_connections) continue;

        // Check if this person already exists as a node (dedup by linked_profile_id or name)
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
          // Already have this person -- just add a link from the owner to them if not already linked
          const alreadyLinked = links.some(
            (l) =>
              (((l.source as GraphNode).id || l.source) === ownerNodeId &&
                ((l.target as GraphNode).id || l.target) === existingNodeId) ||
              (((l.source as GraphNode).id || l.source) === existingNodeId &&
                ((l.target as GraphNode).id || l.target) === ownerNodeId)
          );
          if (!alreadyLinked) {
            // Detect cross-link: linked user -> my non-linked contact
            const existingNode = nodes.find((n) => n.id === existingNodeId);
            const isCrossLink = existingNode?.type === "contact";
            links.push({
              source: ownerNodeId,
              target: existingNodeId,
              distance: 180,
              thickness: isCrossLink ? 1.5 : 1,
              recency: 0.3,
              isMutual: true,
              isLinkedUser: false,
              isSecondDegree: true,
              isCrossLink,
            });
          }
          // Increase connection count
          const existingNode = nodes.find((n) => n.id === existingNodeId);
          if (existingNode) {
            existingNode.connectionCount++;
            existingNode.radius = nodeSize(existingNode.connectionCount);
          }
          continue;
        }

        // New second-degree contact
        const dedupKey = tc.linked_profile_id || `name:${tc.full_name.toLowerCase()}`;
        if (addedSecondDegreeIds.has(dedupKey)) continue;
        addedSecondDegreeIds.add(dedupKey);

        const nodeId = `their-${tc.id}`;
        // 2nd degree: show job title only, no name or company
        const jobLabel = tc.role || "";

        const tcSearchParts = [tc.full_name, tc.relationship_type, tc.company, tc.role, tc.location];
        nodes.push({
          id: nodeId,
          label: jobLabel,
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
        });

        if (tc.linked_profile_id) profileToNodeId[tc.linked_profile_id] = nodeId;
        nameToNodeId[tc.full_name.toLowerCase()] = nodeId;

        links.push({
          source: ownerNodeId,
          target: nodeId,
          distance: 160 * (0.85 + Math.random() * 0.3),
          thickness: 1,
          recency: 0.3,
          isMutual: false,
          isLinkedUser: false,
          isSecondDegree: true,
        });
      }

      setGraphData({ nodes, links });
      setLoading(false);
    }

    fetchAll();
  }, [router]);

  return { graphData, loading };
}
