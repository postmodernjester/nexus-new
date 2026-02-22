"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Nav from "@/components/Nav";
import * as d3 from "d3";

// ─── Types ───
interface Contact {
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
  next_action_note: string | null;
}

interface Connection {
  id: string;
  inviter_id: string;
  invitee_id: string;
  status: string;
}

interface NoteStats {
  contact_id: string;
  count: number;
  most_recent: string;
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  fullName: string;
  type: "self" | "contact" | "connected_user" | "their_contact";
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
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  distance: number;
  thickness: number;
  recency: number;
  isMutual: boolean;
  isLinkedUser: boolean;
  isSecondDegree?: boolean;
  isCrossLink?: boolean;
}

// ─── Constants ───
const CLOSENESS: Record<string, number> = {
  Family: 60,
  "Close Friend": 90,
  "Work-Friend": 140,
  Colleague: 160,
  Friend: 130,
  Business: 190,
  "Business Contact": 190,
  Acquaintance: 230,
  None: 300,
  Other: 250,
  Stranger: 280,
};

function computeRecency(mostRecent: string | null): number {
  if (!mostRecent) return 0.25;
  const daysSince =
    (Date.now() - new Date(mostRecent).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince <= 7) return 1.0;
  if (daysSince <= 30) return 1.0 - ((daysSince - 7) / 23) * 0.2;
  if (daysSince <= 365) return 0.8 - ((daysSince - 30) / 335) * 0.3;
  return Math.max(0.25, 0.5 - ((daysSince - 365) / 730) * 0.25);
}

function lineColor(
  _isMutual: boolean,
  isLinkedUser: boolean,
  recency: number,
  isSecondDegree?: boolean,
  isCrossLink?: boolean
): string {
  // Cross-links: linked user → my non-linked contact (amber, distinct)
  if (isCrossLink) {
    return "rgba(251, 146, 60, 0.6)";
  }
  // 2nd degree links: lighter grey so they don't vanish against dark bg
  if (isSecondDegree) {
    return "rgba(160, 180, 200, 0.5)";
  }
  // Linked user connections: red, alpha matches recency
  if (isLinkedUser) {
    return `rgba(220, 80, 80, ${recency})`;
  }
  // 1st degree: brighter slate, alpha matches recency
  return `rgba(160, 180, 200, ${recency})`;
}

function lineThickness(count: number): number {
  if (count === 0) return 1.2;
  if (count <= 2) return 2;
  if (count <= 5) return 2.5;
  if (count <= 10) return 3.5;
  if (count <= 20) return 4.5;
  return 6;
}

function nodeSize(count: number): number {
  return 8 + Math.min(count * 1.2, 16);
}

