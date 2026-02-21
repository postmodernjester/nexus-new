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
  isAnonymous?: boolean;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  distance: number;
  thickness: number;
  recency: number;
  isMutual: boolean;
  isLinkedUser: boolean;
  isSecondDegree?: boolean;
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
  if (!mostRecent) return 0.1;
  const daysSince =
    (Date.now() - new Date(mostRecent).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince <= 1) return 1;
  if (daysSince <= 7) return 0.9;
  if (daysSince <= 14) return 0.75;
  if (daysSince <= 30) return 0.6;
  if (daysSince <= 90) return 0.45;
  if (daysSince <= 180) return 0.3;
  if (daysSince <= 365) return 0.2;
  return 0.1;
}

function lineColor(
  _isMutual: boolean,
  _isLinkedUser: boolean,
  recency: number,
  isSecondDegree?: boolean
): string {
  // 2nd degree links: uniform grey
  if (isSecondDegree) {
    return "rgba(148, 163, 184, 0.35)";
  }
  // 1st degree: muted slate, alpha based on recency
  const alpha = 0.45 + recency * 0.55;
  return `rgba(148, 163, 184, ${alpha})`;
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
          supabase.from("contact_notes").select("contact_id, entry_date"),
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
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, headline, anonymous_beyond_first_degree")
          .in("id", Array.from(mutualUserIds));
        for (const p of profiles || []) {
          connectedProfiles[p.id] = {
            full_name: p.full_name || "Unknown",
            headline: p.headline || "",
            anonymous_beyond_first_degree: p.anonymous_beyond_first_degree || false,
          };
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
      });
      profileToNodeId[user.id] = "self";
      nameToNodeId[myName.toLowerCase()] = "self";

      // ② Connected users (linked via connections table) — "F. LastName" format
      for (const uid of Array.from(mutualUserIds)) {
        const profile = connectedProfiles[uid];
        const myCard = myContactsLinkedToConnectedUser.get(uid);
        const name = myCard?.full_name || profile?.full_name || "Connected User";
        const theirCount = theirContacts.filter(
          (c) => c.owner_id === uid
        ).length;
        const nodeId = `user-${uid}`;

        const stats = myCard ? noteMap[myCard.id] : null;
        const relType = myCard?.relationship_type || "Acquaintance";

        nodes.push({
          id: nodeId,
          label: name,
          fullName: name,
          type: "connected_user",
          radius: nodeSize(theirCount + 1),
          connectionCount: theirCount + 1,
          user_id: uid,
          profileId: uid,
          relationship_type: relType,
          company: myCard?.company ?? undefined,
          role: myCard?.role ?? undefined,
        });

        profileToNodeId[uid] = nodeId;
        nameToNodeId[name.toLowerCase()] = nodeId;

        const dist = CLOSENESS[relType] || 200;
        const thick = lineThickness(stats?.count || 0);
        const rec = computeRecency(
          stats?.most_recent || myCard?.last_contact_date || null
        );

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
        nodes.push({
          id: nodeId,
          label: c.full_name,
          fullName: c.full_name,
          type: "contact",
          radius: nodeSize(1),
          connectionCount: 1,
          relationship_type: relType,
          company: c.company ?? undefined,
          role: c.role ?? undefined,
          owner_id: c.owner_id,
        });

        nameToNodeId[c.full_name.toLowerCase()] = nodeId;
        if (c.linked_profile_id) {
          profileToNodeId[c.linked_profile_id] = nodeId;
        }

        const dist = CLOSENESS[relType] || 200;
        const thick = lineThickness(stats?.count || 0);
        const rec = computeRecency(
          stats?.most_recent || c.last_contact_date || null
        );

        links.push({
          source: "self",
          target: nodeId,
          distance: dist,
          thickness: thick,
          recency: rec,
          isMutual: false,
          isLinkedUser: false,
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
            links.push({
              source: ownerNodeId,
              target: existingNodeId,
              distance: 180,
              thickness: 1,
              recency: 0.3,
              isMutual: true,
              isLinkedUser: false,
              isSecondDegree: true,
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
        // 2nd degree: show job title only, no name
        const jobLabel = tc.role || tc.company || "";

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
        });

        if (tc.linked_profile_id) profileToNodeId[tc.linked_profile_id] = nodeId;
        nameToNodeId[tc.full_name.toLowerCase()] = nodeId;

        links.push({
          source: ownerNodeId,
          target: nodeId,
          distance: 160,
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
    zoomRef.current = zoom;

    const simulation = d3
      .forceSimulation<GraphNode>(graphData.nodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphLink>(graphData.links)
          .id((d) => d.id)
          .distance((d) => d.distance)
      )
      .force("charge", d3.forceManyBody().strength(-120))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collision",
        d3.forceCollide<GraphNode>().radius((d) => d.radius + 4)
      );

    simulationRef.current = simulation;

    // Links
    const link = g
      .append("g")
      .selectAll<SVGLineElement, GraphLink>("line")
      .data(graphData.links)
      .join("line")
      .attr("stroke", (d) => lineColor(d.isMutual, d.isLinkedUser, d.recency, d.isSecondDegree))
      .attr("stroke-width", (d) => d.thickness)
      .attr("stroke-linecap", "round");

    // Node groups
    const node = g
      .append("g")
      .selectAll<SVGGElement, GraphNode>("g")
      .data(graphData.nodes)
      .join("g")
      .style("cursor", "pointer");

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

    // Double-click to re-center
    node.on("dblclick", function (event, d) {
      event.stopPropagation();
      const x = d.x || width / 2;
      const y = d.y || height / 2;
      svg
        .transition()
        .duration(500)
        .call(
          zoom.transform,
          d3.zoomIdentity
            .translate(width / 2, height / 2)
            .scale(1.5)
            .translate(-x, -y)
        );
    });

    // Drag
    const drag = d3
      .drag<SVGGElement, GraphNode>()
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
        d.fx = null;
        d.fy = null;
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

    // Filter highlight
    if (filterText.trim()) {
      const q = filterText.toLowerCase();
      node.attr("opacity", (d) =>
        d.fullName.toLowerCase().includes(q) ? 1 : 0.15
      );
      link.attr("opacity", 0.05);
    } else {
      node.attr("opacity", 1);
      link.attr("opacity", 1);
    }

    return () => {
      simulation.stop();
    };
  }, [loading, graphData, filterText]);

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
          placeholder="Filter by name…"
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
          Double-click a node to re-center
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
                {/* 2nd degree: no name, just job title */}
                {hoveredNode.role && (
                  <div style={{ fontWeight: 600, fontSize: "13px", color: "#e2e8f0" }}>
                    {hoveredNode.role}
                  </div>
                )}
                {hoveredNode.company && (
                  <div style={{ color: "#94a3b8", fontSize: "12px", marginTop: "2px" }}>
                    {hoveredNode.company}
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
                {hoveredNode.relationship_type && (
                  <div style={{ color: "#64748b", fontSize: "11px", marginTop: "4px" }}>
                    {hoveredNode.relationship_type}
                  </div>
                )}
                <div style={{ color: "#475569", fontSize: "11px", marginTop: "4px" }}>
                  {hoveredNode.connectionCount} connection{hoveredNode.connectionCount !== 1 ? "s" : ""}
                  {hoveredNode.type === "connected_user" && " · NEXUS user"}
                </div>
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
