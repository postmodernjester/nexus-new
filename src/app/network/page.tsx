"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import * as d3 from "d3";

interface Contact {
  id: string;
  full_name: string;
  relationship_type: string;
  company: string | null;
  role: string | null;
  owner_id: string;
  linked_profile_id: string | null;
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
  user_id?: string;
  profileId?: string;
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
  "Business Contact": 190,
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

export default function NetworkPage() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [centeredNodeId, setCenteredNodeId] = useState<string>("self");
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

      const [contactsRes, connectionsRes, interactionsRes, profileRes] =
        await Promise.all([
          supabase.from("contacts").select("*"),
          supabase.from("connections").select("*").eq("status", "accepted"),
          supabase.from("interactions").select("contact_id, interaction_date"),
          supabase
            .from("profiles")
            .select("full_name, headline")
            .eq("id", user.id)
            .single(),
        ]);

      const allContacts: Contact[] = contactsRes.data || [];
      const myContacts = allContacts.filter((c) => c.owner_id === user.id);
      const connections: Connection[] = connectionsRes.data || [];
      const allInteractions = interactionsRes.data || [];

      // Build interaction stats per contact
      const interactionMap: Record<string, InteractionStats> = {};
      for (const i of allInteractions) {
        if (!interactionMap[i.contact_id]) {
          interactionMap[i.contact_id] = {
            contact_id: i.contact_id,
            count: 0,
            most_recent: i.interaction_date,
          };
        }
        interactionMap[i.contact_id].count++;
        if (i.interaction_date > interactionMap[i.contact_id].most_recent) {
          interactionMap[i.contact_id].most_recent = i.interaction_date;
        }
      }

      // Find connected user IDs from connections table
      const mutualUserIds = new Set<string>();
      for (const conn of connections) {
        if (conn.inviter_id === user.id) {
          mutualUserIds.add(conn.invitee_id);
        } else if (conn.invitee_id === user.id) {
          mutualUserIds.add(conn.inviter_id);
        }
      }

      // Get connected users' profiles
      const connectedProfiles: Record<
        string,
        { full_name: string; headline: string }
      > = {};
      if (mutualUserIds.size > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, headline")
          .in("id", Array.from(mutualUserIds));
        for (const p of profiles || []) {
          connectedProfiles[p.id] = {
            full_name: p.full_name || "Unknown",
            headline: p.headline || "",
          };
        }
      }

      // Get their contacts (other users' contacts)
      const theirContacts = allContacts.filter(
        (c) => mutualUserIds.has(c.owner_id) && c.owner_id !== user.id
      );

      // ========== DEDUP LOGIC ==========
      // 1. If my contact has linked_profile_id matching a connected user,
      //    show ONE node (connected_user) — skip the contact node.
      // 2. If a connected user has a contact with linked_profile_id === MY id,
      //    skip it — I'm already the "self" node.
      // 3. If both I and a connected user know the same person
      //    (same linked_profile_id or same full_name), show ONE node
      //    with links from both of us.

      const profileToNodeId: Record<string, string> = {};
      const nameToNodeId: Record<string, string> = {};

      // Which of my contacts are actually connected users?
      const myContactsLinkedToConnectedUser = new Set<string>();
      for (const c of myContacts) {
        if (c.linked_profile_id && mutualUserIds.has(c.linked_profile_id)) {
          myContactsLinkedToConnectedUser.add(c.id);
        }
      }

      const nodes: GraphNode[] = [];
      const links: GraphLink[] = [];

      // 1. Self node
      const myName = profileRes.data?.full_name || "You";
      nodes.push({
        id: "self",
        label: myName,
        type: "self",
        radius: 16,
        connectionCount: myContacts.length + mutualUserIds.size,
        user_id: user.id,
        profileId: user.id,
      });
      profileToNodeId[user.id] = "self";
      nameToNodeId[myName.toLowerCase()] = "self";

      // 2. Connected users
      for (const uid of Array.from(mutualUserIds)) {
        const profile = connectedProfiles[uid];
        const name = profile?.full_name || "Connected User";
        const theirContactCount = theirContacts.filter(
          (c) => c.owner_id === uid
        ).length;
        const nodeId = `user-${uid}`;

        nodes.push({
          id: nodeId,
          label: name,
          type: "connected_user",
          radius: nodeSizeFromConnections(theirContactCount, "connected_user"),
          connectionCount: theirContactCount,
          user_id: uid,
          profileId: uid,
        });

        profileToNodeId[uid] = nodeId;
        nameToNodeId[name.toLowerCase()] = nodeId;

        links.push({
          source: "self",
          target: nodeId,
          distance: 120,
          thickness: 4,
          recency: 1,
          isMutual: true,
          isOwn: false,
        });
      }

