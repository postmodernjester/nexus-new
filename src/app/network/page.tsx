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

      // Also fetch profiles for all connected users
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

    // 2. MY CONTACTS (skip deduped connected users)
    // Label: "J. Smith" | Hover: full name, job title, company
    for (const c of myContacts) {
      if (contactIdToUserId[c.id]) continue; // dedup — shows as connected_user instead
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
    }

    // 3. CONNECTED USERS (mutual via invite code)
    // Label: "J. Smith" | Hover: full name, job title, company
    for (const uid of mutualUserIds) {
      // Try to get info from linked contact first, then from profile
      const linkedContactId = Object.entries(contactIdToUserId).find(([_, v]) => v === uid)?.[0];
      const linkedContact = linkedContactId ? myContacts.find((c: Contact) => c.id === linkedContactId) : null;
      const profile = connectedProfiles[uid];

      // Build a merged data source: contact data takes priority, profile fills gaps
      const merged = {
        first_name: linkedContact?.first_name || "",
        last_name: linkedContact?.last_name || "",
        full_name: linkedContact?.full_name || profile?.full_name || "",
        job_title: linkedContact?.job_title || linkedContact?.role || profile?.job_title || "",
        company: linkedContact?.company || profile?.company || "",
      };

      const displayName = getDisplayName(merged);
      const fullName = getFullName(merged);

      if (filter && linkedContact && !matchesFilter(linkedContact, filter)) continue;
      if (filter && !linkedContact && profile && !matchesFilter({ full_name: profile.full_name, job_title: profile.job_title, company: profile.company }, filter)) continue;

      const theirContactCount = theirContacts.filter((c: Contact) => c.owner_id === uid).length;

      nodes.push({
        id: `user-${uid}`,
        label: displayName,
        type: "connected_user",
        radius: nodeSizeFromConnections(theirContactCount + 1, "connected_user"),
        connectionCount: theirContactCount + 1,
        jobTitle: merged.job_title,
        company: merged.company,
        fullName: fullName,
        user_id: uid,
        contactId: linkedContactId,
      });

      links.push({
        source: "self",
        target: `user-${uid}`,
        distance: linkedContact ? (CLOSENESS[linkedContact.relationship_type] || 120) : 120,
        thickness: 4,
        recency: 1,
        isMutual: true,
        isOwn: false,
      });

      // 4. THEIR CONTACTS (2nd degree)
      // Label: job title only | Hover: job title, company
      for (const tc of theirContacts.filter((c: Contact) => c.owner_id === uid)) {
        if (filter && !matchesFilter(tc, filter)) continue;

        const stats = interactionMap[tc.id];
        const connCount = contactConnectionCount[tc.id] || 1;
        const jobTitle = getJobTitle(tc);
        const displayLabel = jobTitle || (tc.company ? `@ ${tc.company}` : getDisplayName(tc));

        const isShared = myContacts.some((mc: Contact) =>
          (mc.first_name && tc.first_name && mc.first_name === tc.first_name && mc.last_name === tc.last_name) ||
          (mc.full_name && tc.full_name && mc.full_name === tc.full_name)
        );

        nodes.push({
          id: `their-${tc.id}`,
          label: displayLabel,
          type: "their_contact",
          radius: nodeSizeFromConnections(connCount, "their_contact"),
          connectionCount: connCount,
          jobTitle: jobTitle,
          company: tc.company ?? undefined,
          owner_id: tc.owner_id,
        });

        links.push({
          source: `user-${tc.owner_id}`,
          target: `their-${tc.id}`,
          distance: CLOSENESS[tc.relationship_type] || 230,
          thickness: thicknessFromCount(stats?.count || 0),
          recency: computeRecency(stats?.most_recent || null),
          isMutual: isShared,
          isOwn: false,
        });
      }
    }

    setGraphData({ nodes, links });
  }, [allData, filter]);

  // Render D3
  useEffect(() => {
    if (loading || !svgRef.current || !containerRef.current) return;
    if (graphData.nodes.length === 0) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    const g = svg.append("g");

    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.2, 4])
        .on("zoom", (event) => {
          g.attr("transform", event.transform);
        }) as any
    );

    const nodes: GraphNode[] = graphData.nodes.map(n => ({ ...n }));
    const links: GraphLink[] = graphData.links.map(l => ({
      ...l,
      source: typeof l.source === "object" ? (l.source as GraphNode).id : l.source,
      target: typeof l.target === "object" ? (l.target as GraphNode).id : l.target,
    }));

    // Pin centered node
    const centeredNode = nodes.find(n => n.id === centeredNodeId);
    if (centeredNode) {
      centeredNode.fx = width / 2;
      centeredNode.fy = height / 2;
    }

    const simulation = d3
      .forceSimulation<GraphNode>(nodes)
      .force(
        "link",
        d3.forceLink<GraphNode, GraphLink>(links)
          .id(d => d.id)
          .distance(d => d.distance)
          .strength(0.6)
      )
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2).strength(0.05))
      .force("collision", d3.forceCollide<GraphNode>().radius(d => d.radius + 6));

    simulationRef.current = simulation;

    // Links
    const link = g
      .append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", d => lineColor(d.isOwn, d.isMutual, d.recency))
      .attr("stroke-width", d => d.thickness)
      .attr("stroke-linecap", "round");

    // Nodes
    const node = g
      .append("g")
      .selectAll<SVGGElement, GraphNode>("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "pointer")
      .on("mouseover", function (event, d) {
        setHoveredNode(d);
        setTooltipPos({ x: event.clientX, y: event.clientY });
      })
      .on("mousemove", function (event) {
        setTooltipPos({ x: event.clientX, y: event.clientY });
      })
      .on("mouseout", function () {
        setHoveredNode(null);
      })
      .on("click", (event, d) => {
        if (d.type === "self") return;
        if (d.contactId) {
          router.push(`/contacts/${d.contactId}`);
        }
      })
      .on("dblclick", (event, d) => {
        event.preventDefault();
        nodes.forEach(n => { n.fx = null; n.fy = null; });
        d.fx = width / 2;
        d.fy = height / 2;
        setCenteredNodeId(d.id);
        simulation.alpha(0.8).restart();
      })
      .call(
        d3.drag<SVGGElement, GraphNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            if (d.id !== centeredNodeId) {
              d.fx = null;
              d.fy = null;
            }
          })
      );

    // Circles — muted colors, no stroke
    node
      .append("circle")
      .attr("r", d => d.radius)
      .attr("fill", d => {
        switch (d.type) {
          case "self": return "#6B7F8E";
          case "connected_user": return "#8E6B6B";
          case "contact": return "#64748b";
          case "their_contact": return "#475569";
          default: return "#64748b";
        }
      })
      .attr("stroke", "none");

    // Labels
    node
      .append("text")
      .text(d => d.label)
      .attr("text-anchor", "middle")
      .attr("dy", d => d.radius + 14)
      .attr("font-size", d => {
        if (d.type === "self") return "13px";
        if (d.type === "connected_user") return "12px";
        if (d.type === "their_contact") return "10px";
        return "11px";
      })
      .attr("fill", d => {
        if (d.type === "self") return "#93c5fd";
        if (d.type === "connected_user") return "#e8a0a0";
        if (d.type === "their_contact") return "#64748b";
        return "#94a3b8";
      })
      .attr("font-family", "system-ui, sans-serif")
      .attr("pointer-events", "none");

    // Tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);
      node.attr("transform", d => `translate(${d.x}, ${d.y})`);
    });

    return () => { simulation.stop(); };
  }, [graphData, loading, centeredNodeId, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400">Loading network...</p>
      </div>
    );
  }

  const totalContacts = graphData.nodes.filter(n => n.type === "contact").length;
  const totalConnected = graphData.nodes.filter(n => n.type === "connected_user").length;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-gray-400 hover:text-gray-200 text-sm"
          >
            ← Dashboard
          </button>
          <h1 className="text-lg font-medium text-gray-200">Network</h1>
        </div>
        <div className="flex items-center gap-4">
          <input
            type="text"
            placeholder="Filter by skill, company, location, keyword..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-200 w-80 focus:outline-none focus:ring-2 focus:ring-gray-600 placeholder-gray-500"
          />
          {filter && (
            <button
              onClick={() => setFilter("")}
              className="text-xs text-gray-400 hover:text-gray-200"
            >
              Clear
            </button>
          )}
          <div className="flex gap-4 text-sm text-gray-500">
            <span>{totalContacts} contacts</span>
            <span>{totalConnected} linked</span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="px-6 py-2 flex flex-wrap gap-6 text-xs border-b border-gray-800/50">
        <span className="flex items-center gap-2">
          <span className="w-6 h-0.5 bg-white/60 inline-block"></span>
          <span className="text-gray-500">Your connections</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="w-6 h-1 bg-red-500 inline-block rounded"></span>
          <span className="text-gray-500">Mutual (linked)</span>
        </span>
        <span className="text-gray-600">|</span>
        <span className="text-gray-500">Thickness = interaction density</span>
        <span className="text-gray-500">Brightness = recency</span>
        <span className="text-gray-500">Node size = # connections</span>
        <span className="text-gray-500">Dbl-click = re-center · Click = dossier</span>
      </div>

      {/* Graph */}
      <div ref={containerRef} className="flex-1 relative">
        <svg ref={svgRef} className="w-full h-full" />

        {/* Tooltip */}
        {hoveredNode && (
          <div
            className="fixed z-50 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 pointer-events-none shadow-lg max-w-xs"
            style={{ left: tooltipPos.x + 14, top: tooltipPos.y - 12 }}
          >
            {hoveredNode.type === "self" ? (
              <>
                <p className="text-sm font-medium text-blue-300">{hoveredNode.fullName || hoveredNode.label}</p>
                {hoveredNode.jobTitle && <p className="text-xs text-gray-400">{hoveredNode.jobTitle}</p>}
                {hoveredNode.company && <p className="text-xs text-gray-500">{hoveredNode.company}</p>}
              </>
            ) : hoveredNode.type === "connected_user" ? (
              <>
                <p className="text-sm font-medium text-red-300">{hoveredNode.fullName || hoveredNode.label}</p>
                {hoveredNode.jobTitle && <p className="text-xs text-gray-400">{hoveredNode.jobTitle}</p>}
                {hoveredNode.company && <p className="text-xs text-gray-500">{hoveredNode.company}</p>}
              </>
            ) : hoveredNode.type === "their_contact" ? (
              <>
                {hoveredNode.jobTitle && <p className="text-sm font-medium text-gray-300">{hoveredNode.jobTitle}</p>}
                {hoveredNode.company && <p className="text-xs text-gray-400">{hoveredNode.company}</p>}
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-200">{hoveredNode.fullName || hoveredNode.label}</p>
                {hoveredNode.jobTitle && <p className="text-xs text-gray-400">{hoveredNode.jobTitle}</p>}
                {hoveredNode.company && <p className="text-xs text-gray-500">{hoveredNode.company}</p>}
              </>
            )}
          </div>
        )}

        {graphData.nodes.length <= 1 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-gray-400 mb-2">No contacts yet</p>
              <button
                onClick={() => router.push("/contacts")}
                className="text-blue-400 hover:text-blue-300 text-sm underline"
              >
                Add your first contact →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