// ─── Component ───
export default function NetworkPage() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(
    null
  );
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [graphData, setGraphData] = useState<{
    nodes: GraphNode[];
    links: GraphLink[];
  }>({ nodes: [], links: [] });
  const [filterText, setFilterText] = useState("");
  const router = useRouter();

  useEffect(() => {
    async function fetchAll() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const [contactsRes, connectionsRes, notesRes, profileRes] =
        await Promise.all([
          supabase.from("contacts").select("*"),
          supabase.from("connections").select("*").eq("status", "accepted"),
          supabase.from("contact_notes").select("contact_id, entry_date, content"),
          supabase
            .from("profiles")
            .select("full_name, headline")
            .eq("id", user.id)
            .single(),
        ]);

      const allContacts: Contact[] = contactsRes.data || [];
      const myContacts = allContacts.filter((c) => c.owner_id === user.id);
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

      const mutualUserIds = new Set<string>();
      for (const conn of connections) {
        if (conn.inviter_id === user.id) mutualUserIds.add(conn.invitee_id);
        else if (conn.invitee_id === user.id)
          mutualUserIds.add(conn.inviter_id);
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

      const linkedProfileIds = allContacts
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

      const theirContacts = allContacts.filter(
        (c) => mutualUserIds.has(c.owner_id) && c.owner_id !== user.id
      );

      // ═══ DEDUP ═══
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

      // ① Self — show last name, golden warm color
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

      // ② Connected users (linked via connections table) — "F. LastName" format
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

      // ③ My contacts (that are NOT linked to a connected user) — "F. LastName" format
      for (const c of myContacts) {
        if (
          c.linked_profile_id &&
          mutualUserIds.has(c.linked_profile_id)
        ) {
          continue; // skip — already shown as connected_user node
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

      // ④ Their contacts (second-degree) — contacts owned by connected users
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
          // Already have this person — just add a link from the owner to them if not already linked
          const alreadyLinked = links.some(
            (l) =>
              (((l.source as GraphNode).id || l.source) === ownerNodeId &&
                ((l.target as GraphNode).id || l.target) === existingNodeId) ||
              (((l.source as GraphNode).id || l.source) === existingNodeId &&
                ((l.target as GraphNode).id || l.target) === ownerNodeId)
          );
          if (!alreadyLinked) {
            // Detect cross-link: linked user → my non-linked contact
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

  // ─── D3 Rendering ───
  useEffect(() => {
    if (loading || graphData.nodes.length === 0) return;
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    const g = svg.append("g");

    // Zoom
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });
    (svg as unknown as d3.Selection<SVGSVGElement, unknown, null, undefined>).call(zoom);
    // Disable zoom's built-in double-click-to-zoom so our dblclick handler works
    svg.on("dblclick.zoom", null);
    zoomRef.current = zoom;

    // Custom wiggle force for gentle continuous drift
    const wiggleForce = () => {
      let wNodes: GraphNode[] = [];
      const force = () => {
        for (const n of wNodes) {
          if (n.fx != null) continue; // skip dragged nodes
          n.vx = (n.vx || 0) + (Math.random() - 0.5) * 0.65;
          n.vy = (n.vy || 0) + (Math.random() - 0.5) * 0.65;
        }
      };
      force.initialize = (n: GraphNode[]) => { wNodes = n; };
      return force;
    };

    // Pin self node at center — you are always the center of your own network
    const selfNode = graphData.nodes.find(n => n.id === "self");
    if (selfNode) {
      selfNode.x = width / 2;
      selfNode.y = height / 2;
      selfNode.fx = width / 2;
      selfNode.fy = height / 2;
    }

    // Build adjacency map for clustering — nodes sharing neighbors attract
    const adjacency: Record<string, Set<string>> = {};
    for (const link of graphData.links) {
      const sId = typeof link.source === 'string' ? link.source : (link.source as GraphNode).id;
      const tId = typeof link.target === 'string' ? link.target : (link.target as GraphNode).id;
      if (!adjacency[sId]) adjacency[sId] = new Set();
      if (!adjacency[tId]) adjacency[tId] = new Set();
      adjacency[sId].add(tId);
      adjacency[tId].add(sId);
    }

    // Create cluster links between non-linked nodes that share neighbors
    const clusterLinks: GraphLink[] = [];
    const clusterPairSet = new Set<string>();
    const nodeIds = graphData.nodes.map(n => n.id);
    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        const a = nodeIds[i], b = nodeIds[j];
        if (a === 'self' || b === 'self') continue;
        const aNeighbors = adjacency[a] || new Set();
        const bNeighbors = adjacency[b] || new Set();
        if (aNeighbors.has(b)) continue; // already directly linked
        let shared = 0;
        for (const n of aNeighbors) { if (bNeighbors.has(n)) shared++; }
        if (shared >= 1) {
          const pairKey = a < b ? `${a}|${b}` : `${b}|${a}`;
          clusterPairSet.add(pairKey);
          clusterLinks.push({
            source: a,
            target: b,
            distance: Math.max(60, 180 - shared * 50),
            thickness: 0,
            recency: 0,
            isMutual: false,
            isLinkedUser: false,
          });
        }
      }
    }

    // Company similarity links — people at the same company attract slightly
    const companyGroups: Record<string, string[]> = {};
    for (const n of graphData.nodes) {
      if (n.company && n.id !== 'self') {
        const key = n.company.toLowerCase().trim();
        if (!companyGroups[key]) companyGroups[key] = [];
        companyGroups[key].push(n.id);
      }
    }
    for (const ids of Object.values(companyGroups)) {
      if (ids.length < 2) continue;
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const a = ids[i], b = ids[j];
          const pairKey = a < b ? `${a}|${b}` : `${b}|${a}`;
          if ((adjacency[a] || new Set()).has(b)) continue;
          if (clusterPairSet.has(pairKey)) continue;
          clusterPairSet.add(pairKey);
          clusterLinks.push({
            source: a,
            target: b,
            distance: 100,
            thickness: 0,
            recency: 0,
            isMutual: false,
            isLinkedUser: false,
          });
        }
      }
    }

    const allLinks = [...graphData.links, ...clusterLinks];

    const simulation = d3
      .forceSimulation<GraphNode>(graphData.nodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphLink>(allLinks)
          .id((d) => d.id)
          .distance((d) => d.distance)
          .strength((d) => d.thickness === 0 ? 0.04 : 0.12)
      )
      .force("charge", d3.forceManyBody().strength(-160).distanceMax(600))
      .force("x", d3.forceX<GraphNode>(width / 2).strength((d) => d.id === "self" ? 0.12 : 0.015))
      .force("y", d3.forceY<GraphNode>(height / 2).strength((d) => d.id === "self" ? 0.12 : 0.015))
      .force(
        "collision",
        d3.forceCollide<GraphNode>().radius((d) => d.radius + 5)
      )
      .force("wiggle", wiggleForce() as unknown as d3.Force<GraphNode, GraphLink>)
      .alphaTarget(0.02)
      .alphaDecay(0.004);

    simulationRef.current = simulation;

    // Links
    const link = g
      .append("g")
      .selectAll<SVGLineElement, GraphLink>("line")
      .data(graphData.links)
      .join("line")
      .attr("stroke", (d) => lineColor(d.isMutual, d.isLinkedUser, d.recency, d.isSecondDegree, d.isCrossLink))
      .attr("stroke-width", (d) => d.thickness)
      .attr("stroke-linecap", "round")
      .attr("stroke-dasharray", (d) => d.isCrossLink ? "6 4" : null);

    // Node groups — opacity reflects recency (self always 1.0)
    const node = g
      .append("g")
      .selectAll<SVGGElement, GraphNode>("g")
      .data(graphData.nodes)
      .join("g")
      .style("cursor", "pointer")
      .attr("opacity", (d) => d.recency ?? 1);

    // Circles
    node
      .append("circle")
      .attr("r", (d) => d.radius)
      .attr("fill", (d) => {
        if (d.type === "self") return "#a08040";
        if (d.type === "their_contact") return "#4a5568";
        return "#6b7f99"; // contact + connected_user
      })
      .attr("stroke", "none")
      .attr("stroke-width", 0);

    // Labels — self: last name, 1st degree: F. LastName, 2nd degree: job title
    node
      .append("text")
      .text((d) => d.label)
      .attr("text-anchor", "middle")
      .attr("dy", (d) => d.radius + 14)
      .attr("fill", (d) => {
        if (d.type === "self") return "#c9a050";
        if (d.type === "their_contact") return "#64748b";
        return "#94a3b8"; // contact + connected_user
      })
      .attr("font-size", (d) => (d.type === "their_contact" ? "8px" : "11px"))
      .attr("font-weight", (d) =>
        d.type === "self" ? "bold" : "normal"
      );

    // Hover events
    node
      .on("mouseenter", function (event, d) {
        setHoveredNode(d);
        setTooltipPos({ x: event.pageX, y: event.pageY });
      })
      .on("mousemove", function (event) {
        setTooltipPos({ x: event.pageX, y: event.pageY });
      })
      .on("mouseleave", function () {
        setHoveredNode(null);
      });

    // Click/dblclick detection via drag events + timers.
    // Double-click = open connection card.
    let dragMoved = false;
    let totalDragDist = 0;
    let lastTapTime = 0;
    let lastTapNodeId = "";

    const drag = d3
      .drag<SVGGElement, GraphNode>()
      .on("start", (event, d) => {
        dragMoved = false;
        totalDragDist = 0;
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        totalDragDist += Math.abs(event.dx) + Math.abs(event.dy);
        if (totalDragDist > 3) dragMoved = true;
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.02);
        // Keep self pinned at center
        if (d.type !== "self") {
          d.fx = null;
          d.fy = null;
        }

        if (dragMoved) return;
        if (d.type === "self") return;

        const now = Date.now();
        if (now - lastTapTime < 400 && lastTapNodeId === d.id) {
          // Double-tap → open card
          lastTapTime = 0;
          lastTapNodeId = "";
          if (d.contactId) router.push(`/contacts/${d.contactId}`);
        } else {
          lastTapTime = now;
          lastTapNodeId = d.id;
        }
      });

    node.call(drag);

    // Tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as GraphNode).x || 0)
        .attr("y1", (d) => (d.source as GraphNode).y || 0)
        .attr("x2", (d) => (d.target as GraphNode).x || 0)
        .attr("y2", (d) => (d.target as GraphNode).y || 0);

      node.attr("transform", (d) => `translate(${d.x || 0},${d.y || 0})`);
    });

    // Filter highlight — smart search across all contact data (notes, resume, city, etc.)
    if (filterText.trim()) {
      const q = filterText.toLowerCase();
      const matchesFilter = (d: GraphNode) => {
        if (d.type === "self") return true;
        return d.searchText ? d.searchText.includes(q) : false;
      };
      const matchedIds = new Set(graphData.nodes.filter(matchesFilter).map(n => n.id));
      node.attr("opacity", (d) => matchedIds.has(d.id) ? 1 : 0.06);
      link.attr("opacity", (d) => {
        const sId = (d.source as GraphNode).id;
        const tId = (d.target as GraphNode).id;
        if (matchedIds.has(sId) && matchedIds.has(tId)) return 1;
        return 0.03;
      });
    } else {
      // No filter — use recency-based opacity (self always 1.0)
      node.attr("opacity", (d) => d.recency ?? 1);
      link.attr("opacity", 1);
    }

    return () => {
      simulation.stop();
    };
  }, [loading, graphData, filterText, router]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Nav />

      {/* Search bar */}
      <div
        style={{
          padding: "8px 20px",
          background: "#0f172a",
          borderBottom: "1px solid #1e293b",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <input
          type="text"
          placeholder="Filter by name, company, role…"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          style={{
            padding: "6px 12px",
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: "6px",
            color: "#e2e8f0",
            fontSize: "13px",
            outline: "none",
            width: "220px",
          }}
        />
        <span style={{ color: "#475569", fontSize: "12px" }}>
          {graphData.nodes.length} nodes · {graphData.links.length} connections
        </span>
        <span style={{ color: "#334155", fontSize: "11px", marginLeft: "auto" }}>
          Double-click to open · Drag to reposition
        </span>
      </div>

      {/* Graph container */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          position: "relative",
          minHeight: "calc(100vh - 100px)",
        }}
      >
        {loading ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "#64748b",
            }}
          >
            Loading network…
          </div>
        ) : (
          <svg
            ref={svgRef}
            style={{
              width: "100%",
              height: "100%",
              position: "absolute",
              top: 0,
              left: 0,
            }}
          />
        )}

        {/* Tooltip */}
        {hoveredNode && (
          <div
            style={{
              position: "fixed",
              left: tooltipPos.x + 12,
              top: tooltipPos.y - 10,
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: "10px",
              padding: "12px 16px",
              zIndex: 50,
              pointerEvents: "none",
              maxWidth: "280px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            }}
          >
            {hoveredNode.type === "their_contact" ? (
              <>
                {/* 2nd degree: job title only */}
                {hoveredNode.role && (
                  <div style={{ fontWeight: 600, fontSize: "13px", color: "#e2e8f0" }}>
                    {hoveredNode.role}
                  </div>
                )}
                <div style={{ color: "#475569", fontSize: "11px", marginTop: "4px" }}>
                  2nd degree
                </div>
              </>
            ) : (
              <>
                {/* 1st degree + self: full name, title, company */}
                <div style={{ fontWeight: 600, fontSize: "14px", color: "#e2e8f0" }}>
                  {hoveredNode.fullName}
                </div>
                {hoveredNode.role && (
                  <div style={{ color: "#94a3b8", fontSize: "12px", marginTop: "2px" }}>
                    {hoveredNode.role}
                    {hoveredNode.company ? ` at ${hoveredNode.company}` : ""}
                  </div>
                )}
                {!hoveredNode.role && hoveredNode.company && (
                  <div style={{ color: "#94a3b8", fontSize: "12px", marginTop: "2px" }}>
                    {hoveredNode.company}
                  </div>
                )}
                {hoveredNode.type === "connected_user" && (
                  <div style={{ color: "#475569", fontSize: "11px", marginTop: "4px" }}>
                    NEXUS user
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Zoom controls */}
      <div
        style={{
          position: "fixed",
          bottom: "16px",
          right: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          zIndex: 20,
        }}
      >
        {[
          { label: "+", delta: 1.4 },
          { label: "\u2013", delta: 1 / 1.4 },
        ].map(({ label, delta }) => (
          <button
            key={label}
            onClick={() => {
              if (!svgRef.current || !zoomRef.current) return;
              const svg = d3.select(svgRef.current);
              (svg as unknown as d3.Selection<SVGSVGElement, unknown, null, undefined>)
                .transition()
                .duration(250)
                .call(zoomRef.current.scaleBy, delta);
            }}
            style={{
              width: "36px",
              height: "36px",
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: "8px",
              color: "#94a3b8",
              fontSize: "18px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