      // 3. My contacts — SKIP if linked to a connected user (dedup)
      for (const c of myContacts) {
        if (myContactsLinkedToConnectedUser.has(c.id)) {
          continue;
        }

        const stats = interactionMap[c.id];
        const nodeId = c.id;

        nodes.push({
          id: nodeId,
          label: c.full_name || "Unknown",
          type: "contact",
          radius: nodeSizeFromConnections(1, "contact"),
          connectionCount: 1,
          relationship_type: c.relationship_type,
          company: c.company ?? undefined,
          role: c.role ?? undefined,
          owner_id: c.owner_id,
          profileId: c.linked_profile_id ?? undefined,
        });

        if (c.linked_profile_id) {
          profileToNodeId[c.linked_profile_id] = nodeId;
        }
        nameToNodeId[(c.full_name || "").toLowerCase()] = nodeId;

        links.push({
          source: "self",
          target: nodeId,
          distance: CLOSENESS[c.relationship_type] || 230,
          thickness: thicknessFromCount(stats?.count || 0),
          recency: computeRecency(stats?.most_recent || null),
          isMutual: false,
          isOwn: true,
        });
      }

      // 4. Their contacts — dedup against existing nodes
      for (const c of theirContacts) {
        // Skip if this contact is ME
        if (c.linked_profile_id === user.id) continue;

        // Check if node already exists for this person
        let existingNodeId: string | null = null;

        if (c.linked_profile_id && profileToNodeId[c.linked_profile_id]) {
          existingNodeId = profileToNodeId[c.linked_profile_id];
        }
        if (!existingNodeId) {
          const nameKey = (c.full_name || "").toLowerCase();
          if (nameToNodeId[nameKey]) {
            existingNodeId = nameToNodeId[nameKey];
          }
        }

        if (existingNodeId) {
          // Shared contact — add link from their owner, no new node
          const ownerNodeId = `user-${c.owner_id}`;
          const linkExists = links.some(
            (l) =>
              (l.source === ownerNodeId && l.target === existingNodeId) ||
              (l.source === existingNodeId && l.target === ownerNodeId)
          );
          if (!linkExists) {
            const stats = interactionMap[c.id];
            links.push({
              source: ownerNodeId,
              target: existingNodeId,
              distance: CLOSENESS[c.relationship_type] || 230,
              thickness: thicknessFromCount(stats?.count || 0),
              recency: computeRecency(stats?.most_recent || null),
              isMutual: true,
              isOwn: false,
            });
          }
          const existingNode = nodes.find((n) => n.id === existingNodeId);
          if (existingNode) {
            existingNode.connectionCount++;
            existingNode.radius = nodeSizeFromConnections(
              existingNode.connectionCount,
              existingNode.type
            );
          }
          continue;
        }

        // New 2nd-degree node
        const nameParts = (c.full_name || "??").split(" ");
        const firstInitial = (nameParts[0] || "?")[0];
        const lastInitial =
          nameParts.length > 1
            ? (nameParts[nameParts.length - 1] || "?")[0]
            : "?";
        const initials = `${firstInitial}${lastInitial}`.toUpperCase();
        const stats = interactionMap[c.id];
        const nodeId = `their-${c.id}`;

        nodes.push({
          id: nodeId,
          label: initials,
          type: "their_contact",
          radius: nodeSizeFromConnections(1, "their_contact"),
          connectionCount: 1,
          company: c.company ?? undefined,
          role: c.role ?? undefined,
          owner_id: c.owner_id,
          profileId: c.linked_profile_id ?? undefined,
        });

        if (c.linked_profile_id) {
          profileToNodeId[c.linked_profile_id] = nodeId;
        }
        nameToNodeId[(c.full_name || "").toLowerCase()] = nodeId;

        links.push({
          source: `user-${c.owner_id}`,
          target: nodeId,
          distance: CLOSENESS[c.relationship_type] || 230,
          thickness: thicknessFromCount(stats?.count || 0),
          recency: computeRecency(stats?.most_recent || null),
          isMutual: false,
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

    const svgElement = svgRef.current;
    if (svgElement) {
      d3.select(svgElement).call(
        d3
          .zoom<SVGSVGElement, unknown>()
          .scaleExtent([0.2, 4])
          .on("zoom", (event) => {
            g.attr("transform", event.transform);
          })
      );
    }

    const nodes: GraphNode[] = graphData.nodes.map((n) => ({ ...n }));
    const links: GraphLink[] = graphData.links.map((l) => ({
      ...l,
      source:
        typeof l.source === "object" ? (l.source as GraphNode).id : l.source,
      target:
        typeof l.target === "object" ? (l.target as GraphNode).id : l.target,
    }));

    const centerNode = nodes.find((n) => n.id === centeredNodeId);
    if (centerNode) {
      centerNode.fx = width / 2;
      centerNode.fy = height / 2;
    }

    const simulation = d3
      .forceSimulation<GraphNode>(nodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance((d) => d.distance)
          .strength(0.3)
      )
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2).strength(0.05))
      .force(
        "collision",
        d3.forceCollide<GraphNode>().radius((d) => d.radius + 4)
      );

    simulationRef.current = simulation;

    const linkGroup = g
      .selectAll<SVGLineElement, GraphLink>("line")
      .data(links)
      .enter()
      .append("line")
      .attr("stroke", (d) => lineColor(d.isOwn, d.isMutual, d.recency))
      .attr("stroke-width", (d) => d.thickness)
      .attr("stroke-linecap", "round");

    const nodeGroup = g
      .selectAll<SVGGElement, GraphNode>("g.node")
      .data(nodes)
      .enter()
      .append("g")
      .attr("class", "node")
      .style("cursor", "pointer");

    // Node circles — no border
    nodeGroup
      .append("circle")
      .attr("r", (d) => d.radius)
      .attr("fill", (d) => {
        if (d.type === "self") return "#a78bfa";
        if (d.type === "connected_user") return "#60a5fa";
        if (d.type === "their_contact") return "#475569";
        const colors: Record<string, string> = {
          Family: "#7c6f64",
          "Close Friend": "#6b7280",
          Friend: "#6b7280",
          Colleague: "#64748b",
          Business: "#64748b",
          "Business Contact": "#64748b",
          Acquaintance: "#4b5563",
          Stranger: "#374151",
        };
        return colors[d.relationship_type || ""] || "#4b5563";
      })
      .attr("stroke", "none")
      .attr("stroke-width", 0);

    // Node labels
    nodeGroup
      .append("text")
      .text((d) => {
        if (d.type === "self") return d.label;
        if (d.type === "connected_user") return d.label;
        if (d.type === "their_contact") {
          const company = d.company || d.role || "";
          return company ? `${d.label} @ ${company}` : d.label;
        }
        const parts = d.label.split(" ");
        if (parts.length > 1)
          return `${parts[0][0]}. ${parts[parts.length - 1]}`;
        return d.label;
      })
      .attr("text-anchor", "middle")
      .attr("dy", (d) => d.radius + 14)
      .attr("fill", (d) =>
        d.type === "their_contact" ? "#64748b" : "#94a3b8"
      )
      .attr("font-size", (d) =>
        d.type === "self"
          ? "13px"
          : d.type === "their_contact"
            ? "10px"
            : "11px"
      )
      .attr("font-weight", (d) => (d.type === "self" ? "bold" : "normal"))
      .attr("pointer-events", "none");

    // Hover + click
    nodeGroup
      .on("mouseover", function (event, d) {
        setHoveredNode(d);
        setTooltipPos({ x: event.pageX, y: event.pageY });
        d3.select(this)
          .select("circle")
          .attr("stroke", "#fff")
          .attr("stroke-width", 2);
      })
      .on("mouseout", function () {
        setHoveredNode(null);
        d3.select(this)
          .select("circle")
          .attr("stroke", "none")
          .attr("stroke-width", 0);
      })
      .on("click", (event, d) => {
        if (d.type === "contact") {
          router.push(`/contacts/${d.id}`);
        }
      })
      .on("dblclick", (event, d) => {
        event.stopPropagation();
        nodes.forEach((n) => {
          n.fx = null;
          n.fy = null;
        });
        d.fx = width / 2;
        d.fy = height / 2;
        setCenteredNodeId(d.id);
        simulation.alpha(0.5).restart();
      });

    // Drag
    nodeGroup.call(
      d3
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
          if (d.id !== centeredNodeId) {
            d.fx = null;
            d.fy = null;
          }
        })
    );

    simulation.on("tick", () => {
      linkGroup
        .attr("x1", (d) => (d.source as GraphNode).x || 0)
        .attr("y1", (d) => (d.source as GraphNode).y || 0)
        .attr("x2", (d) => (d.target as GraphNode).x || 0)
        .attr("y2", (d) => (d.target as GraphNode).y || 0);

      nodeGroup.attr(
        "transform",
        (d) => `translate(${d.x || 0},${d.y || 0})`
      );
    });

    return () => {
      simulation.stop();
    };
  }, [loading, graphData, centeredNodeId, router]);

  const myContactCount = graphData.nodes.filter(
    (n) => n.type === "contact"
  ).length;
  const connectedUserCount = graphData.nodes.filter(
    (n) => n.type === "connected_user"
  ).length;
  const theirContactCount = graphData.nodes.filter(
    (n) => n.type === "their_contact"
  ).length;

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "#0f172a",
          color: "#94a3b8",
        }}
      >
        Loading network…
      </div>
    );
  }

  return (
    <div
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        background: "#0f172a",
        overflow: "hidden",
      }}
    >
      {/* Inline header */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          display: "flex",
          alignItems: "center",
          gap: "16px",
          padding: "12px 20px",
          background: "rgba(15,23,42,0.92)",
          borderBottom: "1px solid #1e293b",
        }}
      >
        <span
          onClick={() => router.push("/dashboard")}
          style={{ cursor: "pointer", color: "#64748b", fontSize: "14px" }}
        >
          ← Dashboard
        </span>
        <span
          style={{ fontWeight: "bold", color: "#e2e8f0", fontSize: "16px" }}
        >
          Network
        </span>
        <input
          type="text"
          placeholder="Filter…"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          style={{
            marginLeft: "auto",
            padding: "4px 12px",
            borderRadius: "6px",
            border: "1px solid #334155",
            background: "#1e293b",
            color: "#e2e8f0",
            fontSize: "13px",
            width: "180px",
          }}
        />
        <span
          style={{ color: "#64748b", fontSize: "12px", whiteSpace: "nowrap" }}
        >
          {myContactCount} contacts · {connectedUserCount} linked ·{" "}
          {theirContactCount} 2nd°
        </span>
      </div>

      {/* Legend bar */}
      <div
        style={{
          position: "absolute",
          top: "52px",
          left: 0,
          right: 0,
          zIndex: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "20px",
          padding: "6px 20px",
          background: "rgba(15,23,42,0.85)",
          fontSize: "11px",
          color: "#64748b",
        }}
      >
        <span>— Your connections</span>
        <span style={{ color: "#dc2626" }}>━ Mutual (linked)</span>
        <span>| Thickness = interaction density</span>
        <span>| Brightness = recency</span>
        <span>| Node size = # connections</span>
      </div>

      {/* Hint */}
      <div
        style={{
          position: "absolute",
          bottom: "12px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 20,
          fontSize: "11px",
          color: "#475569",
        }}
      >
        Dbl-click = re-center · Click = dossier
      </div>

      {/* SVG */}
      <div
        ref={containerRef}
        style={{ width: "100%", height: "100%", paddingTop: "76px" }}
      >
        <svg ref={svgRef} style={{ width: "100%", height: "100%" }} />
      </div>

      {/* Tooltip */}
      {hoveredNode && (
        <div
          style={{
            position: "fixed",
            left: tooltipPos.x + 12,
            top: tooltipPos.y - 8,
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: "8px",
            padding: "10px 14px",
            zIndex: 30,
            color: "#e2e8f0",
            fontSize: "13px",
            pointerEvents: "none",
            maxWidth: "260px",
          }}
        >
          <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
            {hoveredNode.label}
          </div>
          {hoveredNode.type === "contact" && (
            <>
              {hoveredNode.relationship_type && (
                <div style={{ color: "#94a3b8" }}>
                  {hoveredNode.relationship_type}
                </div>
              )}
              {hoveredNode.role && (
                <div style={{ color: "#94a3b8" }}>{hoveredNode.role}</div>
              )}
              {hoveredNode.company && (
                <div style={{ color: "#94a3b8" }}>{hoveredNode.company}</div>
              )}
            </>
          )}
          {hoveredNode.type === "connected_user" && (
            <div style={{ color: "#60a5fa" }}>
              Linked user · {hoveredNode.connectionCount} contacts
            </div>
          )}
          {hoveredNode.type === "their_contact" && (
            <>
              {hoveredNode.role && (
                <div style={{ color: "#94a3b8" }}>{hoveredNode.role}</div>
              )}
              {hoveredNode.company && (
                <div style={{ color: "#94a3b8" }}>{hoveredNode.company}</div>
              )}
              <div style={{ color: "#475569", fontSize: "11px" }}>
                2nd° connection
              </div>
            </>
          )}
          <div
            style={{ color: "#475569", fontSize: "11px", marginTop: "4px" }}
          >
            {hoveredNode.connectionCount} connection
            {hoveredNode.connectionCount !== 1 ? "s" : ""}
          </div>
        </div>
      )}
    </div>
  );
}
