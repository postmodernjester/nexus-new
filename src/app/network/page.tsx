'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as d3 from 'd3';
import { supabase } from '@/lib/supabase';
import Nav from '@/components/Nav';

/* ------------------------------------------------------------------ */
/*  TYPES                                                              */
/* ------------------------------------------------------------------ */
interface ContactRow {
  id: string;
  full_name: string;
  role: string | null;
  company: string | null;
  relationship_type: string | null;
  communication_frequency: number | null;
  collaboration_depth: number | null;
  last_contact_date: string | null;
  linked_profile_id: string | null;
  owner_id: string;
}

interface ConnectionRow {
  inviter_id: string;
  invitee_id: string;
  status: string;
}

interface ProfileRow {
  id: string;
  full_name: string;
  headline: string | null;
}

interface InteractionRow {
  contact_id: string;
  interaction_date: string;
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  detail: string;
  group: 'me' | 'contact' | 'connected-user' | 'second-degree';
  radius: number;
  relationshipType?: string;
  communicationFrequency?: number;
  collaborationDepth?: number;
  lastContactDate?: string | null;
  linkedProfileId?: string | null;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  kind: 'own' | 'mutual' | 'second-degree';
  thickness: number;
  brightness: number;
}

/* ------------------------------------------------------------------ */
/*  HELPERS                                                            */
/* ------------------------------------------------------------------ */

/** Interaction density → line thickness (1–5) */
function calcThickness(freq: number | null, depth: number | null): number {
  const f = freq ?? 0;
  const d = depth ?? 0;
  return Math.max(1, Math.min(5, Math.round((f + d) / 2)));
}

/** Recency → brightness 0.15 – 1.0  (older = dimmer) */
function calcBrightness(lastDate: string | null): number {
  if (!lastDate) return 0.25;
  const days = (Date.now() - new Date(lastDate).getTime()) / 86400000;
  if (days < 7) return 1.0;
  if (days < 30) return 0.75;
  if (days < 90) return 0.5;
  if (days < 180) return 0.35;
  return 0.2;
}

/** Relationship type → force distance */
function relationshipDistance(type: string | null): number {
  switch (type?.toLowerCase()) {
    case 'close friend':
    case 'partner':
    case 'family':
      return 80;
    case 'friend':
    case 'colleague':
      return 130;
    case 'acquaintance':
      return 200;
    case 'mentor':
    case 'mentee':
      return 150;
    default:
      return 170;
  }
}

/** Build display detail string */
function fmtDetail(role: string | null, company: string | null, headline: string | null): string {
  if (headline) return headline;
  if (role && company) return `${role} at ${company}`;
  return role || company || '';
}

