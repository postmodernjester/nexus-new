"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import * as d3 from "d3";

// ─── Nav ───
const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/network", label: "Network" },
  { href: "/contacts", label: "Contacts" },
];

function Nav() {
  const pathname = usePathname();
  return (
    <nav
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 20px",
        background: "#0f172a",
        borderBottom: "1px solid #1e293b",
        zIndex: 30,
        position: "relative",
      }}
    >
      <Link
        href="/dashboard"
        style={{
          fontSize: "18px",
          fontWeight: "bold",
          color: "#fff",
          textDecoration: "none",
          letterSpacing: "-0.5px",
        }}
      >
        NEXUS
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                padding: "6px 14px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 500,
                textDecoration: "none",
                color: active ? "#0f172a" : "#94a3b8",
                background: active ? "#fff" : "transparent",
                transition: "all 0.15s",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

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
}

interface Connection {
  id: string;
  inviter_id: string;
  invitee_id: string;
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
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  distance: number;
  thickness: number;
  recency: number;
  isMutual: boolean;
  isLinkedUser: boolean;
}

// ─── Constants ───
const CLOSENESS: Record<string, number> = {
  Family: 60,
  "Close Friend": 90,
  Friend: 130,
  Colleague: 160,
  Business: 190,
  "Business Contact": 190,
  "Biz Contact": 190,
  Acquaintance: 230,
  Stranger: 280,
  Other: 250,
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
  isMutual: boolean,
  isLinkedUser: boolean,
  recency: number
): string {
  if (isLinkedUser) {
    return "rgba(220, 38, 38, 1)";
  }
  if (isMutual) {
    const alpha = 0.3 + recency * 0.7;
    return `rgba(220, 38, 38, ${alpha})`;
  }
  const alpha = 0.15 + recency * 0.7;
  return `rgba(255, 255, 255, ${alpha})`;
}

function lineThickness(count: number, isLinkedUser: boolean): number {
  if (isLinkedUser) return 4;
  if (count === 0) return 0.8;
  if (count <= 2) return 1.5;
  if (count <= 5) return 2.5;
  if (count <= 10) return 3.5;
  if (count <= 20) return 4.5;
  return 6;
}

function nodeSize(count: number, isSelf: boolean): number {
  if (isSelf) return Math.max(20, 12 + Math.min(count * 1.2, 16));
  return 8 + Math.min(count * 1.2, 16);
}

