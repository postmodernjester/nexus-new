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

      const label = linkedContact
        ? getDisplayName(linkedContact)
        : profile?.full_name || "Connected User";

      const fullName = linkedContact
        ? getFullName(linkedContact)
        : profile?.full_name || "";

      const stats = linkedContact ? interactionMap[linkedContact.id] : undefined;
      const connCount = (contactConnectionCount[linkedContactId || ""] || 0) + 1;

      const nodeId = `user-${uid}`;
      nodes.push({
        id: nodeId,
        label,
        type: "connected_user",
        radius: nodeSizeFromConnections(connCount, "connected_user"),
        connectionCount: connCount,
        company: linkedContact?.company || profile?.company || undefined,
        jobTitle: linkedContact ? getJobTitle(linkedContact) : profile?.job_title || "",
        fullName,
        user_id: uid,
        contactId: linkedContactId || undefined,
      });

      links.push({
        source: "self",
        target: nodeId,
        distance: linkedContact
          ? CLOSENESS[linkedContact.relationship_type] || 130
          : 130,
        thickness: thicknessFromCount(stats?.count || 0),
        recency: computeRecency(stats?.most_recent || null),
        isMutual: true,
        isOwn: true,
      });

      // Track connected user for dedup
      personToNodeId.set(uid, nodeId);
      const normConnName = normalizeNameForMatch(fullName);
      if (normConnName) personToNodeId.set(normConnName, nodeId);
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
    if (!svgRef.current || !containerRef.current || graphData.nodes.length === 0) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg.append("g");

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.2, 4]).on("zoom", (event) => {
      g.attr("transform", event.transform);
    });
    svg.call(zoom);

    const sim = d3.forceSimulation<GraphNode>(graphData.nodes)
      .force(
        "link",
        d3.forceLink<GraphNode, GraphLink>(graphData.links)
          .id((d) => d.id)
          .distance((d) => d.distance)
      )
      .force("charge", d3.forceManyBody().strength(-80))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide<GraphNode>().radius((d) => d.radius + 4));

    simulationRef.current = sim;

    // Links
    const link = g
      .append("g")
      .selectAll("line")
      .data(graphData.links)
      .join("line")
      .attr("stroke", (d) => lineColor(d.isOwn, d.isMutual, d.recency))
      .attr("stroke-width", (d) => d.thickness)
      .attr("stroke-linecap", "round");

    // Nodes
    const node = g
      .append("g")
      .selectAll("circle")
      .data(graphData.nodes)
      .join("circle")
      .attr("r", (d) => d.radius)
      .attr("fill", (d) => {
        switch (d.type) {
          case "self": return "#3b82f6";
          case "connected_user": return "#ef4444";
          case "contact": return "#6b7280";
          case "their_contact": return "#374151";
          default: return "#6b7280";
        }
      })
      .attr("stroke", (d) => {
        switch (d.type) {
          case "self": return "#93c5fd";
          case "connected_user": return "#fca5a5";
          default: return "#4b5563";
        }
      })
      .attr("stroke-width", (d) => (d.type === "self" ? 3 : d.type === "connected_user" ? 2 : 1))
      .attr("cursor", "pointer")
      .on("mouseover", function (event, d) {
        setHoveredNode(d);
        setTooltipPos({ x: event.pageX, y: event.pageY });
        d3.select(this).attr("stroke", "#fff").attr("stroke-width", 3);
      })
      .on("mouseout", function (_, d) {
        setHoveredNode(null);
        d3.select(this)
          .attr("stroke", d.type === "self" ? "#93c5fd" : d.type === "connected_user" ? "#fca5a5" : "#4b5563")
          .attr("stroke-width", d.type === "self" ? 3 : d.type === "connected_user" ? 2 : 1);
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
          }) as any
      );

    // Labels
    const labels = g
      .append("g")
      .selectAll("text")
      .data(graphData.nodes)
      .join("text")
      .text((d) => d.label)
      .attr("font-size", (d) => (d.type === "self" ? 14 : d.type === "connected_user" ? 12 : 10))
      .attr("fill", (d) => (d.type === "self" ? "#93c5fd" : d.type === "connected_user" ? "#fca5a5" : "#9ca3af"))
      .attr("text-anchor", "middle")
      .attr("dy", (d) => d.radius + 14)
      .attr("pointer-events", "none")
      .attr("font-weight", (d) => (d.type === "self" || d.type === "connected_user" ? "bold" : "normal"));

    sim.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as GraphNode).x!)
        .attr("y1", (d) => (d.source as GraphNode).y!)
        .attr("x2", (d) => (d.target as GraphNode).x!)
        .attr("y2", (d) => (d.target as GraphNode).y!);
      node.attr("cx", (d) => d.x!).attr("cy", (d) => d.y!);
      labels.attr("x", (d) => d.x!).attr("y", (d) => d.y!);
    });

    // Center on selected node
    const centerNode = graphData.nodes.find((n) => n.id === centeredNodeId) || graphData.nodes[0];
    if (centerNode) {
      setTimeout(() => {
        const scale = 1.2;
        svg
          .transition()
          .duration(750)
          .call(
            zoom.transform,
            d3.zoomIdentity
              .translate(width / 2, height / 2)
              .scale(scale)
              .translate(-(centerNode.x || width / 2), -(centerNode.y || height / 2))
          );
      }, 1000);
    }

    return () => { sim.stop(); };
  }, [graphData, centeredNodeId, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-zinc-400">Loading network…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <button onClick={() => router.push("/dashboard")} className="text-zinc-400 hover:text-white text-sm">
          ← Back
        </button>
        <h1 className="text-lg font-bold">Network</h1>
        <div className="w-12" />
      </div>

      {/* Search */}
      <div className="px-4 py-2">
        <input
          type="text"
          placeholder="Filter by name, company, role..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
        />
      </div>

      {/* Legend */}
      <div className="flex gap-4 px-4 py-1 text-xs text-zinc-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> You
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Connected
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-gray-500 inline-block" /> Contacts
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-gray-700 inline-block" /> 2nd°
        </span>
      </div>

      {/* Graph */}
      <div ref={containerRef} className="flex-1 relative">
        <svg ref={svgRef} className="w-full h-full" />

        {hoveredNode && (
          <div
            className="fixed z-50 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm shadow-xl pointer-events-none"
            style={{ left: tooltipPos.x + 12, top: tooltipPos.y - 12 }}
          >
            <p className="font-bold text-white">{hoveredNode.fullName || hoveredNode.label}</p>
            {hoveredNode.jobTitle && <p className="text-zinc-400">{hoveredNode.jobTitle}</p>}
            {hoveredNode.company && <p className="text-zinc-500">{hoveredNode.company}</p>}
            <p className="text-zinc-600 text-xs mt-1">
              {hoveredNode.connectionCount} connection{hoveredNode.connectionCount !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
