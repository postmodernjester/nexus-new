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

function getJobTitle(contact: any): string {
  return contact.job_title || contact.role || "";
}

function matchesFilter(contact: any, term: string): boolean {
  if (!term) return true;
  const lower = term.toLowerCase();
  const fields = [
    contact.first_name,
    contact.last_name,
    contact.full_name,
    contact.job_title,
    contact.role,
    contact.company,
    contact.location,
    contact.email,
    contact.phone,
    contact.notes,
    contact.skills,
    contact.education,
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
  const [graphData, setGraphData] = useState<{
    nodes: GraphNode[];
    links: GraphLink[];
  }>({ nodes: [], links: [] });
  const router = useRouter();

  useEffect(() => {
    async function fetchAll() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      const user = session.user;

      const [contactsRes, connectionsRes, interactionsRes, profileRes] = await Promise.all([
        supabase.from("contacts").select("*"),
        supabase.from("connections").select("*").eq("status", "accepted"),
        supabase.from("interactions").select("contact_id, interaction_date"),
        supabase.from("profiles").select("full_name, job_title, company").eq("id", user.id).single(),
      ]);

      setAllData({
        user,
        allContacts: contactsRes.data || [],
        connections: connectionsRes.data || [],
        allInteractions: interactionsRes.data || [],
        myProfile: profileRes.data,
      });
      setLoading(false);
    }
    fetchAll();
  }, [router]);

  useEffect(() => {
    if (!allData) return;

    const { user, allContacts, connections, allInteractions, myProfile } = allData;
    const myContacts = allContacts.filter((c: Contact) => c.owner_id === user.id);

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

    const mutualUserIds: string[] = [];
    const contactIdToUserId: Record<string, string> = {};
    for (const conn of connections) {
      if (conn.inviter_id === user.id) {
        mutualUserIds.push(conn.invitee_id);
      } else if (conn.invitee_id === user.id) {
        mutualUserIds.push(conn.inviter_id);
      }
      if (conn.contact_id) {
        const otherId = conn.inviter_id === user.id ? conn.invitee_id : conn.inviter_id;
        contactIdToUserId[conn.contact_id] = otherId;
      }
    }

    const theirContacts = allContacts.filter((c: Contact) =>
      mutualUserIds.includes(c.owner_id) && c.owner_id !== user.id
    );

    const contactConnectionCount: Record<string, number> = {};
    for (const c of allContacts) {
      contactConnectionCount[c.id] = (contactConnectionCount[c.id] || 0) + 1;
    }

    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];

    // 1. Self node
    const myName = myProfile?.full_name || "You";
    nodes.push({
      id: "self",
      label: myName,
      type: "self",
      radius: nodeSizeFromConnections(myContacts.length + mutualUserIds.length, "self"),
      connectionCount: myContacts.length + mutualUserIds.length,
      jobTitle: myProfile?.job_title,
      company: myProfile?.company,
      user_id: user.id,
    });

    // 2. My contacts — label = "J. Smith", hover = job title + company
    for (const c of myContacts) {
      if (contactIdToUserId[c.id]) continue;
      if (!matchesFilter(c, filter)) continue;

      const stats = interactionMap[c.id];
      const connCount = contactConnectionCount[c.id] || 1;

      const firstName = c.first_name || "";
      const lastName = c.last_name || "";
      const initial = firstName.charAt(0).toUpperCase();
      const displayName = lastName ? `${initial}. ${lastName}` : firstName || "?";

      nodes.push({
        id: c.id,
        label: displayName,
        type: "contact",
        radius: nodeSizeFromConnections(connCount, "contact"),
        connectionCount: connCount,
        company: c.company ?? undefined,
        jobTitle: getJobTitle(c),
        fullName: c.full_name || `${c.first_name} ${c.last_name}`,
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

    // 3. Connected users
    for (const uid of mutualUserIds) {
      const linkedContactId = Object.entries(contactIdToUserId).find(([_, v]) => v === uid)?.[0];
      const linkedContact = linkedContactId ? myContacts.find((c: Contact) => c.id === linkedContactId) : null;

      const firstName = linkedContact?.first_name || "";
      const lastName = linkedContact?.last_name || "";
      const initial = firstName.charAt(0).toUpperCase();
      const name = lastName ? `${initial}. ${lastName}` : (linkedContact?.full_name || "Connected User");

      if (filter && linkedContact && !matchesFilter(linkedContact, filter)) continue;

      const theirContactCount = theirContacts.filter((c: Contact) => c.owner_id === uid).length;

      nodes.push({
        id: `user-${uid}`,
        label: name,
        type: "connected_user",
        radius: nodeSizeFromConnections(theirContactCount, "connected_user"),
        connectionCount: theirContactCount,
        jobTitle: getJobTitle(linkedContact || {}),
        company: linkedContact?.company ?? undefined,
        fullName: linkedContact?.full_name || `${firstName} ${lastName}`,
        user_id: uid,
        contactId: linkedContactId,
      });

      links.push({
        source: "self",
        target: `user-${uid}`,
        distance: 120,
        thickness: 4,
        recency: 1,
        isMutual: true,
        isOwn: false,
      });

      // 4. Their contacts — label = job title only
      for (const tc of theirContacts.filter((c: Contact) => c.owner_id === uid)) {
        if (filter && !matchesFilter(tc, filter)) continue;

        const stats = interactionMap[tc.id];
        const connCount = contactConnectionCount[tc.id] || 1;
        const displayLabel = getJobTitle(tc) || "Contact";

        const isShared = myContacts.some((mc: Contact) =>
          mc.first_name === tc.first_name && mc.last_name === tc.last_name
        );

        nodes.push({
          id: `their-${tc.id}`,
          label: displayLabel,
          type: "their_contact",
          radius: nodeSizeFromConnections(connCount, "their_contact"),
          connectionCount: connCount,
          jobTitle: getJobTitle(tc),
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
      source: typeof l.source === 'object' ? (l.source as GraphNode).id : l.source,
      target: typeof l.target === 'object' ? (l.target as GraphNode).id : l.target,
    }));

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

    const link = g
      .append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", d => lineColor(d.isOwn, d.isMutual, d.recency))
      .attr("stroke-width", d => d.thickness)
      .attr("stroke-linecap", "round");

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

    node
      .append("circle")
      .attr("r", d => d.radius)
      .attr("fill", d => {
        switch (d.type) {
          case "self": return "#6B7F8E";
          case "connected_user": return "#8E6B6B";
          case "contact": return "#7A8A96";
          case "their_contact": return "#5C6A73";
          default: return "#7A8A96";
        }
      })
      .attr("stroke", "none");

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
        <span className="text-gray-500">Double-click = re-center · Click = open dossier</span>
      </div>

      <div ref={containerRef} className="flex-1 relative">
        <svg ref={svgRef} className="w-full h-full" />

        {hoveredNode && (
          <div
            className="fixed z-50 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 pointer-events-none shadow-lg max-w-xs"
            style={{
              left: tooltipPos.x + 14,
              top: tooltipPos.y - 12,
            }}
          >
            {hoveredNode.type === "self" ? (
              <>
                <p className="text-sm font-medium text-blue-300">{hoveredNode.label}</p>
                {hoveredNode.jobTitle && (
                  <p className="text-xs text-gray-400">{hoveredNode.jobTitle}</p>
                )}
                {hoveredNode.company && (
                  <p className="text-xs text-gray-500">{hoveredNode.company}</p>
                )}
              </>
            ) : hoveredNode.type === "connected_user" ? (
              <>
                <p className="text-sm font-medium text-red-300">{hoveredNode.fullName || hoveredNode.label}</p>
                {hoveredNode.jobTitle && (
                  <p className="text-xs text-gray-400">{hoveredNode.jobTitle}</p>
                )}
                {hoveredNode.company && (
                  <p className="text-xs text-gray-500">{hoveredNode.company}</p>
                )}
              </>
            ) : hoveredNode.type === "their_contact" ? (
              <>
                {hoveredNode.jobTitle && (
                  <p className="text-sm font-medium text-gray-300">{hoveredNode.jobTitle}</p>
                )}
                {hoveredNode.company && (
                  <p className="text-xs text-gray-400">{hoveredNode.company}</p>
                )}
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-200">{hoveredNode.fullName || hoveredNode.label}</p>
                {hoveredNode.jobTitle && (
                  <p className="text-xs text-gray-400">{hoveredNode.jobTitle}</p>
                )}
                {hoveredNode.company && (
                  <p className="text-xs text-gray-500">{hoveredNode.company}</p>
                )}
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
