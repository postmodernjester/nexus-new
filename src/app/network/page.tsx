"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import * as d3 from "d3";

interface Contact {
  id: string;
  full_name: string;
  relationship_type: string;
  company: string | null;
  role: string | null;
  last_contacted: string | null;
  interaction_frequency: string | null;
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  isUser: boolean;
  radius: number;
  relationship_type?: string;
  company?: string;
  role?: string;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  distance: number;
  thickness: number;
  recency: number; // 0 = stale, 1 = recent
}

// Relationship type → distance from center (smaller = closer)
const RELATIONSHIP_DISTANCE: Record<string, number> = {
  Family: 80,
  "Close Friend": 120,
  Friend: 160,
  Colleague: 180,
  Business: 220,
  Acquaintance: 260,
  Stranger: 320,
};

// Interaction frequency → line thickness
const FREQUENCY_THICKNESS: Record<string, number> = {
  Daily: 6,
  Weekly: 4.5,
  "Bi-weekly": 3.5,
  Monthly: 2.5,
  Quarterly: 1.8,
  Yearly: 1.2,
  Rarely: 0.8,
};

function getRecency(lastContacted: string | null): number {
  if (!lastContacted) return 0.15;
  const now = new Date();
  const last = new Date(lastContacted);
  const daysSince = (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince <= 7) return 1;
  if (daysSince <= 30) return 0.8;
  if (daysSince <= 90) return 0.6;
  if (daysSince <= 180) return 0.4;
  if (daysSince <= 365) return 0.25;
  return 0.15;
}

function recencyToColor(recency: number): string {
  // Single hue (slate blue), brightness varies
  // recency 1 = bright, recency 0 = very dark
  const lightness = 25 + recency * 45; // range 25% to 70%
  const saturation = 20 + recency * 25; // range 20% to 45%
  return `hsl(215, ${saturation}%, ${lightness}%)`;
}

