"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import * as d3 from "d3";

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  type: "self" | "contact" | "connected_user" | "their_contact";
  profileId?: string;
  contactId?: string;
  subtitle?: string;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  type?: "direct" | "mutual" | "second_degree";
}

interface Contact {
  id: string;
  owner_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  role: string | null;
  linked_profile_id: string | null;
}

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface Connection {
  id: string;
  inviter_id: string;
  invitee_id: string;
  status: string;
  contact_id: string | null;
}

function getDisplayName(c: Contact): string {
  if (c.full_name) return c.full_name;
  if (c.email) return c.email;
  if (c.phone) return c.phone;
  return "Unknown";
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

function normalizeNameForMatch(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

export default function NetworkPage() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nodeCount, setNodeCount] = useState(0);

  const buildGraph = useCallback(async () => {
    const supabase = createClient();

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Not logged in");
        setLoading(false);
        return;
      }

      const [profileRes, connectionsRes, contactsRes, allProfilesRes] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id, full_name, avatar_url")
            .eq("id", user.id)
            .single(),
          supabase
            .from("connections")
            .select("id, inviter_id, invitee_id, status, contact_id")
            .eq("status", "accepted"),
          supabase
            .from("contacts")
            .select(
              "id, owner_id, full_name, email, phone, company, role, linked_profile_id"
            ),
          supabase.from("profiles").select("id, full_name, avatar_url"),
        ]);

      const myProfile = profileRes.data;
      const connections = (connectionsRes.data || []) as Connection[];
      const allContacts = (contactsRes.data || []) as Contact[];
      const allProfiles = (allProfilesRes.data || []) as Profile[];

      if (!myProfile) {
        setError("Profile not found");
        setLoading(false);
        return;
      }

      console.log("[Network] allContacts count:", allContacts.length);
      console.log("[Network] connections count:", connections.length);

      const profileMap: Record<string, Profile> = {};
      allProfiles.forEach((p) => {
        profileMap[p.id] = p;
      });

      const myConnections = connections.filter(
        (c) => c.inviter_id === user.id || c.invitee_id === user.id
      );

      const connectedUserIds = myConnections.map((c) =>
        c.inviter_id === user.id ? c.invitee_id : c.inviter_id
      );

      console.log("[Network] connectedUserIds:", connectedUserIds);

      const myContacts = allContacts.filter((c) => c.owner_id === user.id);

      const contactIdToUserId: Record<string, string> = {};
      myContacts.forEach((c) => {
        if (
          c.linked_profile_id &&
          connectedUserIds.includes(c.linked_profile_id)
        ) {
          contactIdToUserId[c.id] = c.linked_profile_id;
        }
      });

      const nodes: GraphNode[] = [];
      const links: GraphLink[] = [];
      const personToNodeId: Map<string, string> = new Map();

      // 1. SELF
      const selfNodeId = `user-${user.id}`;
      nodes.push({
        id: selfNodeId,
        label: myProfile.full_name || "Me",
        type: "self",
        profileId: user.id,
      });
      personToNodeId.set(`profile:${user.id}`, selfNodeId);
      if (myProfile.full_name) {
        personToNodeId.set(
          `name:${normalizeNameForMatch(myProfile.full_name)}`,
          selfNodeId
        );
      }

      // 2. CONNECTED USERS
      const mutualUserIds: string[] = [];
      connectedUserIds.forEach((uid) => {
        const profile = profileMap[uid];
        if (!profile) return;

        const nodeId = `user-${uid}`;
        nodes.push({
          id: nodeId,
          label: profile.full_name || "User",
          type: "connected_user",
          profileId: uid,
        });
        links.push({ source: selfNodeId, target: nodeId, type: "mutual" });
        mutualUserIds.push(uid);

        personToNodeId.set(`profile:${uid}`, nodeId);
        if (profile.full_name) {
          personToNodeId.set(
            `name:${normalizeNameForMatch(profile.full_name)}`,
            nodeId
          );
        }
      });

      // 3. MY CONTACTS (skip if already a connected user node)
      myContacts.forEach((c) => {
        if (contactIdToUserId[c.id]) return;

        const nodeId = `contact-${c.id}`;
        const displayName = getDisplayName(c);

        nodes.push({
          id: nodeId,
          label: displayName,
          type: "contact",
          contactId: c.id,
          subtitle: [c.role, c.company].filter(Boolean).join(" @ "),
        });
        links.push({ source: selfNodeId, target: nodeId, type: "direct" });

        if (c.linked_profile_id) {
          personToNodeId.set(`profile:${c.linked_profile_id}`, nodeId);
        }
        if (c.full_name) {
          personToNodeId.set(
            `name:${normalizeNameForMatch(c.full_name)}`,
            nodeId
          );
        }
      });

      // 4. THEIR CONTACTS (2nd degree) with dedup
      console.log("[Network] mutualUserIds for 2nd degree:", mutualUserIds);

      for (const uid of mutualUserIds) {
        const theirContacts = allContacts.filter(
          (c) => c.owner_id === uid
        );

        console.log(`[Network] User ${uid} has ${theirContacts.length} contacts`);

        for (const tc of theirContacts) {
          // Skip if this contact points back to the current user
          if (tc.linked_profile_id === user.id) continue;
          // Skip if this contact points back to the owner (self-reference)
          if (tc.linked_profile_id === uid) continue;

          let existingNodeId: string | undefined;

          if (tc.linked_profile_id) {
            existingNodeId = personToNodeId.get(
              `profile:${tc.linked_profile_id}`
            );
          }

          if (!existingNodeId && tc.full_name) {
            existingNodeId = personToNodeId.get(
              `name:${normalizeNameForMatch(tc.full_name)}`
            );
          }

          if (existingNodeId) {
            // Already exists as a node - just add a link from this connected user to them
            const linkExists = links.some(
              (l) =>
                (l.source === `user-${uid}` ||
                  (l.source as GraphNode)?.id === `user-${uid}`) &&
                (l.target === existingNodeId ||
                  (l.target as GraphNode)?.id === existingNodeId)
            );
            if (!linkExists) {
              links.push({
                source: `user-${uid}`,
                target: existingNodeId,
                type: "second_degree",
              });
            }
            console.log(`[Network] 2nd degree dedup: ${tc.full_name} -> existing node ${existingNodeId}`);
            continue;
          }

          // New 2nd degree contact - add as node
          const nodeId = `their-${tc.id}`;
          const displayName = getDisplayName(tc);

          nodes.push({
            id: nodeId,
            label: displayName,
            type: "their_contact",
            contactId: tc.id,
            subtitle: [tc.role, tc.company].filter(Boolean).join(" @ "),
          });
          links.push({
            source: `user-${uid}`,
            target: nodeId,
            type: "second_degree",
          });

          console.log(`[Network] 2nd degree NEW: ${tc.full_name} (${nodeId})`);

          if (tc.linked_profile_id) {
            personToNodeId.set(`profile:${tc.linked_profile_id}`, nodeId);
          }
          if (tc.full_name) {
            personToNodeId.set(
              `name:${normalizeNameForMatch(tc.full_name)}`,
              nodeId
            );
          }
        }
      }

      console.log("[Network] Final nodes:", nodes.length, "links:", links.length);
      console.log("[Network] Node types:", nodes.map(n => `${n.label} (${n.type})`));

      setNodeCount(nodes.length);

      if (nodes.length === 0) {
        setError("No network data yet");
        setLoading(false);
        return;
      }

      renderGraph(nodes, links);
      setLoading(false);
    } catch (err) {
      console.error("Network error:", err);
      setError("Failed to load network data");
      setLoading(false);
    }
  }, []);

  const renderGraph = (nodes: GraphNode[], links: GraphLink[]) => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = svgRef.current.clientWidth || 800;
    const height = svgRef.current.clientHeight || 600;

    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const colorMap: Record<string, string> = {
      self: "#facc15",
      connected_user: "#60a5fa",
      contact: "#a78bfa",
      their_contact: "#6b7280",
    };

    const sizeMap: Record<string, number> = {
      self: 20,
      connected_user: 14,
      contact: 10,
      their_contact: 7,
    };

    const sim = d3
      .forceSimulation<GraphNode>(nodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance(100)
      )
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(30));

    const g = svg.append("g");

    svg.call(
      d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.3, 3])
        .on("zoom", (event) => {
          g.attr("transform", event.transform);
        })
    );

    // Lines - doubled thickness: mutual 2->4, direct 1->2, second_degree 1->2
    const link = g
      .append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", (d) => {
        if (d.type === "mutual") return "#60a5fa";
        if (d.type === "second_degree") return "#374151";
        return "#4b5563";
      })
      .attr("stroke-opacity", (d) => (d.type === "second_degree" ? 0.4 : 0.6))
      .attr("stroke-width", (d) => (d.type === "mutual" ? 4 : 2));

    const node = g
      .append("g")
      .selectAll<SVGCircleElement, GraphNode>("circle")
      .data(nodes)
      .join("circle")
      .attr("r", (d) => sizeMap[d.type] || 8)
      .attr("fill", (d) => colorMap[d.type] || "#6b7280")
      .attr("stroke", "#000")
      .attr("stroke-width", 1.5)
      .style("cursor", "pointer")
      .call(
        d3
          .drag<SVGCircleElement, GraphNode>()
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
    const label = g
      .append("g")
      .selectAll<SVGTextElement, GraphNode>("text")
      .data(nodes)
      .join("text")
      .text((d) => {
        if (d.type === "their_contact") {
          // 2nd degree: show initials + subtitle
          const initials = d.label ? getInitials(d.label) : "??";
          return d.subtitle ? `${initials} · ${d.subtitle}` : initials;
        }
        return d.label;
      })
      .attr("font-size", (d) => {
        if (d.type === "self") return "13px";
        if (d.type === "connected_user") return "11px";
        if (d.type === "their_contact") return "9px";
        return "10px";
      })
      .attr("fill", (d) => {
        if (d.type === "self") return "#facc15";
        if (d.type === "connected_user") return "#93c5fd";
        if (d.type === "their_contact") return "#9ca3af";
        return "#d1d5db";
      })
      .attr("text-anchor", "middle")
      .attr("dy", (d) => -(sizeMap[d.type] || 8) - 6)
      .style("pointer-events", "none")
      .style("user-select", "none");

    // Subtitle labels for contacts (not 2nd degree - those have it inline)
    const subtitle = g
      .append("g")
      .selectAll<SVGTextElement, GraphNode>("text")
      .data(nodes.filter((n) => n.subtitle && n.type !== "their_contact"))
      .join("text")
      .text((d) => d.subtitle || "")
      .attr("font-size", "8px")
      .attr("fill", "#6b7280")
      .attr("text-anchor", "middle")
      .attr("dy", (d) => -(sizeMap[d.type] || 8) - 6 + 12)
      .style("pointer-events", "none")
      .style("user-select", "none");

    // Tooltip on hover
    node.on("mouseover", function (event, d) {
      d3.select(this).attr("stroke", "#fff").attr("stroke-width", 3);
    });
    node.on("mouseout", function (event, d) {
      d3.select(this).attr("stroke", "#000").attr("stroke-width", 1.5);
    });

    // Click to navigate
    node.on("click", (event, d) => {
      if (d.type === "self" && d.profileId) {
        window.location.href = "/resume";
      } else if (d.type === "connected_user" && d.profileId) {
        window.location.href = `/contacts`;
      } else if (
        (d.type === "contact" || d.type === "their_contact") &&
        d.contactId
      ) {
        window.location.href = `/contacts/${d.contactId}`;
      }
    });

    sim.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as GraphNode).x || 0)
        .attr("y1", (d) => (d.source as GraphNode).y || 0)
        .attr("x2", (d) => (d.target as GraphNode).x || 0)
        .attr("y2", (d) => (d.target as GraphNode).y || 0);

      node.attr("cx", (d) => d.x || 0).attr("cy", (d) => d.y || 0);

      label.attr("x", (d) => d.x || 0).attr("y", (d) => d.y || 0);

      subtitle.attr("x", (d) => d.x || 0).attr("y", (d) => d.y || 0);
    });
  };

  useEffect(() => {
    buildGraph();
  }, [buildGraph]);

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Network Graph</h1>
            <p className="text-zinc-400 text-sm">
              {nodeCount > 0
                ? `${nodeCount} people in your network`
                : "Visualize your professional connections"}
            </p>
          </div>
          <a
            href="/dashboard"
            className="text-sm text-zinc-400 hover:text-white transition"
          >
            ← Dashboard
          </a>
        </div>

        {/* Legend */}
        <div className="flex gap-6 mb-4 text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" />
            You
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-400 inline-block" />
            Connected Users
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-purple-400 inline-block" />
            Your Contacts
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-gray-500 inline-block" />
            2nd Degree
          </div>
        </div>

        <div className="bg-zinc-900 rounded-xl border border-zinc-800 relative overflow-hidden">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80 z-10">
              <div className="text-zinc-400">Building network graph...</div>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80 z-10">
              <div className="text-red-400">{error}</div>
            </div>
          )}
          <svg
            ref={svgRef}
            className="w-full"
            style={{ height: "calc(100vh - 220px)", minHeight: "500px" }}
          />
        </div>
      </div>
    </div>
  );
}
