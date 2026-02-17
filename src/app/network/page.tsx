"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import * as d3 from "d3";

interface Contact {
  id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  relationship_type: string;
  company: string | null;
  role: string | null;
  job_title: string | null;
  owner_id: string;
  location: string | null;
  skills: string | null;
  notes: string | null;
  email: string | null;
  phone: string | null;
  education: string | null;
  linked_profile_id: string | null;
}

interface Connection {
  id: string;
  inviter_id: string;
  invitee_id: string;
  invite_code: string;
  status: string;
  contact_id: string | null;
}

interface InteractionStats {
  contact_id: string;
  count: number;
  most_recent: string;
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  type: "self" | "contact" | "connected_user" | "their_contact";
  radius: number;
  connectionCount: number;
  company?: string;
  jobTitle?: string;
  fullName?: string;
  owner_id?: string;
  user_id?: string;
  contactId?: string;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  distance: number;
  thickness: number;
  recency: number;
  isMutual: boolean;
  isOwn: boolean;
}

const CLOSENESS: Record<string, number> = {
  Family: 60,
  "Close Friend": 90,
  Friend: 130,
  Colleague: 160,
  Business: 190,
  Acquaintance: 230,
  Stranger: 280,
};

function computeRecency(mostRecent: string | null): number {
  if (!mostRecent) return 0.1;
  const now = Date.now();
  const then = new Date(mostRecent).getTime();
  const daysSince = (now - then) / (1000 * 60 * 60 * 24);
  if (daysSince <= 1) return 1;
  if (daysSince <= 7) return 0.9;
  if (daysSince <= 14) return 0.75;
  if (daysSince <= 30) return 0.6;
  if (daysSince <= 90) return 0.45;
  if (daysSince <= 180) return 0.3;
  if (daysSince <= 365) return 0.2;
  return 0.1;
}

function lineColor(isOwn: boolean, isMutual: boolean, recency: number): string {
  if (isMutual) {
    const alpha = 0.2 + recency * 0.8;
    return `rgba(220, 38, 38, ${alpha})`;
  }
  const alpha = 0.15 + recency * 0.7;
  return `rgba(255, 255, 255, ${alpha})`;
}

function thicknessFromCount(count: number): number {
  if (count === 0) return 0.8;
  if (count <= 2) return 1.5;
  if (count <= 5) return 2.5;
  if (count <= 10) return 3.5;
  if (count <= 20) return 4.5;
  return 6;
}

function nodeSizeFromConnections(count: number, type: string): number {
  const base = type === "self" ? 16 : type === "connected_user" ? 13 : 8;
  return base + Math.min(count * 0.8, 12);
}

function getJobTitle(c: any): string {
  return c?.job_title || c?.role || "";
}

function getDisplayName(c: any): string {
  const firstName = (c.first_name || "").trim();
  const lastName = (c.last_name || "").trim();
  const fullName = (c.full_name || "").trim();

  if (firstName && lastName) {
    return `${firstName.charAt(0).toUpperCase()}. ${lastName}`;
  }
  if (fullName) {
    const parts = fullName.split(" ");
    if (parts.length >= 2) {
      return `${parts[0].charAt(0).toUpperCase()}. ${parts.slice(1).join(" ")}`;
    }
    return fullName;
  }
  if (firstName) return firstName;
  if (lastName) return lastName;
  return getJobTitle(c) || "Unknown";
}

function getFullName(c: any): string {
  const firstName = (c.first_name || "").trim();
  const lastName = (c.last_name || "").trim();
  const fullName = (c.full_name || "").trim();
  if (fullName) return fullName;
  if (firstName && lastName) return `${firstName} ${lastName}`;
  if (firstName) return firstName;
  if (lastName) return lastName;
  return "";
}

function matchesFilter(contact: any, term: string): boolean {
  if (!term) return true;
  const lower = term.toLowerCase();
  const fields = [
    contact.first_name, contact.last_name, contact.full_name,
    contact.job_title, contact.role, contact.company,
    contact.location, contact.email, contact.phone,
    contact.notes, contact.skills, contact.education,
  ];
  return fields.some((f) => f && String(f).toLowerCase().includes(lower));
}

