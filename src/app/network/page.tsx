"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import * as d3 from "d3";
import { GraphNode, GraphLink } from "./types";
import { lineColor, nodeSize } from "./utils";
import { useNetworkData } from "./hooks/useNetworkData";
import { computeSimilarity, similarityToLink } from "./similarity";
import type { NodeProfile } from "./similarity";
import NetworkTooltip from "./components/NetworkTooltip";
import ZoomControls from "./components/ZoomControls";

// ─── Component ───
export default function NetworkPage() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(
    null
  );
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [filterText, setFilterText] = useState("");
  const router = useRouter();

  const { graphData, nodeProfiles, loading, fetchWorldData } = useNetworkData();

  // ─── World toggle ───
  const [showWorld, setShowWorld] = useState(false);
  const [worldNodes, setWorldNodes] = useState<GraphNode[]>([]);
  const [worldProfiles, setWorldProfiles] = useState<Record<string, NodeProfile>>({});
  const [worldLoading, setWorldLoading] = useState(false);

  const toggleWorld = useCallback(async () => {
    if (showWorld) {
      setShowWorld(false);
      return;
    }
    if (worldNodes.length === 0) {
      setWorldLoading(true);
      const data = await fetchWorldData();
      setWorldNodes(data.nodes);
      setWorldProfiles(data.profiles);
      setWorldLoading(false);
    }
    setShowWorld(true);
  }, [showWorld, worldNodes.length, fetchWorldData]);

  // Merge graph + world data
  const allNodes = useMemo(() => {
    if (showWorld) return [...graphData.nodes, ...worldNodes];
    return graphData.nodes;
  }, [graphData.nodes, worldNodes, showWorld]);

  const allProfiles = useMemo(() => {
    if (showWorld) return { ...nodeProfiles, ...worldProfiles };
    return nodeProfiles;
  }, [nodeProfiles, worldProfiles, showWorld]);

  // ─── D3 Rendering ───
  useEffect(() => {
    if (loading || allNodes.length === 0) return;
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
    svg.on("dblclick.zoom", null);
    zoomRef.current = zoom;

    // Custom wiggle force for gentle continuous drift
    const wiggleForce = () => {
      let wNodes: GraphNode[] = [];
      const force = () => {
        for (const n of wNodes) {
          if (n.fx != null) continue;
          n.vx = (n.vx || 0) + (Math.random() - 0.5) * 0.65;
          n.vy = (n.vy || 0) + (Math.random() - 0.5) * 0.65;
        }
      };
      force.initialize = (n: GraphNode[]) => { wNodes = n; };
      return force;
    };

    // Pin self node at center
    const selfNode = allNodes.find(n => n.id === "self");
    if (selfNode) {
      selfNode.x = width / 2;
      selfNode.y = height / 2;
      selfNode.fx = width / 2;
      selfNode.fy = height / 2;
    }

    // ── Similarity-based clustering ──────────────────────────
    // Build adjacency from real links so we don't duplicate them
    const adjacency: Record<string, Set<string>> = {};
    for (const link of graphData.links) {
      const sId = typeof link.source === 'string' ? link.source : (link.source as GraphNode).id;
      const tId = typeof link.target === 'string' ? link.target : (link.target as GraphNode).id;
      if (!adjacency[sId]) adjacency[sId] = new Set();
      if (!adjacency[tId]) adjacency[tId] = new Set();
      adjacency[sId].add(tId);
      adjacency[tId].add(sId);
    }

    // Compute similarity between all non-self node pairs and create
    // invisible attraction links where similarity is above threshold.
    // This replaces both the old adjacency-based clustering and
    // simple company-name matching with a richer semantic signal.
    const clusterLinks: (GraphLink & { _simStrength?: number })[] = [];
    const clusterPairSet = new Set<string>();
    const nodeIds = allNodes.map(n => n.id);

    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        const a = nodeIds[i], b = nodeIds[j];
        if (a === 'self' || b === 'self') continue;
        // Skip if already directly linked
        if ((adjacency[a] || new Set()).has(b)) continue;

        const profA = allProfiles[a];
        const profB = allProfiles[b];
        if (!profA || !profB) continue;

        const score = computeSimilarity(profA, profB);
        const params = similarityToLink(score);
        if (!params) continue;

        const pairKey = a < b ? `${a}|${b}` : `${b}|${a}`;
        if (clusterPairSet.has(pairKey)) continue;
        clusterPairSet.add(pairKey);

        clusterLinks.push({
          source: a,
          target: b,
          distance: params.distance,
          thickness: 0,
          recency: 0,
          isMutual: false,
          isLinkedUser: false,
          _simStrength: params.strength,
        });
      }
    }

    // Also keep adjacency-based (shared-neighbor) clustering for nodes
    // that might not have profile data but share structural connections
    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        const a = nodeIds[i], b = nodeIds[j];
        if (a === 'self' || b === 'self') continue;
        const pairKey = a < b ? `${a}|${b}` : `${b}|${a}`;
        if (clusterPairSet.has(pairKey)) continue;
        if ((adjacency[a] || new Set()).has(b)) continue;

        const aNeighbors = adjacency[a] || new Set();
        const bNeighbors = adjacency[b] || new Set();
        let shared = 0;
        for (const n of aNeighbors) { if (bNeighbors.has(n)) shared++; }
        if (shared >= 1) {
          clusterPairSet.add(pairKey);
          clusterLinks.push({
            source: a,
            target: b,
            distance: Math.max(60, 180 - shared * 50),
            thickness: 0,
            recency: 0,
            isMutual: false,
            isLinkedUser: false,
            _simStrength: 0.04,
          });
        }
      }
    }

    const allLinks = [...graphData.links, ...clusterLinks];

    const simulation = d3
      .forceSimulation<GraphNode>(allNodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphLink>(allLinks)
          .id((d) => d.id)
          .distance((d) => d.distance)
          .strength((d) => {
            if (d.thickness > 0) return 0.12; // visible links
            return (d as GraphLink & { _simStrength?: number })._simStrength || 0.04;
          })
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

    // Links (only render visible links — not cluster/similarity links)
    const link = g
      .append("g")
      .selectAll<SVGLineElement, GraphLink>("line")
      .data(graphData.links)
      .join("line")
      .attr("stroke", (d) => lineColor(d.isMutual, d.isLinkedUser, d.recency, d.isSecondDegree, d.isCrossLink))
      .attr("stroke-width", (d) => d.thickness)
      .attr("stroke-linecap", "round")
      .attr("stroke-dasharray", (d) => d.isCrossLink ? "6 4" : null);

    // Node groups
    const node = g
      .append("g")
      .selectAll<SVGGElement, GraphNode>("g")
      .data(allNodes)
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
        if (d.type === "world") return "#2d6a5a";
        return "#6b7f99";
      })
      .attr("stroke", "none")
      .attr("stroke-width", 0);

    // Labels
    node
      .append("text")
      .text((d) => d.label)
      .attr("text-anchor", "middle")
      .attr("dy", (d) => d.radius + 14)
      .attr("fill", (d) => {
        if (d.type === "self") return "#c9a050";
        if (d.type === "their_contact") return "#64748b";
        if (d.type === "world") return "#3d8a7a";
        return "#94a3b8";
      })
      .attr("font-size", (d) => (d.type === "their_contact" || d.type === "world" ? "8px" : "11px"))
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

    // Click/dblclick detection
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
        if (d.type !== "self") {
          d.fx = null;
          d.fy = null;
        }

        if (dragMoved) return;
        if (d.type === "self") return;

        const now = Date.now();
        if (now - lastTapTime < 400 && lastTapNodeId === d.id) {
          lastTapTime = 0;
          lastTapNodeId = "";
          if (d.contactId) router.push(`/contacts/${d.contactId}`);
          // World nodes: open their world profile
          else if (d.type === "world" && d.profileId) router.push(`/world/${d.profileId}`);
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

    // Filter highlight
    if (filterText.trim()) {
      const q = filterText.toLowerCase();
      const matchesFilter = (d: GraphNode) => {
        if (d.type === "self") return true;
        return d.searchText ? d.searchText.includes(q) : false;
      };
      const matchedIds = new Set(allNodes.filter(matchesFilter).map(n => n.id));
      node.attr("opacity", (d) => matchedIds.has(d.id) ? 1 : 0.15);
      link.attr("opacity", (d) => {
        const sId = (d.source as GraphNode).id;
        const tId = (d.target as GraphNode).id;
        if (matchedIds.has(sId) && matchedIds.has(tId)) return 1;
        return 0.08;
      });
    } else {
      node.attr("opacity", (d) => d.recency ?? 1);
      link.attr("opacity", 1);
    }

    return () => {
      simulation.stop();
    };
  }, [loading, graphData, allNodes, allProfiles, filterText, router]);

  // Count stats
  const networkNodeCount = graphData.nodes.length;
  const worldNodeCount = showWorld ? worldNodes.length : 0;
  const totalNodes = networkNodeCount + worldNodeCount;

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
          {totalNodes} nodes · {graphData.links.length} connections
        </span>

        {/* World toggle */}
        <button
          onClick={toggleWorld}
          disabled={worldLoading}
          style={{
            padding: "4px 12px",
            fontSize: "12px",
            borderRadius: "12px",
            border: showWorld ? "1px solid #2d6a5a" : "1px solid #334155",
            background: showWorld ? "rgba(45, 106, 90, 0.25)" : "transparent",
            color: showWorld ? "#5ab89a" : "#64748b",
            cursor: worldLoading ? "wait" : "pointer",
            transition: "all 0.2s",
          }}
        >
          {worldLoading ? "Loading…" : showWorld ? `World (${worldNodes.length})` : "World"}
        </button>

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
        <NetworkTooltip hoveredNode={hoveredNode} tooltipPos={tooltipPos} />
      </div>

      {/* Zoom controls */}
      <ZoomControls svgRef={svgRef} zoomRef={zoomRef} />
    </div>
  );
}