/** Get initials from a name */
function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/* ------------------------------------------------------------------ */
/*  COMPONENT                                                          */
/* ------------------------------------------------------------------ */
export default function NetworkPage() {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let destroyed = false;

    async function build() {
      try {
        /* ---------- AUTH ---------- */
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.user) {
          router.push('/login');
          return;
        }
        const uid = session.user.id;

        /* ---------- FETCH DATA ---------- */
        const [contactsRes, connectionsRes, profileRes, interactionsRes] = await Promise.all([
          supabase.from('contacts').select('*').eq('owner_id', uid),
          supabase.from('connections').select('*').eq('status', 'accepted').or(`inviter_id.eq.${uid},invitee_id.eq.${uid}`),
          supabase.from('profiles').select('id, full_name, headline').eq('id', uid).single(),
          supabase.from('interactions').select('contact_id, interaction_date').eq('owner_id', uid),
        ]);

        if (destroyed) return;

        const contacts: ContactRow[] = contactsRes.data ?? [];
        const connections: ConnectionRow[] = connectionsRes.data ?? [];
        const myProfile: ProfileRow | null = profileRes.data;
        const interactions: InteractionRow[] = interactionsRes.data ?? [];

        /* ---------- INTERACTION COUNTS PER CONTACT ---------- */
        const interactionCounts = new Map<string, number>();
        for (const ix of interactions) {
          interactionCounts.set(ix.contact_id, (interactionCounts.get(ix.contact_id) || 0) + 1);
        }

        /* ---------- CONNECTED USER IDS ---------- */
        const connectedUserIds = new Set<string>();
        for (const c of connections) {
          const other = c.inviter_id === uid ? c.invitee_id : c.inviter_id;
          connectedUserIds.add(other);
        }

        /* ---------- DEDUP: contacts with linked_profile_id are connected users ---------- */
        const linkedProfileIds = new Set<string>();
        for (const ct of contacts) {
          if (ct.linked_profile_id) linkedProfileIds.add(ct.linked_profile_id);
        }

        /* ---------- FETCH CONNECTED USER PROFILES ---------- */
        const connectedIds = Array.from(connectedUserIds);
        let connectedProfiles: ProfileRow[] = [];
        if (connectedIds.length > 0) {
          const { data } = await supabase
            .from('profiles')
            .select('id, full_name, headline')
            .in('id', connectedIds);
          connectedProfiles = data ?? [];
        }
        const profileMap = new Map<string, ProfileRow>();
        for (const p of connectedProfiles) profileMap.set(p.id, p);

        /* ---------- FETCH SECOND-DEGREE CONTACTS ---------- */
        let secondDegreeContacts: ContactRow[] = [];
        if (connectedIds.length > 0) {
          const { data } = await supabase
            .from('contacts')
            .select('*')
            .in('owner_id', connectedIds);
          secondDegreeContacts = data ?? [];
        }

        /* Also fetch second-degree profiles for headline display */
        const secondDegreeProfileIds = new Set<string>();
        for (const sc of secondDegreeContacts) {
          if (sc.linked_profile_id && !profileMap.has(sc.linked_profile_id)) {
            secondDegreeProfileIds.add(sc.linked_profile_id);
          }
        }
        if (secondDegreeProfileIds.size > 0) {
          const { data } = await supabase
            .from('profiles')
            .select('id, full_name, headline')
            .in('id', Array.from(secondDegreeProfileIds));
          for (const p of (data ?? [])) profileMap.set(p.id, p);
        }

        if (destroyed) return;

        /* ---------- MUTUAL CONNECTIONS ---------- */
        const mutualContactIds = new Set<string>();
        const myContactLinkedIds = new Set<string>();
        for (const ct of contacts) {
          if (ct.linked_profile_id) myContactLinkedIds.add(ct.linked_profile_id);
        }
        for (const sc of secondDegreeContacts) {
          if (sc.linked_profile_id && myContactLinkedIds.has(sc.linked_profile_id)) {
            mutualContactIds.add(sc.linked_profile_id);
          }
          // Also check if the second-degree contact name matches any of my contacts
          for (const mc of contacts) {
            if (mc.full_name === sc.full_name && mc.id !== sc.id) {
              mutualContactIds.add(sc.id);
            }
          }
        }

        /* ================================================================ */
        /*  BUILD GRAPH                                                      */
        /* ================================================================ */
        const nodes: GraphNode[] = [];
        const links: GraphLink[] = [];
        const nodeIds = new Set<string>();

        /* --- ME node --- */
        const meId = `me-${uid}`;
        nodes.push({
          id: meId,
          label: myProfile?.full_name ?? 'Me',
          detail: myProfile?.headline ?? '',
          group: 'me',
          radius: 28,
        });
        nodeIds.add(meId);

        /* --- Connected users (from connections table, with dedup) --- */
        for (const cuId of connectedUserIds) {
          // Skip if already represented as a contact with linked_profile_id
          // (dedup — we'll use the connected-user version instead)
          const nid = `user-${cuId}`;
          if (nodeIds.has(nid)) continue;

          const prof = profileMap.get(cuId);
          // Find matching contact for relationship details
          const matchingContact = contacts.find((ct) => ct.linked_profile_id === cuId);

          const connectionCount = secondDegreeContacts.filter((sc) => sc.owner_id === cuId).length;

          nodes.push({
            id: nid,
            label: prof?.full_name ?? matchingContact?.full_name ?? 'Connected User',
            detail: fmtDetail(
              matchingContact?.role ?? null,
              matchingContact?.company ?? null,
              prof?.headline ?? null
            ),
            group: 'connected-user',
            radius: Math.max(14, Math.min(24, 14 + connectionCount * 1.5)),
            relationshipType: matchingContact?.relationship_type ?? undefined,
            communicationFrequency: matchingContact?.communication_frequency ?? undefined,
            collaborationDepth: matchingContact?.collaboration_depth ?? undefined,
            lastContactDate: matchingContact?.last_contact_date ?? undefined,
            linkedProfileId: cuId,
          });
          nodeIds.add(nid);

          const thickness = calcThickness(
            matchingContact?.communication_frequency ?? null,
            matchingContact?.collaboration_depth ?? null
          );
          const brightness = calcBrightness(matchingContact?.last_contact_date ?? null);

          links.push({
            source: meId,
            target: nid,
            kind: mutualContactIds.has(cuId) ? 'mutual' : 'own',
            thickness,
            brightness,
          });
        }

        /* --- My contacts (non-linked only, since linked ones are shown as connected users) --- */
        for (const ct of contacts) {
          if (ct.linked_profile_id && connectedUserIds.has(ct.linked_profile_id)) continue; // deduped
          const nid = `contact-${ct.id}`;
          if (nodeIds.has(nid)) continue;

          const ixCount = interactionCounts.get(ct.id) ?? 0;

          nodes.push({
            id: nid,
            label: ct.full_name,
            detail: fmtDetail(ct.role, ct.company, null),
            group: 'contact',
            radius: Math.max(10, Math.min(20, 10 + ixCount * 2)),
            relationshipType: ct.relationship_type ?? undefined,
            communicationFrequency: ct.communication_frequency ?? undefined,
            collaborationDepth: ct.collaboration_depth ?? undefined,
            lastContactDate: ct.last_contact_date ?? undefined,
          });
          nodeIds.add(nid);

          links.push({
            source: meId,
            target: nid,
            kind: 'own',
            thickness: calcThickness(ct.communication_frequency, ct.collaboration_depth),
            brightness: calcBrightness(ct.last_contact_date),
          });
        }

        /* --- Second-degree contacts --- */
        for (const sc of secondDegreeContacts) {
          // Skip if this person is me
          if (sc.linked_profile_id === uid) continue;
          // Skip if already in graph (my contact or connected user)
          const existingAsUser = `user-${sc.linked_profile_id}`;
          const existingAsContact = contacts.find(
            (mc) => mc.full_name === sc.full_name || mc.linked_profile_id === sc.linked_profile_id
          );
          if (sc.linked_profile_id && nodeIds.has(existingAsUser)) continue;
          if (existingAsContact) continue;

          const nid = `second-${sc.id}`;
          if (nodeIds.has(nid)) continue;

          const prof = sc.linked_profile_id ? profileMap.get(sc.linked_profile_id) : null;

          nodes.push({
            id: nid,
            label: initials(sc.full_name),
            detail: fmtDetail(sc.role, sc.company, prof?.headline ?? null),
            group: 'second-degree',
            radius: 8,
            relationshipType: sc.relationship_type ?? undefined,
          });
          nodeIds.add(nid);

          // Link to the connected user who owns this contact
          const ownerNodeId = `user-${sc.owner_id}`;
          if (nodeIds.has(ownerNodeId)) {
            links.push({
              source: ownerNodeId,
              target: nid,
              kind: 'second-degree',
              thickness: 1,
              brightness: 0.3,
            });
          }
        }

        if (destroyed || !svgRef.current) return;

        /* ================================================================ */
        /*  RENDER D3                                                        */
        /* ================================================================ */
        const container = svgRef.current.parentElement!;
        const W = container.clientWidth;
        const H = container.clientHeight;

        const svg = d3
          .select(svgRef.current)
          .attr('width', W)
          .attr('height', H)
          .attr('viewBox', `0 0 ${W} ${H}`);

        svg.selectAll('*').remove();

        const g = svg.append('g');

        /* --- Zoom + double-click re-center --- */
        const zoomBehavior = d3
          .zoom<SVGSVGElement, unknown>()
          .scaleExtent([0.2, 4])
          .on('zoom', (event) => g.attr('transform', event.transform));

        svg.call(zoomBehavior);
        svg.on('dblclick.zoom', null); // disable default double-click zoom
        svg.on('dblclick', () => {
          svg.transition().duration(500).call(zoomBehavior.transform, d3.zoomIdentity);
        });

        const tooltip = d3.select(tooltipRef.current);

        /* --- Color scheme (muted) --- */
        const isDark =
          typeof window !== 'undefined' &&
          window.matchMedia('(prefers-color-scheme: dark)').matches;

        const palette = {
          me: isDark ? '#e2e8f0' : '#1e293b',
          contact: isDark ? '#94a3b8' : '#475569',
          connectedUser: isDark ? '#7dd3fc' : '#0284c7',
          secondDegree: isDark ? '#64748b' : '#94a3b8',
          ownLink: isDark ? '#e2e8f0' : '#1e293b',
          mutualLink: isDark ? '#f87171' : '#dc2626',
          secondLink: isDark ? '#475569' : '#cbd5e1',
          bg: isDark ? '#0f172a' : '#ffffff',
          text: isDark ? '#f1f5f9' : '#0f172a',
          textMuted: isDark ? '#94a3b8' : '#64748b',
        };

        /* --- Links --- */
        const linkSel = g
          .append('g')
          .selectAll('line')
          .data(links)
          .join('line')
          .attr('stroke', (d) => {
            if (d.kind === 'mutual') return palette.mutualLink;
            if (d.kind === 'second-degree') return palette.secondLink;
            return palette.ownLink;
          })
          .attr('stroke-width', (d) => d.thickness)
          .attr('stroke-opacity', (d) => d.brightness);

        /* --- Nodes --- */
        const nodeSel = g
          .append('g')
          .selectAll<SVGGElement, GraphNode>('g')
          .data(nodes)
          .join('g')
          .style('cursor', 'pointer');

        // Circles
        nodeSel
          .append('circle')
          .attr('r', (d) => d.radius)
          .attr('fill', (d) => {
            switch (d.group) {
              case 'me': return palette.me;
              case 'connected-user': return palette.connectedUser;
              case 'second-degree': return palette.secondDegree;
              default: return palette.contact;
            }
          })
          .attr('stroke', (d) => (d.group === 'me' ? palette.connectedUser : 'none'))
          .attr('stroke-width', (d) => (d.group === 'me' ? 3 : 0))
          .attr('opacity', (d) => (d.group === 'second-degree' ? 0.6 : 1));

        // Labels
        nodeSel
          .append('text')
          .text((d) => {
            if (d.group === 'second-degree') return d.label; // initials
            if (d.group === 'me') return 'Me';
            // Truncate long names
            const name = d.label;
            return name.length > 14 ? name.slice(0, 12) + '…' : name;
          })
          .attr('text-anchor', 'middle')
          .attr('dy', (d) => d.radius + 14)
          .attr('fill', (d) => (d.group === 'second-degree' ? palette.textMuted : palette.text))
          .attr('font-size', (d) => (d.group === 'second-degree' ? '9px' : '11px'))
          .attr('font-weight', (d) => (d.group === 'me' ? '700' : '400'))
          .attr('pointer-events', 'none');

        // Second-degree initials inside circle
        nodeSel
          .filter((d) => d.group === 'second-degree')
          .append('text')
          .text((d) => d.label)
          .attr('text-anchor', 'middle')
          .attr('dy', '0.35em')
          .attr('fill', isDark ? '#e2e8f0' : '#ffffff')
          .attr('font-size', '7px')
          .attr('font-weight', '600')
          .attr('pointer-events', 'none');

        /* --- Hover tooltip --- */
        nodeSel
          .on('mouseover', (_event, d) => {
            tooltip.style('opacity', '1').html(`
              <div style="font-weight:700;font-size:14px;margin-bottom:4px">${d.group === 'second-degree' ? '2° Contact' : d.label}</div>
              ${d.detail ? `<div style="color:${palette.textMuted};font-size:12px;margin-bottom:2px">${d.detail}</div>` : ''}
              ${d.relationshipType ? `<div style="font-size:11px;color:${palette.textMuted}">Relationship: ${d.relationshipType}</div>` : ''}
              ${d.communicationFrequency ? `<div style="font-size:11px;color:${palette.textMuted}">Communication: ${d.communicationFrequency}/10</div>` : ''}
              ${d.collaborationDepth ? `<div style="font-size:11px;color:${palette.textMuted}">Collaboration: ${d.collaborationDepth}/10</div>` : ''}
              ${d.lastContactDate ? `<div style="font-size:11px;color:${palette.textMuted}">Last contact: ${new Date(d.lastContactDate).toLocaleDateString()}</div>` : ''}
              ${d.group === 'connected-user' ? `<div style="font-size:11px;color:${palette.connectedUser};margin-top:4px">⚡ Connected on Nexus</div>` : ''}
              ${d.group === 'second-degree' ? `<div style="font-size:11px;color:${palette.secondDegree};margin-top:4px">👤 2nd-degree connection</div>` : ''}
            `);
          })
          .on('mousemove', (event) => {
            tooltip
              .style('left', event.pageX + 12 + 'px')
              .style('top', event.pageY - 12 + 'px');
          })
          .on('mouseout', () => {
            tooltip.style('opacity', '0');
          });

        /* --- Drag --- */
        const drag = d3
          .drag<SVGGElement, GraphNode>()
          .on('start', (event, d) => {
            if (!event.active) sim.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) sim.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          });

        nodeSel.call(drag);

        /* --- Force simulation --- */
        const sim = d3
          .forceSimulation<GraphNode>(nodes)
          .force(
            'link',
            d3
              .forceLink<GraphNode, GraphLink>(links)
              .id((d) => d.id)
              .distance((d) => {
                if (d.kind === 'second-degree') return 120;
                const src = d.source as GraphNode;
                return relationshipDistance(src.relationshipType ?? null);
              })
          )
          .force('charge', d3.forceManyBody().strength(-200))
          .force('center', d3.forceCenter(W / 2, H / 2))
          .force('collision', d3.forceCollide<GraphNode>().radius((d) => d.radius + 6))
          .on('tick', () => {
            linkSel
              .attr('x1', (d) => (d.source as GraphNode).x!)
              .attr('y1', (d) => (d.source as GraphNode).y!)
              .attr('x2', (d) => (d.target as GraphNode).x!)
              .attr('y2', (d) => (d.target as GraphNode).y!);

            nodeSel.attr('transform', (d) => `translate(${d.x},${d.y})`);
          });

        setLoading(false);
      } catch (err) {
        console.error('Network build error:', err);
        if (!destroyed) setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      }
    }

    build();
    return () => {
      destroyed = true;
    };
  }, [router]);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      <Nav />

      {loading && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 10,
        }}>
          <p style={{ fontSize: '16px', opacity: 0.6 }}>Loading network…</p>
        </div>
      )}

      {error && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 10,
        }}>
          <p style={{ color: '#ef4444', fontSize: '14px' }}>Error: {error}</p>
        </div>
      )}

      <svg ref={svgRef} style={{ width: '100%', height: '100%' }} />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        style={{
          position: 'fixed',
          opacity: 0,
          pointerEvents: 'none',
          background: 'var(--background, #fff)',
          border: '1px solid var(--border, #e2e8f0)',
          borderRadius: '8px',
          padding: '10px 14px',
          maxWidth: '260px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 1000,
          transition: 'opacity 0.15s',
        }}
      />

      {/* Legend */}
      <div
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          background: 'var(--background, #fff)',
          border: '1px solid var(--border, #e2e8f0)',
          borderRadius: '10px',
          padding: '14px 18px',
          fontSize: '11px',
          lineHeight: '1.8',
          zIndex: 20,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: '6px', fontSize: '12px' }}>Legend</div>
        <div>⬤ <span style={{ color: '#0284c7' }}>Blue</span> = Connected on Nexus</div>
        <div>⬤ <span style={{ color: '#475569' }}>Gray</span> = Your contacts</div>
        <div>⬤ <span style={{ color: '#94a3b8', fontSize: '9px' }}>Small gray</span> = 2nd-degree</div>
        <div style={{ marginTop: '6px' }}>
          <span style={{ color: '#dc2626' }}>━━</span> Red line = Mutual connection
        </div>
        <div>━━ Dark line = Your connection</div>
        <div style={{ color: '#94a3b8' }}>┈┈ Faint line = 2nd-degree link</div>
        <div style={{ marginTop: '6px' }}>
          Thicker line = more interaction
        </div>
        <div>Brighter line = more recent contact</div>
        <div>Bigger node = more connections</div>
        <div style={{ marginTop: '6px', color: '#64748b' }}>Double-click to re-center</div>
      </div>
    </div>
  );
}
