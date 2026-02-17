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
  user_id: string;
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
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Not logged in");
        setLoading(false);
        return;
      }

      // Fetch data in parallel
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
              "id, user_id, full_name, email, phone, company, role, linked_profile_id"
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

      // Build profile lookup
      const profileMap: Record<string, Profile> = {};
      allProfiles.forEach((p) => {
        profileMap[p.id] = p;
      });

      // Find MY connections (where I'm inviter or invitee)
      const myConnections = connections.filter(
        (c) => c.inviter_id === user.id || c.invitee_id === user.id
      );

      // Get IDs of users I'm connected to
      const connectedUserIds = myConnections.map((c) =>
        c.inviter_id === user.id ? c.invitee_id : c.inviter_id
      );

      // My contacts
      const myContacts = allContacts.filter((c) => c.user_id === user.id);

      // Map contact linked_profile_id to connected user IDs
      const contactIdToUserId: Record<string, string> = {};
      myContacts.forEach((c) => {
        if (
          c.linked_profile_id &&
          connectedUserIds.includes(c.linked_profile_id)
        ) {
          contactIdToUserId[c.id] = c.linked_profile_id;
        }
      });

      // Build nodes and links
      const nodes: GraphNode[] = [];
      const links: GraphLink[] = [];

      // Track person -> nodeId for dedup
      const personToNodeId: Map<string, string> = new Map();

      // 1. SELF node
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

      // 2. CONNECTED USERS (mutual connections)
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
        links.push({
          source: selfNodeId,
          target: nodeId,
          type: "mutual",
        });
        mutualUserIds.push(uid);

        personToNodeId.set(`profile:${uid}`, nodeId);
        if (profile.full_name) {
          personToNodeId.set(
            `name:${normalizeNameForMatch(profile.full_name)}`,
            nodeId
          );
        }
      });

      // 3. MY CONTACTS (that aren't already connected users)
      myContacts.forEach((c) => {
        // Skip if this contact is a connected user (already has a node)
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
        links.push({
          source: selfNodeId,
          target: nodeId,
          type: "direct",
        });

        // Register for dedup
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

      // 4. THEIR CONTACTS (2nd degree) — with dedup
      for (const uid of mutualUserIds) {
        const theirContacts = allContacts.filter(
          (c) => c.user_id === uid && c.user_id !== user.id
        );

        for (const tc of theirContacts) {
          // Skip if this contact IS me
          if (tc.linked_profile_id === user.id) continue;

          // Skip if this contact IS the connected user themselves
          if (tc.linked_profile_id === uid) continue;

          // Check for existing node by linked_profile_id
          let existingNodeId: string | undefined;

          if (tc.linked_profile_id) {
            existingNodeId = personToNodeId.get(
              `profile:${tc.linked_profile_id}`
            );
          }

          // Check by name match
          if (!existingNodeId && tc.full_name) {
            existingNodeId = personToNodeId.get(
              `name:${normalizeNameForMatch(tc.full_name)}`
            );
          }

          // If already exists, just add a link
          if (existingNodeId) {
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
            continue;
          }

          // Create new node
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

          // Register for dedup
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

      setNodeCount(nodes.length);

      if (nodes.length === 0) {
        setError("No network data yet");
        setLoading(false);
        return;
      }

      // Render with D3
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

    // Color scheme
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

    // Simulation
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

    // Container for zoom
    const g = svg.append("g");

    // Zoom
    svg.call(
      d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.3, 3])
        .on("zoom", (event) => {
          g.attr("transform", event.transform);
        })
    );

    // Links
    const link = g
      .append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", (d) => {
        if (d.type === "mutual") return "#60a5fa";
        if (d.type === "second_degree") return "#374151";
        return "#6b7280";
      })
      .attr("stroke-opacity", (d) =>
        d.type === "second_degree" ? 0.3 : 0.6
      )
      .attr("stroke-width", (d) => (d.type === "mutual" ? 2 : 1));

    // Nodes
    const node = g
      .append("g")
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", (d) => sizeMap[d.type] || 8)
      .attr("fill", (d) => colorMap[d.type] || "#6b7280")
      .attr("stroke", "#1f2937")
      .attr("stroke-width", 1.5)
      .attr("cursor", "grab")
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
      .selectAll("text")
      .data(nodes)
      .join("text")
      .text((d) => d.label)
      .attr("font-size", (d) =>
        d.type === "self"
          ? 14
          : d.type === "their_contact"
            ? 9
            : 11
      )
      .attr("fill", "#e5e7eb")
      .attr("text-anchor", "middle")
      .attr("dy", (d) => -(sizeMap[d.type] || 8) - 6)
      .attr("pointer-events", "none");

    // Tooltip on hover
    node.append("title").text((d) => {
      let text = d.label;
      if (d.subtitle) text += `\n${d.subtitle}`;
      return text;
    });

    // Tick
    sim.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as GraphNode).x || 0)
        .attr("y1", (d) => (d.source as GraphNode).y || 0)
        .attr("x2", (d) => (d.target as GraphNode).x || 0)
        .attr("y2", (d) => (d.target as GraphNode).y || 0);

      node.attr("cx", (d) => d.x || 0).attr("cy", (d) => d.y || 0);

      label.attr("x", (d) => d.x || 0).attr("y", (d) => d.y || 0);
    });
  };

  useEffect(() => {
    buildGraph();
  }, [buildGraph]);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="p-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Network</h1>
        {!loading && !error && (
          <span className="text-sm text-gray-400">{nodeCount} nodes</span>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center h-[80vh]">
          <p className="text-gray-400">Loading network…</p>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center h-[80vh]">
          <p className="text-gray-400">{error}</p>
        </div>
      )}

      <svg
        ref={svgRef}
        className="w-full"
        style={{
          height: "calc(100vh - 80px)",
          display: loading || error ? "none" : "block",
        }}
      />

      {/* Legend */}
      {!loading && !error && (
        <div className="fixed bottom-4 left-4 bg-gray-900/90 rounded-lg p-3 flex gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <span>You</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-blue-400" />
            <span>Connected</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-purple-400" />
            <span>Your Contacts</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-gray-500" />
            <span>2nd Degree</span>
          </div>
        </div>
      )}
    </div>
  );
}
