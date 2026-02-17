"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import * as d3 from "d3";
import Link from "next/link";

// Types
interface NetworkNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  jobTitle?: string;
  company?: string;
  type: "user" | "contact" | "connected-user" | "second-degree";
  connectionCount: number;
  contactId?: string;
  userId?: string;
}

interface NetworkLink extends d3.SimulationLinkDatum<NetworkNode> {
  isMutual: boolean;
  interactionCount: number;
  lastInteraction?: string;
  closeness: number;
}

// Colors - muted palette
const COLORS = {
  userNode: "#7C8D9E",
  contactNode: "#A8B2BC",
  connectedUserNode: "#B09494",
  secondDegreeNode: "#C5C8CB",
  linkMine: "#2D2D2D",
  linkMutual: "#8B3A3A",
  background: "#FAFAFA",
};

export default function NetworkPage() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    node: NetworkNode;
  } | null>(null);
  const [centeredNodeId, setCenteredNodeId] = useState<string | null>(null);
  const simulationRef = useRef<d3.Simulation<NetworkNode, NetworkLink> | null>(null);
  const supabase = createClientComponentClient();

  // Fetch all network data
  const fetchNetworkData = useCallback(async (userId: string) => {
    // 1. My contacts
    const { data: myContacts } = await supabase
      .from("contacts")
      .select("*")
      .eq("owner_id", userId);

    // 2. My connections (accepted)
    const { data: connections } = await supabase
      .from("connections")
      .select("*")
      .or(`inviter_id.eq.${userId},invitee_id.eq.${userId}`)
      .eq("status", "accepted");

    // 3. Connected user IDs
    const mutualUserIds: string[] = [];
    const contactToConnection: Record<string, string> = {};
    if (connections) {
      for (const conn of connections) {
        const otherId = conn.inviter_id === userId ? conn.invitee_id : conn.inviter_id;
        mutualUserIds.push(otherId);
        if (conn.contact_id) {
          contactToConnection[conn.contact_id] = otherId;
        }
      }
    }

    // 4. Connected users' profiles
    const connectedProfiles: Record<string, any> = {};
    if (mutualUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, job_title, company")
        .in("id", mutualUserIds);
      if (profiles) {
        for (const p of profiles) {
          connectedProfiles[p.id] = p;
        }
      }
    }

    // 5. Second-degree contacts (their contacts)
    let secondDegreeContacts: any[] = [];
    if (mutualUserIds.length > 0) {
      const { data: theirContacts } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, job_title, company, owner_id, location, skills, notes")
        .in("owner_id", mutualUserIds);
      if (theirContacts) {
        secondDegreeContacts = theirContacts;
      }
    }

    // 6. Interaction counts for my contacts
    const { data: interactions } = await supabase
      .from("interactions")
      .select("contact_id, interaction_date")
      .eq("owner_id", userId);

    const interactionCounts: Record<string, number> = {};
    const lastInteractions: Record<string, string> = {};
    if (interactions) {
      for (const i of interactions) {
        interactionCounts[i.contact_id] = (interactionCounts[i.contact_id] || 0) + 1;
        if (!lastInteractions[i.contact_id] || i.interaction_date > lastInteractions[i.contact_id]) {
          lastInteractions[i.contact_id] = i.interaction_date;
        }
      }
    }

    return {
      myContacts: myContacts || [],
      connections: connections || [],
      mutualUserIds,
      contactToConnection,
      connectedProfiles,
      secondDegreeContacts,
      interactionCounts,
      lastInteractions,
    };
  }, [supabase]);

  // Filter contacts by search term across all fields
  const matchesFilter = (contact: any, term: string): boolean => {
    if (!term) return true;
    const lower = term.toLowerCase();
    const fields = [
      contact.first_name,
      contact.last_name,
      contact.job_title,
      contact.company,
      contact.location,
      contact.email,
      contact.phone,
      contact.notes,
      contact.skills,
      contact.education,
    ];
    return fields.some((f) => f && String(f).toLowerCase().includes(lower));
  };

  // Build graph nodes and links
  const buildGraph = useCallback(
    (data: any, filterTerm: string, centerNodeId: string | null) => {
      const nodes: NetworkNode[] = [];
      const links: NetworkLink[] = [];
      const nodeMap = new Map<string, NetworkNode>();

      const centerUser = centerNodeId || data.myContacts.length > 0 ? "user" : null;
      const isCenteredOnContact = centerNodeId && centerNodeId !== "user";

      // User node (me)
      const userNode: NetworkNode = {
        id: "user",
        name: "You",
        type: "user",
        connectionCount: (data.myContacts?.length || 0) + data.mutualUserIds.length,
      };
      nodes.push(userNode);
      nodeMap.set("user", userNode);

      // My contacts (skip those who are connected users - they show as connected-user type)
      const filteredContacts = data.myContacts.filter((c: any) => {
        if (data.contactToConnection[c.id]) return false; // dedup
        return matchesFilter(c, filterTerm);
      });

      for (const contact of filteredContacts) {
        const firstName = contact.first_name || "";
        const lastName = contact.last_name || "";
        const initial = firstName.charAt(0).toUpperCase();
        const displayName = lastName ? `${initial}. ${lastName}` : firstName;

        const node: NetworkNode = {
          id: `contact-${contact.id}`,
          name: displayName,
          jobTitle: contact.job_title,
          company: contact.company,
          type: "contact",
          connectionCount: data.interactionCounts[contact.id] || 1,
          contactId: contact.id,
        };
        nodes.push(node);
        nodeMap.set(node.id, node);

        links.push({
          source: isCenteredOnContact === `contact-${contact.id}` ? node.id : "user",
          target: isCenteredOnContact === `contact-${contact.id}` ? "user" : node.id,
          isMutual: false,
          interactionCount: data.interactionCounts[contact.id] || 0,
          lastInteraction: data.lastInteractions[contact.id],
          closeness: contact.closeness || 3,
        });
      }

      // Connected users (mutual connections)
      for (const uid of data.mutualUserIds) {
        const profile = data.connectedProfiles[uid];
        const name = profile?.full_name || "Connected User";
        const matchesConnectedUser = !filterTerm || 
          (profile && matchesFilter({
            first_name: profile.full_name,
            job_title: profile.job_title,
            company: profile.company,
          }, filterTerm));

        if (!matchesConnectedUser) continue;

        // Find the original contact record to get interaction data
        const contactEntry = Object.entries(data.contactToConnection).find(([_, v]) => v === uid);
        const contactId = contactEntry ? contactEntry[0] : undefined;
        const originalContact = contactId ? data.myContacts.find((c: any) => c.id === contactId) : null;

        const node: NetworkNode = {
          id: `connected-${uid}`,
          name: name,
          jobTitle: profile?.job_title,
          company: profile?.company,
          type: "connected-user",
          connectionCount: data.secondDegreeContacts.filter((c: any) => c.owner_id === uid).length + 1,
          contactId: contactId,
          userId: uid,
        };
        nodes.push(node);
        nodeMap.set(node.id, node);

        links.push({
          source: "user",
          target: node.id,
          isMutual: true,
          interactionCount: contactId ? (data.interactionCounts[contactId] || 0) : 0,
          lastInteraction: contactId ? data.lastInteractions[contactId] : undefined,
          closeness: originalContact?.closeness || 2,
        });

        // Second degree contacts (their contacts)
        const theirContacts = data.secondDegreeContacts.filter((c: any) => c.owner_id === uid);
        for (const sc of theirContacts) {
          const matchesSecond = matchesFilter(sc, filterTerm);
          if (!matchesSecond && filterTerm) continue;

          const secondNode: NetworkNode = {
            id: `second-${sc.id}`,
            name: sc.job_title || "Contact",
            type: "second-degree",
            connectionCount: 1,
            contactId: sc.id,
          };
          nodes.push(secondNode);
          nodeMap.set(secondNode.id, secondNode);

          links.push({
            source: `connected-${uid}`,
            target: secondNode.id,
            isMutual: false,
            interactionCount: 0,
            closeness: 4,
          });
        }
      }

      return { nodes, links };
    },
    []
  );

  // Calculate line opacity from recency
  const getRecencyOpacity = (lastInteraction?: string): number => {
    if (!lastInteraction) return 0.25;
    const daysSince = (Date.now() - new Date(lastInteraction).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 7) return 1.0;
    if (daysSince < 30) return 0.75;
    if (daysSince < 90) return 0.5;
    if (daysSince < 365) return 0.35;
    return 0.2;
  };

  // Render D3 graph
  const renderGraph = useCallback(
    (nodes: NetworkNode[], links: NetworkLink[], centerNodeId: string | null) => {
      if (!svgRef.current) return;

      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();

      const width = svgRef.current.clientWidth;
      const height = svgRef.current.clientHeight;

      const g = svg.append("g");

      // Zoom
      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.2, 4])
        .on("zoom", (event) => {
          g.attr("transform", event.transform);
        });
      svg.call(zoom);

      // Force simulation
      const centerNode = centerNodeId || "user";
      const simulation = d3.forceSimulation<NetworkNode>(nodes)
        .force("link", d3.forceLink<NetworkNode, NetworkLink>(links)
          .id((d) => d.id)
          .distance((d) => {
            const closeness = (d as NetworkLink).closeness || 3;
            return 40 + closeness * 35;
          })
        )
        .force("charge", d3.forceManyBody().strength(-200))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collision", d3.forceCollide().radius(30));

      simulationRef.current = simulation;

      // Links
      const link = g.append("g")
        .selectAll("line")
        .data(links)
        .join("line")
        .attr("stroke", (d) => d.isMutual ? COLORS.linkMutual : COLORS.linkMine)
        .attr("stroke-width", (d) => {
          const base = 1;
          const intensity = Math.min(d.interactionCount || 0, 20);
          return base + intensity * 0.3;
        })
        .attr("stroke-opacity", (d) => getRecencyOpacity(d.lastInteraction));

      // Node groups
      const node = g.append("g")
        .selectAll("g")
        .data(nodes)
        .join("g")
        .style("cursor", "pointer");

      // Circles - no outline
      node.append("circle")
        .attr("r", (d) => {
          const base = d.type === "user" ? 16 : d.type === "second-degree" ? 6 : 10;
          return base + Math.min(d.connectionCount, 15) * 0.8;
        })
        .attr("fill", (d) => {
          switch (d.type) {
            case "user": return COLORS.userNode;
            case "contact": return COLORS.contactNode;
            case "connected-user": return COLORS.connectedUserNode;
            case "second-degree": return COLORS.secondDegreeNode;
            default: return COLORS.contactNode;
          }
        })
        .attr("stroke", "none");

      // Labels
      node.append("text")
        .text((d) => d.name)
        .attr("text-anchor", "middle")
        .attr("dy", (d) => {
          const r = (d.type === "user" ? 16 : d.type === "second-degree" ? 6 : 10) + Math.min(d.connectionCount, 15) * 0.8;
          return r + 14;
        })
        .attr("font-size", (d) => d.type === "second-degree" ? "9px" : "11px")
        .attr("fill", "#555")
        .attr("font-family", "system-ui, sans-serif");

      // Hover
      node.on("mouseenter", (event, d) => {
        const [x, y] = d3.pointer(event, svgRef.current);
        setTooltip({ x, y, node: d });
      })
      .on("mouseleave", () => {
        setTooltip(null);
      });

      // Single click - open dossier
      node.on("click", (event, d) => {
        if (d.type === "user") return;
        if (d.contactId) {
          window.location.href = `/contacts/${d.contactId}`;
        }
      });

      // Double click - re-center
      node.on("dblclick", (event, d) => {
        event.preventDefault();
        event.stopPropagation();
        setCenteredNodeId(d.id);
      });

      // Drag
      const drag = d3.drag<any, NetworkNode>()
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
          .attr("x1", (d) => (d.source as NetworkNode).x || 0)
          .attr("y1", (d) => (d.source as NetworkNode).y || 0)
          .attr("x2", (d) => (d.target as NetworkNode).x || 0)
          .attr("y2", (d) => (d.target as NetworkNode).y || 0);
        node.attr("transform", (d) => `translate(${d.x || 0},${d.y || 0})`);
      });
    },
    []
  );

  // Init
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
if (!session?.user) {
  window.location.href = "/login";
  return;
}
const authUser = session.user;
      setUser(authUser);
      setLoading(false);
    };
    init();
  }, [supabase]);

  // Fetch and render
  useEffect(() => {
    if (!user) return;

    const loadAndRender = async () => {
      const data = await fetchNetworkData(user.id);
      const { nodes, links } = buildGraph(data, filter, centeredNodeId);
      renderGraph(nodes, links, centeredNodeId);
    };

    loadAndRender();

    const handleResize = () => {
      if (user) loadAndRender();
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [user, filter, centeredNodeId, fetchNetworkData, buildGraph, renderGraph]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading network...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-gray-500 hover:text-gray-700 text-sm">
            ← Dashboard
          </Link>
          <h1 className="text-lg font-semibold text-gray-800">Network</h1>
        </div>
        <div className="flex items-center gap-3">
          {/* Filter */}
          <input
            type="text"
            placeholder="Filter by skill, company, location, keyword..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm w-80 focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
          {filter && (
            <button
              onClick={() => setFilter("")}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Clear
            </button>
          )}
          {centeredNodeId && centeredNodeId !== "user" && (
            <button
              onClick={() => setCenteredNodeId(null)}
              className="text-xs text-gray-500 hover:text-gray-700 border px-2 py-1 rounded"
            >
              Re-center on me
            </button>
          )}
        </div>
      </div>

      {/* Graph */}
      <div className="flex-1 relative">
        <svg ref={svgRef} className="w-full h-full" style={{ minHeight: "calc(100vh - 57px)" }} />

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute bg-white shadow-lg rounded-lg px-3 py-2 pointer-events-none border border-gray-200 z-50"
            style={{ left: tooltip.x + 15, top: tooltip.y - 10 }}
          >
            <div className="text-sm font-medium text-gray-800">{tooltip.node.name}</div>
            {tooltip.node.jobTitle && (
              <div className="text-xs text-gray-500">{tooltip.node.jobTitle}</div>
            )}
            {tooltip.node.company && (
              <div className="text-xs text-gray-400">{tooltip.node.company}</div>
            )}
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-white/90 rounded-lg px-3 py-2 text-xs text-gray-500 border">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-0.5 bg-gray-800"></div> My connection
          </div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-0.5" style={{ backgroundColor: COLORS.linkMutual }}></div> Mutual (linked)
          </div>
          <div className="text-gray-400 mt-1">Thicker = more interactions · Brighter = more recent</div>
          <div className="text-gray-400">Double-click to re-center · Click to open dossier</div>
        </div>
      </div>
    </div>
  );
}