function normalizeNameForMatch(name: string): string {
  return (name || "").toLowerCase().replace(/[^a-z]/g, "").trim();
}

export default function NetworkPage() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [centeredNodeId, setCenteredNodeId] = useState<string>("self");
  const [filter, setFilter] = useState("");
  const [allData, setAllData] = useState<any>(null);
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; links: GraphLink[] }>({ nodes: [], links: [] });
  const router = useRouter();

  // Fetch all data once
  useEffect(() => {
    async function fetchAll() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      const user = session.user;

      const [contactsRes, connectionsRes, interactionsRes, profileRes] = await Promise.all([
        supabase.from("contacts").select("*"),
        supabase.from("connections").select("*").eq("status", "accepted"),
        supabase.from("interactions").select("contact_id, interaction_date"),
        supabase.from("profiles").select("id, full_name, job_title, company").eq("id", user.id).single(),
      ]);

      const connections: Connection[] = connectionsRes.data || [];
      const connectedUserIds: string[] = [];
      for (const conn of connections) {
        if (conn.inviter_id === user.id) connectedUserIds.push(conn.invitee_id);
        else if (conn.invitee_id === user.id) connectedUserIds.push(conn.inviter_id);
      }

      let connectedProfilesMap: Record<string, any> = {};
      if (connectedUserIds.length > 0) {
        const { data: connProfiles } = await supabase
          .from("profiles")
          .select("id, full_name, job_title, company")
          .in("id", connectedUserIds);
        for (const p of connProfiles || []) {
          connectedProfilesMap[p.id] = p;
        }
      }

      setAllData({
        user,
        allContacts: contactsRes.data || [],
        connections,
        allInteractions: interactionsRes.data || [],
        myProfile: profileRes.data,
        connectedProfiles: connectedProfilesMap,
      });
      setLoading(false);
    }
    fetchAll();
  }, [router]);

  // Build graph whenever data or filter changes
  useEffect(() => {
    if (!allData) return;

    const { user, allContacts, connections, allInteractions, myProfile, connectedProfiles } = allData;
    const myContacts: Contact[] = allContacts.filter((c: Contact) => c.owner_id === user.id);

    // Interaction stats
    const interactionMap: Record<string, InteractionStats> = {};
    for (const i of allInteractions) {
      if (!interactionMap[i.contact_id]) {
        interactionMap[i.contact_id] = { contact_id: i.contact_id, count: 0, most_recent: i.interaction_date };
      }
      interactionMap[i.contact_id].count++;
      if (i.interaction_date > interactionMap[i.contact_id].most_recent) {
        interactionMap[i.contact_id].most_recent = i.interaction_date;
      }
    }

    // Mutual connections
    const mutualUserIds: string[] = [];
    const contactIdToUserId: Record<string, string> = {};
    for (const conn of connections) {
      const otherId = conn.inviter_id === user.id ? conn.invitee_id : conn.inviter_id;
      if (conn.inviter_id === user.id || conn.invitee_id === user.id) {
        mutualUserIds.push(otherId);
      }
      if (conn.contact_id) {
        contactIdToUserId[conn.contact_id] = otherId;
      }
    }

    // Their contacts (2nd degree)
    const theirContacts: Contact[] = allContacts.filter((c: Contact) =>
      mutualUserIds.includes(c.owner_id) && c.owner_id !== user.id
    );

    // Connection counts
    const contactConnectionCount: Record<string, number> = {};
    for (const c of allContacts) {
      contactConnectionCount[c.id] = (contactConnectionCount[c.id] || 0) + 1;
    }

    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];

    // === DEDUP TRACKING ===
    // Maps a normalized person identity to the node ID already in the graph
    const personToNodeId: Map<string, string> = new Map();

    // 1. SELF
    const myName = myProfile?.full_name || "You";
    nodes.push({
      id: "self",
      label: myName,
      type: "self",
      radius: nodeSizeFromConnections(myContacts.length + mutualUserIds.length, "self"),
      connectionCount: myContacts.length + mutualUserIds.length,
      jobTitle: myProfile?.job_title || "",
      company: myProfile?.company || "",
      fullName: myName,
      user_id: user.id,
    });
    personToNodeId.set(user.id, "self");
    const selfNorm = normalizeNameForMatch(myName);
    if (selfNorm) personToNodeId.set(selfNorm, "self");

    // 2. MY CONTACTS (skip deduped connected users)
    for (const c of myContacts) {
      if (contactIdToUserId[c.id]) continue;
      if (!matchesFilter(c, filter)) continue;

      const stats = interactionMap[c.id];
      const connCount = contactConnectionCount[c.id] || 1;

      nodes.push({
        id: c.id,
        label: getDisplayName(c),
        type: "contact",
        radius: nodeSizeFromConnections(connCount, "contact"),
        connectionCount: connCount,
        company: c.company ?? undefined,
        jobTitle: getJobTitle(c),
        fullName: getFullName(c),
        owner_id: c.owner_id,
        contactId: c.id,
      });

      links.push({
        source: "self",
        target: c.id,
        distance: CLOSENESS[c.relationship_type] || 230,
        thickness: thicknessFromCount(stats?.count || 0),
        recency: computeRecency(stats?.most_recent || null),
        isMutual: false,
        isOwn: true,
      });

      // Track for dedup
      if (c.linked_profile_id) {
        personToNodeId.set(c.linked_profile_id, c.id);
      }
      const normName = normalizeNameForMatch(getFullName(c));
      if (normName) personToNodeId.set(normName, c.id);
    }

    // 3. CONNECTED USERS (mutual via invite code)
    for (const uid of mutualUserIds) {
      const linkedContactId = Object.entries(contactIdToUserId).find(([_, v]) => v === uid)?.[0];
      const linkedContact = linkedContactId ? myContacts.find((c: Contact) => c.id === linkedContactId) : null;
      const profile = connectedProfiles[uid];

      const merged = {
        first_name: linkedContact?.first_name || "",
        last_name: linkedContact?.last_name || "",
        full_name: linkedContact?.full_name || profile?.full_name || "",
        job_title: linkedContact?.job_title || linkedContact?.role || profile?.job_title || "",
        company: linkedContact?.company || profile?.company || "",
      };

      const stats = linkedContactId ? interactionMap[linkedContactId] : undefined;
      const userTheirContacts = theirContacts.filter((tc: Contact) => tc.owner_id === uid);
      const connCount = (linkedContact ? contactConnectionCount[linkedContact.id] || 0 : 0) + userTheirContacts.length;

      nodes.push({
        id: `user-${uid}`,
        label: getDisplayName(merged),
        type: "connected_user",
        radius: nodeSizeFromConnections(connCount, "connected_user"),
        connectionCount: connCount,
        company: merged.company || undefined,
        jobTitle: merged.job_title || undefined,
        fullName: getFullName(merged),
        user_id: uid,
        contactId: linkedContactId || undefined,
      });

      links.push({
        source: "self",
        target: `user-${uid}`,
        distance: linkedContact ? CLOSENESS[linkedContact.relationship_type] || 130 : 130,
        thickness: thicknessFromCount(stats?.count || 0),
        recency: computeRecency(stats?.most_recent || null),
        isMutual: true,
        isOwn: true,
      });

      // Track for dedup
      personToNodeId.set(uid, `user-${uid}`);
      const normName = normalizeNameForMatch(getFullName(merged));
      if (normName) personToNodeId.set(normName, `user-${uid}`);
    }

    // 4. THEIR CONTACTS (2nd degree) — WITH DEDUP
    for (const uid of mutualUserIds) {
      const userTheirContacts = theirContacts.filter((tc: Contact) => tc.owner_id === uid);

      for (const tc of userTheirContacts) {
        // === DEDUP: check if this person already exists as a node ===
        let existingNodeId: string | null = null;

        // Check by linked_profile_id
        if (tc.linked_profile_id && personToNodeId.has(tc.linked_profile_id)) {
          existingNodeId = personToNodeId.get(tc.linked_profile_id)!;
        }

        // Check by normalized name
        if (!existingNodeId) {
          const normName = normalizeNameForMatch(getFullName(tc));
          if (normName && personToNodeId.has(normName)) {
            existingNodeId = personToNodeId.get(normName)!;
          }
        }

        // If match found, just add a link to existing node — NO new dot
        if (existingNodeId) {
          const linkExists = links.some(
            (l) =>
              (l.source === `user-${uid}` || (l.source as GraphNode)?.id === `user-${uid}`) &&
              (l.target === existingNodeId || (l.target as GraphNode)?.id === existingNodeId)
          );
          if (!linkExists) {
            links.push({
              source: `user-${uid}`,
              target: existingNodeId,
              distance: CLOSENESS[tc.relationship_type] || 200,
              thickness: 1,
              recency: 0.3,
              isMutual: true,
              isOwn: false,
            });
          }
          continue; // Skip — no new node
        }

        // No match — create new node
        const theirNodeId = `their-${tc.id}`;

        nodes.push({
          id: theirNodeId,
          label: getDisplayName(tc),
          type: "their_contact",
          radius: nodeSizeFromConnections(1, "their_contact"),
          connectionCount: 1,
          company: tc.company ?? undefined,
          jobTitle: getJobTitle(tc),
          fullName: getFullName(tc),
          owner_id: tc.owner_id,
          contactId: tc.id,
        });

        links.push({
          source: `user-${uid}`,
          target: theirNodeId,
          distance: CLOSENESS[tc.relationship_type] || 200,
          thickness: 1,
          recency: 0.3,
          isMutual: false,
          isOwn: false,
        });

        // Track for future dedup within this loop
        if (tc.linked_profile_id) {
          personToNodeId.set(tc.linked_profile_id, theirNodeId);
        }
        const normName = normalizeNameForMatch(getFullName(tc));
        if (normName) personToNodeId.set(normName, theirNodeId);
      }
    }

    setGraphData({ nodes, links });
  }, [allData, filter]);

  // D3 rendering
  useEffect(() => {
    if (!graphData.nodes.length || !svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    const g = svg.append("g");

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 4])
      .on("zoom", (event) => g.attr("transform", event.transform));
    svg.call(zoom);

    const centerNode = graphData.nodes.find((n) => n.id === centeredNodeId) || graphData.nodes[0];
    const sim = d3.forceSimulation<GraphNode>(graphData.nodes)
      .force("link", d3.forceLink<GraphNode, GraphLink>(graphData.links).id((d) => d.id).distance((d) => d.distance))
      .force("charge", d3.forceManyBody().strength(-120))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide<GraphNode>().radius((d) => d.radius + 4));
    simulationRef.current = sim;

    const link = g.append("g")
      .selectAll("line")
      .data(graphData.links)
      .join("line")
      .attr("stroke", (d) => lineColor(d.isOwn, d.isMutual, d.recency))
      .attr("stroke-width", (d) => d.thickness)
      .attr("stroke-linecap", "round");

    const node = g.append("g")
      .selectAll("circle")
      .data(graphData.nodes)
      .join("circle")
      .attr("r", (d) => d.radius)
      .attr("fill", (d) => {
        if (d.type === "self") return "#DC2626";
        if (d.type === "connected_user") return "#F97316";
        if (d.type === "their_contact") return "#6B7280";
        return "#ffffff";
      })
      .attr("stroke", (d) => {
        if (d.type === "self") return "#FCA5A5";
        if (d.type === "connected_user") return "#FDBA74";
        return "#555";
      })
      .attr("stroke-width", (d) => (d.type === "self" ? 3 : d.type === "connected_user" ? 2 : 1))
      .attr("cursor", "pointer")
      .on("mouseover", function (event, d) {
        setHoveredNode(d);
        setTooltipPos({ x: event.pageX, y: event.pageY });
        d3.select(this).transition().duration(200).attr("r", d.radius * 1.3);
      })
      .on("mouseout", function (_, d) {
        setHoveredNode(null);
        d3.select(this).transition().duration(200).attr("r", d.radius);
      })
      .on("click", (_, d) => {
        if (d.contactId) {
          router.push(`/contacts/${d.contactId}`);
        }
      })
      .call(
        d3.drag<SVGCircleElement, GraphNode>()
          .on("start", (event, d) => {
            if (!event.active) sim.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) sim.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    const label = g.append("g")
      .selectAll("text")
      .data(graphData.nodes)
      .join("text")
      .text((d) => d.label)
      .attr("font-size", (d) => (d.type === "self" ? 14 : d.type === "connected_user" ? 12 : 10))
      .attr("fill", (d) => {
        if (d.type === "self") return "#FCA5A5";
        if (d.type === "connected_user") return "#FDBA74";
        if (d.type === "their_contact") return "#9CA3AF";
        return "#E5E7EB";
      })
      .attr("text-anchor", "middle")
      .attr("dy", (d) => d.radius + 14)
      .attr("pointer-events", "none")
      .attr("font-weight", (d) => (d.type === "self" || d.type === "connected_user" ? "700" : "400"));

    sim.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as GraphNode).x!)
        .attr("y1", (d) => (d.source as GraphNode).y!)
        .attr("x2", (d) => (d.target as GraphNode).x!)
        .attr("y2", (d) => (d.target as GraphNode).y!);
      node.attr("cx", (d) => d.x!).attr("cy", (d) => d.y!);
      label.attr("x", (d) => d.x!).attr("y", (d) => d.y!);
    });

    sim.on("end", () => {
      if (centerNode) {
        const x = centerNode.x || width / 2;
        const y = centerNode.y || height / 2;
        const transform = d3.zoomIdentity
          .translate(width / 2, height / 2)
          .scale(1)
          .translate(-x, -y);
        svg.transition().duration(500).call(zoom.transform, transform);
      }
    });

    return () => { sim.stop(); };
  }, [graphData, centeredNodeId, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        <div className="animate-pulse text-lg">Loading your network...</div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full bg-black overflow-hidden">
      {/* Header */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-3">
        <button
          onClick={() => router.push("/dashboard")}
          className="bg-zinc-900/80 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white hover:bg-zinc-800 transition-colors backdrop-blur-sm"
        >
          ← Back
        </button>
        <h1 className="text-white text-lg font-semibold">Network</h1>
      </div>

      {/* Search */}
      <div className="absolute top-4 right-4 z-20">
        <input
          type="text"
          placeholder="Filter contacts..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-zinc-900/80 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 backdrop-blur-sm w-48 focus:outline-none focus:border-zinc-500"
        />
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-20 bg-zinc-900/80 border border-zinc-700 rounded-lg p-3 backdrop-blur-sm">
        <div className="flex flex-col gap-1.5 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-600" />
            <span className="text-zinc-300">You</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500" />
            <span className="text-zinc-300">Connected on NEXUS</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-white" />
            <span className="text-zinc-300">Your contacts</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-500" />
            <span className="text-zinc-300">Their contacts</span>
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {hoveredNode && (
        <div
          className="fixed z-50 bg-zinc-900 border border-zinc-600 rounded-lg px-3 py-2 pointer-events-none shadow-lg"
          style={{
            left: tooltipPos.x + 15,
            top: tooltipPos.y - 10,
          }}
        >
          <div className="text-white font-medium text-sm">{hoveredNode.fullName || hoveredNode.label}</div>
          {hoveredNode.jobTitle && <div className="text-zinc-400 text-xs">{hoveredNode.jobTitle}</div>}
          {hoveredNode.company && <div className="text-zinc-400 text-xs">{hoveredNode.company}</div>}
          <div className="text-zinc-500 text-xs mt-1">{hoveredNode.connectionCount} connection{hoveredNode.connectionCount !== 1 ? "s" : ""}</div>
        </div>
      )}

      {/* Graph */}
      <div ref={containerRef} className="w-full h-full">
        <svg ref={svgRef} className="w-full h-full" />
      </div>
    </div>
  );
}