export default function NetworkPage() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    async function fetchContacts() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("contacts")
        .select(
          "*"
        )
        .eq("user_id", user.id);

      if (!error && data) {
        setContacts(data);
      }
      setLoading(false);
    }
    fetchContacts();
  }, []);

  useEffect(() => {
    if (loading || !svgRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Clear previous
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    // Zoom layer
    const g = svg.append("g");
    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.3, 3])
        .on("zoom", (event) => {
          g.attr("transform", event.transform);
        }) as any
    );

    // Build nodes
    const userNode: GraphNode = {
      id: "user",
      label: "You",
      isUser: true,
      radius: 10,
      fx: width / 2,
      fy: height / 2,
    };

    const contactNodes: GraphNode[] = contacts.map((c) => ({
      id: c.id,
      label: c.full_name,
      isUser: false,
      radius: 9, // all ~same for now since no sub-contacts yet
      relationship_type: c.relationship_type,
      company: c.company ?? undefined,
      role: c.role ?? undefined,
    }));

    const nodes: GraphNode[] = [userNode, ...contactNodes];

    const links: GraphLink[] = contacts.map((c) => {
      const relType = c.relationship_type || "Acquaintance";
      const distance = RELATIONSHIP_DISTANCE[relType] || 260;
      const freq = c.interaction_frequency || "Rarely";
      const thickness = FREQUENCY_THICKNESS[freq] || 0.8;
      const recency = getRecency(c.last_contacted);

      return {
        source: "user",
        target: c.id,
        distance,
        thickness,
        recency,
      };
    });

    // Force simulation
    const simulation = d3
      .forceSimulation<GraphNode>(nodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance((d) => d.distance)
          .strength(0.7)
      )
      .force("charge", d3.forceManyBody().strength(-150))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collision",
        d3.forceCollide<GraphNode>().radius((d) => d.radius + 4)
      );

    // Draw links
    const link = g
      .append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", (d) => recencyToColor(d.recency))
      .attr("stroke-width", (d) => d.thickness)
      .attr("stroke-linecap", "round")
      .attr("opacity", 0.7);

    // Draw nodes
    const node = g
      .append("g")
      .selectAll<SVGCircleElement, GraphNode>("circle")
      .data(nodes)
      .join("circle")
      .attr("r", (d) => d.radius)
      .attr("fill", (d) => (d.isUser ? "#64748b" : "#94a3b8"))
      .attr("stroke", (d) => (d.isUser ? "#475569" : "#cbd5e1"))
      .attr("stroke-width", (d) => (d.isUser ? 2 : 1))
      .attr("cursor", (d) => (d.isUser ? "default" : "pointer"))
      .on("mouseover", function (event, d) {
        if (!d.isUser) {
          d3.select(this).attr("fill", "#78909c").attr("stroke-width", 2);
          setHoveredNode(d);
          setTooltipPos({ x: event.clientX, y: event.clientY });
        }
      })
      .on("mousemove", function (event) {
        setTooltipPos({ x: event.clientX, y: event.clientY });
      })
      .on("mouseout", function (event, d) {
        if (!d.isUser) {
          d3.select(this)
            .attr("fill", "#94a3b8")
            .attr("stroke-width", 1);
          setHoveredNode(null);
        }
      })
      .on("click", (event, d) => {
        if (!d.isUser) {
          router.push(`/contacts/${d.id}`);
        }
      })
      .call(
        d3
          .drag<SVGCircleElement, GraphNode>()
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
            if (!d.isUser) {
              d.fx = null;
              d.fy = null;
            }
          })
      );

    // Labels (small, subtle)
    const labels = g
      .append("g")
      .selectAll("text")
      .data(nodes)
      .join("text")
      .text((d) => d.label)
      .attr("font-size", "11px")
      .attr("fill", "#94a3b8")
      .attr("text-anchor", "middle")
      .attr("dy", (d) => d.radius + 14)
      .attr("pointer-events", "none")
      .attr("font-family", "system-ui, sans-serif");

    // Tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node.attr("cx", (d) => d.x!).attr("cy", (d) => d.y!);

      labels.attr("x", (d) => d.x!).attr("y", (d) => d.y!);
    });

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [contacts, loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400">Loading network...</p>
      </div>
    );
  }

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
        <div className="text-sm text-gray-500">
          {contacts.length} connection{contacts.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Legend */}
      <div className="px-6 py-2 flex gap-6 text-xs text-gray-500 border-b border-gray-800/50">
        <span>Line length = closeness of relationship</span>
        <span>Line thickness = interaction frequency</span>
        <span>Line brightness = recency of contact</span>
      </div>

      {/* Graph */}
      <div ref={containerRef} className="flex-1 relative">
        <svg ref={svgRef} className="w-full h-full" />

        {/* Tooltip */}
        {hoveredNode && !hoveredNode.isUser && (
          <div
            className="fixed z-50 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 pointer-events-none shadow-lg"
            style={{
              left: tooltipPos.x + 12,
              top: tooltipPos.y - 10,
            }}
          >
            <p className="text-sm font-medium text-gray-200">
              {hoveredNode.label}
            </p>
            {hoveredNode.role && hoveredNode.company && (
              <p className="text-xs text-gray-400">
                {hoveredNode.role} at {hoveredNode.company}
              </p>
            )}
            {hoveredNode.relationship_type && (
              <p className="text-xs text-gray-500">
                {hoveredNode.relationship_type}
              </p>
            )}
          </div>
        )}

        {/* Empty state */}
        <div className="absolute top-2 left-2 text-xs text-yellow-400 z-50">
          Loaded {contacts.length} contacts
        </div>
        {contacts.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-gray-400 mb-2">No connections yet</p>
              <button
                onClick={() => router.push("/contacts")}
                className="text-sm text-blue-400 hover:text-blue-300"
              >
                Add contacts to see your network →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