// ─── Component ───
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

      const mutualUserIds = new Set<string>();
      for (const conn of connections) {
        if (conn.inviter_id === user.id) mutualUserIds.add(conn.invitee_id);
        else if (conn.invitee_id === user.id)
          mutualUserIds.add(conn.inviter_id);
      }

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

      // ① Self — always the logged-in user
      const myName = profileRes.data?.full_name || "You";
      const selfConnCount = myContacts.length + mutualUserIds.size;
      nodes.push({
        id: "self",
        label: myName,
        fullName: myName,
        type: "self",
        radius: nodeSize(selfConnCount, true),
        connectionCount: selfConnCount,
        user_id: user.id,
        profileId: user.id,
      });
      profileToNodeId[user.id] = "self";
      nameToNodeId[myName.toLowerCase()] = "self";

      // ② Connected users
      for (const uid of Array.from(mutualUserIds)) {
        const profile = connectedProfiles[uid];
        const name = profile?.full_name || "Connected User";
        const theirCount = theirContacts.filter(
          (c) => c.owner_id === uid
        ).length;
        const nodeId = `user-${uid}`;

        const myCard = myContactsLinkedToConnectedUser.get(uid);
        const stats = myCard ? interactionMap[myCard.id] : null;
        const relType = myCard?.relationship_type || "Acquaintance";

        nodes.push({
          id: nodeId,
          label: name,
          fullName: name,
          type: "connected_user",
          radius: nodeSize(theirCount + 1, false),
          connectionCount: theirCount + 1,
          user_id: uid,
          profileId: uid,
          relationship_type: relType,
          company: myCard?.company ?? undefined,
          role: myCard?.role ?? undefined,
        });
        profileToNodeId[uid] = nodeId;
        nameToNodeId[name.toLowerCase()] = nodeId;

        links.push({
          source: "self",
          target: nodeId,
          distance: CLOSENESS[relType] || 190,
          thickness: 4,
          recency: computeRecency(
            stats?.most_recent || myCard?.last_contact_date || null
          ),
          isMutual: true,
          isLinkedUser: true,
        });
      }

      // ③ My contacts (skip if linked to connected user)
      for (const c of myContacts) {
        if (
          c.linked_profile_id &&
          myContactsLinkedToConnectedUser.has(c.linked_profile_id)
        ) {
          continue;
        }

        const stats = interactionMap[c.id];
        const nodeId = c.id;
        const parts = (c.full_name || "Unknown").split(" ");
        const displayLabel =
          parts.length > 1
            ? `${parts[0][0]}. ${parts[parts.length - 1]}`
            : parts[0];

        nodes.push({
          id: nodeId,
          label: displayLabel,
          fullName: c.full_name || "Unknown",
          type: "contact",
          radius: nodeSize(1, false),
          connectionCount: 1,
          relationship_type: c.relationship_type,
          company: c.company ?? undefined,
          role: c.role ?? undefined,
          owner_id: c.owner_id,
          profileId: c.linked_profile_id ?? undefined,
        });
        if (c.linked_profile_id) profileToNodeId[c.linked_profile_id] = nodeId;
        nameToNodeId[(c.full_name || "").toLowerCase()] = nodeId;

        links.push({
          source: "self",
          target: nodeId,
          distance: CLOSENESS[c.relationship_type] || 230,
          thickness: lineThickness(stats?.count || 0, false),
          recency: computeRecency(
            stats?.most_recent || c.last_contact_date || null
          ),
          isMutual: false,
          isLinkedUser: false,
        });
      }

      // ④ Their contacts (dedup)
      for (const c of theirContacts) {
        if (c.linked_profile_id === user.id) continue;

        let existingNodeId: string | null = null;
        if (c.linked_profile_id && profileToNodeId[c.linked_profile_id]) {
          existingNodeId = profileToNodeId[c.linked_profile_id];
        }
        if (!existingNodeId) {
          const nameKey = (c.full_name || "").toLowerCase();
          if (nameToNodeId[nameKey]) existingNodeId = nameToNodeId[nameKey];
        }

        if (existingNodeId) {
          const ownerNodeId = `user-${c.owner_id}`;
          const alreadyLinked = links.some(
            (l) =>
              (l.source === ownerNodeId && l.target === existingNodeId) ||
              (l.source === existingNodeId && l.target === ownerNodeId)
          );
          if (!alreadyLinked) {
            const stats = interactionMap[c.id];
            links.push({
              source: ownerNodeId,
              target: existingNodeId,
              distance: CLOSENESS[c.relationship_type] || 230,
              thickness: lineThickness(
                stats?.count || 0,
                !!c.linked_profile_id
              ),
              recency: computeRecency(
                stats?.most_recent || c.last_contact_date || null
              ),
              isMutual: true,
              isLinkedUser: !!c.linked_profile_id,
            });
          }
          const selfLink = links.find(
            (l) =>
              (l.source === "self" && l.target === existingNodeId) ||
              (l.source === existingNodeId && l.target === "self")
          );
          if (selfLink) selfLink.isMutual = true;
          const node = nodes.find((n) => n.id === existingNodeId);
          if (node) {
            node.connectionCount++;
            node.radius = nodeSize(node.connectionCount, node.type === "self");
          }
          continue;
        }

        const nameParts = (c.full_name || "??").split(" ");
        const initials = `${(nameParts[0] || "?")[0]}${
          nameParts.length > 1
            ? (nameParts[nameParts.length - 1] || "?")[0]
            : "?"
        }`.toUpperCase();
        const stats = interactionMap[c.id];
        const nodeId = `their-${c.id}`;

        nodes.push({
          id: nodeId,
          label: initials,
          fullName: c.full_name || "Unknown",
          type: "their_contact",
          radius: nodeSize(1, false),
          connectionCount: 1,
          company: c.company ?? undefined,
          role: c.role ?? undefined,
          owner_id: c.owner_id,
          profileId: c.linked_profile_id ?? undefined,
          relationship_type: c.relationship_type,
        });
        if (c.linked_profile_id) profileToNodeId[c.linked_profile_id] = nodeId;
        nameToNodeId[(c.full_name || "").toLowerCase()] = nodeId;

        links.push({
          source: `user-${c.owner_id}`,
          target: nodeId,
          distance: CLOSENESS[c.relationship_type] || 230,
          thickness: lineThickness(stats?.count || 0, !!c.linked_profile_id),
          recency: computeRecency(
            stats?.most_recent || c.last_contact_date || null
          ),
          isMutual: false,
          isLinkedUser: !!c.linked_profile_id,
        });
      }

      setGraphData({ nodes, links });
      setLoading(false);
    }

    fetchAll();
  }, [router]);

  // ─── D3 Render ───
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

    const svgEl = svgRef.current;
    if (svgEl) {
      d3.select(svgEl).call(
        d3
          .zoom<SVGSVGElement, unknown>()
          .scaleExtent([0.2, 4])
          .on("zoom", (event) => g.attr("transform", event.transform))
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

    // Always pin self at dead center
    const selfNode = nodes.find((n) => n.id === "self");
    if (selfNode) {
      selfNode.fx = width / 2;
      selfNode.fy = height / 2;
    }

    // If re-centered on another node, pin that one instead
    if (centeredNodeId !== "self") {
      const centerNode = nodes.find((n) => n.id === centeredNodeId);
      if (centerNode) {
        if (selfNode) {
          selfNode.fx = null;
          selfNode.fy = null;
        }
        centerNode.fx = width / 2;
        centerNode.fy = height / 2;
      }
    }

    const simulation = d3
      .forceSimulation<GraphNode>(nodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance((d) => d.distance)
          .strength(0.4)
      )
      .force("charge", d3.forceManyBody().strength(-400).distanceMax(600))
      .force("center", d3.forceCenter(width / 2, height / 2).strength(0.03))
      .force(
        "collision",
        d3.forceCollide<GraphNode>().radius((d) => d.radius + 20).strength(0.8)
      )
      .force(
        "x",
        d3.forceX(width / 2).strength(0.015)
      )
      .force(
        "y",
        d3.forceY(height / 2).strength(0.015)
      );

    simulationRef.current = simulation;

    const linkGroup = g
      .selectAll<SVGLineElement, GraphLink>("line")
      .data(links)
      .enter()
      .append("line")
      .attr("stroke", (d) => lineColor(d.isMutual, d.isLinkedUser, d.recency))
      .attr("stroke-width", (d) => d.thickness)
      .attr("stroke-linecap", "round");

    const nodeGroup = g
      .selectAll<SVGGElement, GraphNode>("g.node")
      .data(nodes)
      .enter()
      .append("g")
      .attr("class", "node")
      .style("cursor", "pointer");

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

    nodeGroup
      .append("text")
      .text((d) => {
        if (d.type === "self") return d.label;
        if (d.type === "connected_user") return d.label;
        if (d.type === "their_contact") {
          const place = d.company || d.role || "";
          return place ? `${d.label} @ ${place}` : d.label;
        }
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
      .on("click", (_event, d) => {
        if (d.type === "contact") router.push(`/contacts/${d.id}`);
      })
      .on("dblclick", (event, d) => {
        event.stopPropagation();
        // Unpin all
        nodes.forEach((n) => {
          n.fx = null;
          n.fy = null;
        });
        // Pin this one at center
        d.fx = width / 2;
        d.fy = height / 2;
        setCenteredNodeId(d.id);
        simulation.alpha(0.5).restart();
      });

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
          // Keep self pinned unless user re-centered elsewhere
          if (d.id === "self" && centeredNodeId === "self") {
            d.fx = width / 2;
            d.fy = height / 2;
          } else if (d.id !== centeredNodeId) {
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
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Nav />

      {/* Sub-header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          padding: "8px 20px",
          background: "rgba(15,23,42,0.92)",
          borderBottom: "1px solid #1e293b",
          zIndex: 20,
        }}
      >
        <input
          type="text"
          placeholder="Filter…"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          style={{
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
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: "20px",
            fontSize: "11px",
            color: "#64748b",
          }}
        >
          <span>— Your connections</span>
          <span style={{ color: "#dc2626", fontWeight: "bold" }}>
            ━ Linked / Mutual
          </span>
          <span>Thickness = density</span>
          <span>Brightness = recency</span>
        </div>
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
      <div ref={containerRef} style={{ flex: 1, width: "100%" }}>
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
            maxWidth: "280px",
          }}
        >
          <div style={{ fontWeight: "bold", marginBottom: "2px" }}>
            {hoveredNode.fullName}
          </div>

          {hoveredNode.type === "contact" && (
            <>
              {hoveredNode.role && (
                <div style={{ color: "#94a3b8", fontSize: "12px" }}>
                  {hoveredNode.role}
                </div>
              )}
              {hoveredNode.company && (
                <div style={{ color: "#94a3b8", fontSize: "12px" }}>
                  {hoveredNode.company}
                </div>
              )}
            </>
          )}

          {hoveredNode.type === "connected_user" && (
            <>
              {hoveredNode.role && (
                <div style={{ color: "#94a3b8", fontSize: "12px" }}>
                  {hoveredNode.role}
                </div>
              )}
              {hoveredNode.company && (
                <div style={{ color: "#94a3b8", fontSize: "12px" }}>
                  {hoveredNode.company}
                </div>
              )}
            </>
          )}

          {hoveredNode.type === "their_contact" && hoveredNode.role && (
            <div style={{ color: "#94a3b8", fontSize: "12px" }}>
              {hoveredNode.role}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
