"use client";

import { useEffect, useRef, useState, useCallback } from "react";
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
  owner_id: string;
}

interface Connection {
  id: string;
  inviter_id: string;
  invitee_id: string;
  invite_code: string;
  status: string;
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
  relationship_type?: string;
  company?: string;
  role?: string;
  owner_id?: string;
  user_id?: string; // for connected users
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  distance: number;
  thickness: number;
  recency: number; // 0-1, 1 = most recent
  isMutual: boolean; // red if mutual connection
  isOwn: boolean; // black if own connection
}

// Relationship type → closeness (lower = closer)
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
    // Red with recency-based intensity
    const alpha = 0.2 + recency * 0.8;
    return `rgba(220, 38, 38, ${alpha})`;
  }
  // Black with recency-based intensity
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

export default function NetworkPage() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [centeredNodeId, setCenteredNodeId] = useState<string>("self");
  const [graphData, setGraphData] = useState<{
    nodes: GraphNode[];
    links: GraphLink[];
  }>({ nodes: [], links: [] });
  const router = useRouter();

  // Fetch all data
  useEffect(() => {
    async function fetchAll() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      // Fetch in parallel: my contacts, my connections, interactions
      const [contactsRes, connectionsRes, interactionsRes, profileRes] = await Promise.all([
        supabase.from("contacts").select("*"),
        supabase.from("connections").select("*").eq("status", "accepted"),
        supabase.from("interactions").select("contact_id, interaction_date"),
        supabase.from("profiles").select("full_name").eq("id", user.id).single(),
      ]);

      const allContacts: Contact[] = contactsRes.data || [];
      const myContacts = allContacts.filter(c => c.owner_id === user.id);
      const connections: Connection[] = connectionsRes.data || [];
      const allInteractions = interactionsRes.data || [];

      // Build interaction stats per contact
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

      // Find mutual connections (connected users)
      const mutualUserIds = new Set<string>();
      const connectionPairs: { myId: string; theirId: string }[] = [];
      for (const conn of connections) {
        if (conn.inviter_id === user.id) {
          mutualUserIds.add(conn.invitee_id);
          connectionPairs.push({ myId: user.id, theirId: conn.invitee_id });
        } else if (conn.invitee_id === user.id) {
          mutualUserIds.add(conn.inviter_id);
          connectionPairs.push({ myId: user.id, theirId: conn.inviter_id });
        }
      }

      // Get connected users' profiles
      const connectedProfiles: Record<string, string> = {};
      if (mutualUserIds.size > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", Array.from(mutualUserIds));
        for (const p of profiles || []) {
          connectedProfiles[p.id] = p.full_name || "Unknown";
        }
      }

      // Get connected users' contacts (we only show initials + title)
      const theirContacts = allContacts.filter(c => mutualUserIds.has(c.owner_id) && c.owner_id !== user.id);

      // Count connections per contact (how many people know this contact)
      const contactConnectionCount: Record<string, number> = {};
      for (const c of allContacts) {
        contactConnectionCount[c.id] = (contactConnectionCount[c.id] || 0) + 1;
      }

      // BUILD GRAPH

      const nodes: GraphNode[] = [];
      const links: GraphLink[] = [];

      // 1. Self node
      const myName = profileRes.data?.full_name || "You";
      nodes.push({
        id: "self",
        label: myName,
        type: "self",
        radius: nodeSizeFromConnections(myContacts.length + mutualUserIds.size, "self"),
        connectionCount: myContacts.length + mutualUserIds.size,
        user_id: user.id,
      });

      // 2. My contacts
      for (const c of myContacts) {
        const stats = interactionMap[c.id];
        const connCount = contactConnectionCount[c.id] || 1;

        nodes.push({
          id: c.id,
          label: c.full_name || `${c.first_name} ${c.last_name}`,
          type: "contact",
          radius: nodeSizeFromConnections(connCount, "contact"),
          connectionCount: connCount,
          relationship_type: c.relationship_type,
          company: c.company ?? undefined,
          role: c.role ?? undefined,
          owner_id: c.owner_id,
        });

        // Check if this contact is also a connected user (mutual)
        const isMutual = false; // contacts aren't users, but we could link them later

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

      // 3. Connected users (mutual connections via invite code)
      for (const uid of mutualUserIds) {
        const name = connectedProfiles[uid] || "Connected User";
        const theirContactCount = theirContacts.filter(c => c.owner_id === uid).length;

        nodes.push({
          id: `user-${uid}`,
          label: name,
          type: "connected_user",
          radius: nodeSizeFromConnections(theirContactCount, "connected_user"),
          connectionCount: theirContactCount,
          user_id: uid,
        });

        // Bold red link between self and connected user
        links.push({
          source: "self",
          target: `user-${uid}`,
          distance: 120,
          thickness: 4,
          recency: 1,
          isMutual: true,
          isOwn: false,
        });
      }

      // 4. Their contacts (initials + job title only)
      for (const c of theirContacts) {
        const initials = `${(c.first_name || "?")[0]}${(c.last_name || "?")[0]}`.toUpperCase();
        const stats = interactionMap[c.id];
        const connCount = contactConnectionCount[c.id] || 1;

        // Check if this contact is also one of mine (shared contact)
        const isShared = myContacts.some(mc =>
          mc.first_name === c.first_name && mc.last_name === c.last_name
        );

        nodes.push({
          id: `their-${c.id}`,
          label: initials,
          type: "their_contact",
          radius: nodeSizeFromConnections(connCount, "their_contact"),
          connectionCount: connCount,
          role: c.role ?? undefined,
          owner_id: c.owner_id,
        });

        links.push({
          source: `user-${c.owner_id}`,
          target: `their-${c.id}`,
          distance: CLOSENESS[c.relationship_type] || 230,
          thickness: thicknessFromCount(stats?.count || 0),
          recency: computeRecency(stats?.most_recent || null),
          isMutual: isShared,
          isOwn: false,
        });
      }

      setGraphData({ nodes, links });
      setLoading(false);
    }

    fetchAll();
  }, [router]);

  // Render D3 graph
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

    // Zoom
    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.2, 4])
        .on("zoom", (event) => {
          g.attr("transform", event.transform);
        }) as any
    );

    // Deep clone nodes/links for D3 mutation
    const nodes: GraphNode[] = graphData.nodes.map(n => ({ ...n }));
    const links: GraphLink[] = graphData.links.map(l => ({
      ...l,
      source: typeof l.source === 'object' ? (l.source as GraphNode).id : l.source,
      target: typeof l.target === 'object' ? (l.target as GraphNode).id : l.target,
    }));

    // Pin centered node
    const centeredNode = nodes.find(n => n.id === centeredNodeId);
    if (centeredNode) {
      centeredNode.fx = width / 2;
      centeredNode.fy = height / 2;
    }

    // Force simulation
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
      .on("dblclick", (event, d) => {
        event.preventDefault();
        // Re-center on this node
        // Unpin all nodes first
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

    // Node circles
    node
      .append("circle")
      .attr("r", d => d.radius)
      .attr("fill", d => {
        switch (d.type) {
          case "self": return "#3b82f6";
          case "connected_user": return "#ef4444";
          case "contact": return "#64748b";
          case "their_contact": return "#475569";
          default: return "#64748b";
        }
      })
      .attr("stroke", d => {
        switch (d.type) {
          case "self": return "#60a5fa";
          case "connected_user": return "#f87171";
          case "contact": return "#94a3b8";
          case "their_contact": return "#64748b";
          default: return "#94a3b8";
        }
      })
      .attr("stroke-width", d => d.type === "self" || d.type === "connected_user" ? 2.5 : 1.5);

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
        if (d.type === "connected_user") return "#fca5a5";
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
  }, [graphData, loading, centeredNodeId]);

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
        <div className="flex gap-4 text-sm text-gray-500">
          <span>{totalContacts} contacts</span>
          <span>{totalConnected} linked</span>
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
        <span className="text-gray-500">Line length = closeness</span>
        <span className="text-gray-500">Thickness = interaction density</span>
        <span className="text-gray-500">Brightness = recency</span>
        <span className="text-gray-500">Node size = # connections</span>
        <span className="text-gray-500">Double-click = re-center</span>
      </div>

      {/* Graph */}
      <div ref={containerRef} className="flex-1 relative">
        <svg ref={svgRef} className="w-full h-full" />

        {/* Tooltip */}
        {hoveredNode && (
          <div
            className="fixed z-50 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 pointer-events-none shadow-lg max-w-xs"
            style={{
              left: tooltipPos.x + 14,
              top: tooltipPos.y - 12,
            }}
          >
            {hoveredNode.type === "self" ? (
              <p className="text-sm font-medium text-blue-300">{hoveredNode.label}</p>
            ) : hoveredNode.type === "connected_user" ? (
              <>
                <p className="text-sm font-medium text-red-300">{hoveredNode.label}</p>
                <p className="text-xs text-gray-400">Linked user · {hoveredNode.connectionCount} contacts</p>
              </>
            ) : hoveredNode.type === "their_contact" ? (
              <>
                <p className="text-sm font-medium text-gray-300">{hoveredNode.label}</p>
                {hoveredNode.role && (
                  <p className="text-xs text-gray-400">{hoveredNode.role}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">Contact of a linked user</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-200">{hoveredNode.label}</p>
                {hoveredNode.role && hoveredNode.company && (
                  <p className="text-xs text-gray-400">{hoveredNode.role} at {hoveredNode.company}</p>
                )}
                {hoveredNode.relationship_type && (
                  <p className="text-xs text-gray-500 mt-1">{hoveredNode.relationship_type}</p>
                )}
                <p className="text-xs text-gray-600">{hoveredNode.connectionCount} connections</p>
              </>
            )}
          </div>
        )}

        {/* Empty state */}
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
