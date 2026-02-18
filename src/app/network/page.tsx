'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import * as d3 from 'd3';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  hoverName: string;
  hoverDetail: string;
  group: 'you' | 'connected_user' | 'contact' | 'second_degree';
  radius: number;
}
interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  type: 'mutual' | 'direct' | 'second_degree';
}

const navLinks = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/resume', label: 'Resume' },
  { href: '/contacts', label: 'Contacts' },
  { href: '/network', label: 'Network' },
];

function TopNav() {
  const pathname = usePathname();
  return (
    <nav className="w-full border-b border-white/10 bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-4 flex items-center h-14 gap-6">
        <Link href="/dashboard" className="text-lg font-bold text-white tracking-wide mr-4">NEXUS</Link>
        {navLinks.map((l) => (
          <Link key={l.href} href={l.href}
            className={`text-sm transition-colors ${pathname === l.href ? 'text-white font-medium' : 'text-white/50 hover:text-white/80'}`}>
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

/* Muted palette */
const PALETTE: Record<string, string> = {
  you: '#C9A84C',        // muted gold
  connected_user: '#7B9EC4', // muted blue
  contact: '#A68BC1',    // muted purple
  second_degree: '#7A7A7A',  // muted gray
};

const LINK_COLORS: Record<string, string> = {
  mutual: '#7B9EC4',
  direct: '#555',
  second_degree: '#3a3a3a',
};

export default function NetworkPage() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const supabase = createClientComponentClient();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nodeCount, setNodeCount] = useState(0);
  const nodesRef = useRef<GraphNode[]>([]);
  const linksRef = useRef<GraphLink[]>([]);

  const renderGraph = useCallback(() => {
    const container = containerRef.current;
    const svg = svgRef.current;
    if (!container || !svg) return;

    const nodes = nodesRef.current;
    const links = linksRef.current;
    if (nodes.length === 0) return;

    const rect = container.getBoundingClientRect();
    const w = rect.width || window.innerWidth;
    const h = rect.height || (window.innerHeight - 56);

    if (w < 10 || h < 10) return;

    const root = d3.select(svg);
    root.selectAll('*').remove();
    root.attr('width', w).attr('height', h).attr('viewBox', `0 0 ${w} ${h}`);

    /* Tooltip */
    const prev = document.getElementById('graph-tooltip');
    if (prev) prev.remove();

    const tip = document.createElement('div');
    tip.id = 'graph-tooltip';
    tip.style.cssText =
      'position:absolute;pointer-events:none;background:rgba(10,10,10,0.92);' +
      'border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:8px 12px;' +
      'font-size:13px;color:#fff;opacity:0;z-index:50;white-space:nowrap;transition:opacity 0.15s;';
    container.appendChild(tip);

    const g = root.append('g');

    /* Zoom */
    const zm = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 5])
      .on('zoom', (e) => g.attr('transform', e.transform));
    root.call(zm);

    /* Simulation */
    const sim = d3.forceSimulation<GraphNode>(nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(links).id((d) => d.id).distance(120))
      .force('charge', d3.forceManyBody().strength(-350))
      .force('center', d3.forceCenter(w / 2, h / 2))
      .force('collision', d3.forceCollide<GraphNode>().radius((d) => d.radius + 20));

    /* Links */
    const linkSel = g.append('g').attr('class', 'links')
      .selectAll('line').data(links).join('line')
      .attr('stroke', (d) => LINK_COLORS[d.type] || '#444')
      .attr('stroke-width', (d) => d.type === 'mutual' ? 3 : 1.5)
      .attr('stroke-opacity', (d) => d.type === 'second_degree' ? 0.3 : 0.5);

    /* Nodes */
    const nodeGrp = g.append('g').attr('class', 'nodes')
      .selectAll<SVGCircleElement, GraphNode>('circle')
      .data(nodes).join('circle')
      .attr('r', (d) => d.radius)
      .attr('fill', (d) => PALETTE[d.group])
      .attr('stroke', 'rgba(255,255,255,0.08)')
      .attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .on('mouseover', function (_ev: any, d: GraphNode) {
        d3.select(this).attr('stroke', 'rgba(255,255,255,0.4)').attr('stroke-width', 2.5);
        let inner = `<div style="font-weight:600">${d.hoverName}</div>`;
        if (d.hoverDetail) inner += `<div style="opacity:0.65;font-size:12px">${d.hoverDetail}</div>`;
        tip.innerHTML = inner;
        tip.style.opacity = '1';
      })
      .on('mousemove', function (ev: any) {
        const r = container.getBoundingClientRect();
        tip.style.left = (ev.clientX - r.left + 14) + 'px';
        tip.style.top = (ev.clientY - r.top - 10) + 'px';
      })
      .on('mouseout', function () {
        d3.select(this).attr('stroke', 'rgba(255,255,255,0.08)').attr('stroke-width', 1.5);
        tip.style.opacity = '0';
      });

    /* Drag */
    const dragBehavior = d3.drag<SVGCircleElement, GraphNode>()
      .on('start', function (e, d) {
        if (!e.active) sim.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
      })
      .on('drag', function (e, d) { d.fx = e.x; d.fy = e.y; })
      .on('end', function (e, d) {
        if (!e.active) sim.alphaTarget(0);
        d.fx = null; d.fy = null;
      });
    nodeGrp.call(dragBehavior);

    /* Labels */
    const labelSel = g.append('g').attr('class', 'labels')
      .selectAll('text').data(nodes).join('text')
      .text((d) => d.label)
      .attr('text-anchor', 'middle')
      .attr('fill', '#ddd')
      .attr('font-size', (d) => d.group === 'you' ? 13 : d.group === 'connected_user' ? 12 : 10)
      .attr('font-weight', (d) => (d.group === 'you' || d.group === 'connected_user') ? '600' : '400')
      .attr('paint-order', 'stroke')
      .attr('stroke', '#0a0a0a')
      .attr('stroke-width', 3)
      .style('pointer-events', 'none');

    /* Tick */
    sim.on('tick', () => {
      linkSel
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);
      nodeGrp
        .attr('cx', (d: any) => d.x)
        .attr('cy', (d: any) => d.y);
      labelSel
        .attr('x', (d: any) => d.x)
        .attr('y', (d: any) => d.y + d.radius + 14);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function buildGraph() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setError('Not signed in'); setLoading(false); return; }
        const uid = user.id;

        const { data: profile } = await supabase
          .from('profiles').select('full_name, title, company').eq('id', uid).single();

        const { data: connections } = await supabase
          .from('connections').select('user_id, connected_user_id, status')
          .or(`user_id.eq.${uid},connected_user_id.eq.${uid}`).eq('status', 'accepted');

        const mutualUserIds = (connections || []).map(
          (c: any) => c.user_id === uid ? c.connected_user_id : c.user_id
        );

        let connectedProfiles: any[] = [];
        if (mutualUserIds.length > 0) {
          const { data } = await supabase
            .from('profiles').select('id, full_name, title, company').in('id', mutualUserIds);
          connectedProfiles = data || [];
        }

        const { data: myContacts } = await supabase
          .from('contacts').select('id, first_name, last_name, title, company, linked_profile_id')
          .eq('owner_id', uid);

        const { data: allContacts } = await supabase
          .from('contacts').select('id, owner_id, first_name, last_name, title, company, linked_profile_id');

        const { data: allConnections } = await supabase
          .from('connections').select('user_id, connected_user_id, status').eq('status', 'accepted');

        /* Second-degree connections */
        const connectedToMyConnections = new Set<string>();
        for (const conn of (allConnections || [])) {
          for (const muId of mutualUserIds) {
            if (conn.user_id === muId && conn.connected_user_id !== uid) {
              connectedToMyConnections.add(conn.connected_user_id);
            }
            if (conn.connected_user_id === muId && conn.user_id !== uid) {
              connectedToMyConnections.add(conn.user_id);
            }
          }
        }

        const fmtInitialLast = (first: string, last: string) => {
          const f = (first || '').trim();
          const l = (last || '').trim();
          if (!f && !l) return '?';
          if (!l) return f;
          return f.charAt(0) + '. ' + l;
        };

        const fmtDetail = (t: string | null, c: string | null) => {
          return [t, c].filter(Boolean).join(' · ') || '';
        };

        const nodes: GraphNode[] = [];
        const links: GraphLink[] = [];
        const nodeIds = new Set<string>();

        /* You node */
        const youName = profile?.full_name || 'You';
        nodes.push({
          id: uid, label: youName, hoverName: youName,
          hoverDetail: fmtDetail(profile?.title, profile?.company),
          group: 'you', radius: 28,
        });
        nodeIds.add(uid);

        /* Connected users (mutual) */
        for (const cp of connectedProfiles) {
          nodes.push({
            id: cp.id, label: cp.full_name || 'User',
            hoverName: cp.full_name || 'User',
            hoverDetail: fmtDetail(cp.title, cp.company),
            group: 'connected_user', radius: 20,
          });
          nodeIds.add(cp.id);
          links.push({ source: uid, target: cp.id, type: 'mutual' });
        }

        /* My contacts */
        for (const c of (myContacts || [])) {
          const nid = 'contact-' + c.id;
          if (nodeIds.has(nid)) continue;
          if (c.linked_profile_id && nodeIds.has(c.linked_profile_id)) continue;
          const full = ((c.first_name || '') + ' ' + (c.last_name || '')).trim();
          nodes.push({
            id: nid, label: fmtInitialLast(c.first_name, c.last_name),
            hoverName: full || '?',
            hoverDetail: fmtDetail(c.title, c.company),
            group: 'contact', radius: 12,
          });
          nodeIds.add(nid);
          links.push({ source: uid, target: nid, type: 'direct' });
        }

        /* Second-degree contacts */
        for (const c of (allContacts || [])) {
          if (c.owner_id === uid) continue;
          if (!mutualUserIds.includes(c.owner_id)) continue;
          if (c.linked_profile_id === uid) continue;
          const nid = 'contact-' + c.id;
          if (nodeIds.has(nid)) continue;
          if (c.linked_profile_id && nodeIds.has(c.linked_profile_id)) {
            links.push({ source: c.owner_id, target: c.linked_profile_id, type: 'second_degree' });
            continue;
          }
          const isConn = c.linked_profile_id && connectedToMyConnections.has(c.linked_profile_id);
          const full = ((c.first_name || '') + ' ' + (c.last_name || '')).trim();
          let lbl: string;
          let hName: string;
          let hDetail: string;
          if (isConn) {
            lbl = fmtInitialLast(c.first_name, c.last_name);
            hName = full || '?';
            hDetail = fmtDetail(c.title, c.company);
          } else {
            lbl = c.title || '?';
            hName = c.title || '?';
            hDetail = c.company || '';
          }
          nodes.push({
            id: nid, label: lbl, hoverName: hName,
            hoverDetail: hDetail, group: 'second_degree', radius: 9,
          });
          nodeIds.add(nid);
          links.push({ source: c.owner_id, target: nid, type: 'second_degree' });
        }

        if (cancelled) return;

        nodesRef.current = nodes;
        linksRef.current = links;
        setNodeCount(nodes.length);
        setLoading(false);
      } catch (err: any) {
        if (!cancelled) {
          console.error('Network graph error:', err);
          setError(err.message || 'Failed to load network');
          setLoading(false);
        }
      }
    }

    buildGraph();
    return () => { cancelled = true; };
  }, [supabase]);

  /* Render when data is ready or on resize */
  useEffect(() => {
    if (loading || nodeCount === 0) return;

    /* Small delay to ensure container has laid out */
    const t = setTimeout(() => renderGraph(), 50);

    const handleResize = () => renderGraph();
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', handleResize);
    };
  }, [loading, nodeCount, renderGraph]);

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a] text-white overflow-hidden">
      <TopNav />

      {/* Legend */}
      <div className="flex items-center gap-5 px-4 py-2 text-xs text-white/50 border-b border-white/5">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full" style={{ background: PALETTE.you }} />
          You
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full" style={{ background: PALETTE.connected_user }} />
          Connections
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full" style={{ background: PALETTE.contact }} />
          Contacts
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full" style={{ background: PALETTE.second_degree }} />
          2nd Degree
        </span>
      </div>

      {/* Graph area */}
      <div
        ref={containerRef}
        className="flex-1 relative"
        style={{ minHeight: 0 }}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#C9A84C]" />
              <span className="text-white/40 text-sm">Loading network…</span>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-center">
              <p className="text-red-400 text-sm mb-2">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="text-xs text-white/50 underline hover:text-white/80"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {!loading && !error && nodeCount === 0 && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-center text-white/40">
              <p className="text-lg mb-2">No network data yet</p>
              <p className="text-sm">Add contacts or connect with other users to see your graph.</p>
            </div>
          </div>
        )}

        <svg
          ref={svgRef}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        />
      </div>
    </div>
  );
}
