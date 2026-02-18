'use client';

import { useEffect, useRef, useState } from 'react';
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

export default function NetworkPage() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const supabase = createClientComponentClient();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    buildGraph().then(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function buildGraph() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
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
      return [t, c].filter(Boolean).join(' \u00b7 ') || '';
    };

    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const nodeIds = new Set<string>();

    const youName = profile?.full_name || 'You';
    nodes.push({
      id: uid, label: youName, hoverName: youName,
      hoverDetail: fmtDetail(profile?.title, profile?.company),
      group: 'you', radius: 28,
    });
    nodeIds.add(uid);

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

    render(nodes, links);
  }

  function render(nodes: GraphNode[], links: GraphLink[]) {
    const container = containerRef.current;
    const svg = svgRef.current;
    if (!container || !svg) return;

    const w = container.clientWidth;
    const h = container.clientHeight;

    const palette: Record<string, string> = {
      you: '#FBBF24',
      connected_user: '#60A5FA',
      contact: '#C084FC',
      second_degree: '#9CA3AF',
    };

    const root = d3.select(svg);
    root.selectAll('*').remove();
    root.attr('width', w).attr('height', h);

    const prev = document.getElementById('graph-tooltip');
    if (prev) prev.remove();

    const tip = document.createElement('div');
    tip.id = 'graph-tooltip';
    tip.style.cssText = 'position:absolute;pointer-events:none;background:rgba(0,0,0,0.85);border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:8px 12px;font-size:13px;color:#fff;opacity:0;z-index:50;white-space:nowrap;transition:opacity 0.15s;';
    container.appendChild(tip);

    const g = root.append('g');

    const zm = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on('zoom', (e) => g.attr('transform', e.transform));
    root.call(zm);

    const sim = d3.forceSimulation<GraphNode>(nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(links).id((d) => d.id).distance(110))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(w / 2, h / 2))
      .force('collision', d3.forceCollide<GraphNode>().radius((d) => d.radius + 25));

    const linkSel = g.append('g').selectAll('line').data(links).join('line')
      .attr('stroke', (d) => d.type === 'mutual' ? '#60A5FA' : '#444')
      .attr('stroke-width', (d) => d.type === 'mutual' ? 4 : 2)
      .attr('stroke-opacity', (d) => d.type === 'second_degree' ? 0.4 : 0.6);

    const nodeSel = g.append('g').selectAll('circle').data(nodes).join('circle')
      .attr('r', (d) => d.radius)
      .attr('fill', (d) => palette[d.group])
      .attr('stroke', '#000')
      .attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .on('mouseover', function(_ev: any, d: GraphNode) {
        let inner = '<div style="font-weight:600">' + d.hoverName + '</div>';
        if (d.hoverDetail) inner += '<div style="opacity:0.7;font-size:12px">' + d.hoverDetail + '</div>';
        tip.innerHTML = inner;
        tip.style.opacity = '1';
      })
      .on('mousemove', function(ev: any) {
        const r = container.getBoundingClientRect();
        tip.style.left = (ev.clientX - r.left + 14) + 'px';
        tip.style.top = (ev.clientY - r.top - 10) + 'px';
      })
      .on('mouseout', function() { tip.style.opacity = '0'; })
      .call(
        d3.drag<SVGCircleElement, GraphNode>()
          .on('start', function(e, d) {
            if (!e.active) sim.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
          })
          .on('drag', function(e, d) { d.fx = e.x; d.fy = e.y; })
          .on('end', function(e, d) {
            if (!e.active) sim.alphaTarget(0);
            d.fx = null; d.fy = null;
          })
      );

    const labelSel = g.append('g').selectAll('text').data(nodes).join('text')
      .text((d) => d.label)
      .attr('text-anchor', 'middle')
      .attr('fill', '#fff')
      .attr('font-size', (d) => d.group === 'you' ? 14 : d.group === 'connected_user' ? 13 : 11)
      .attr('font-weight', (d) => (d.group === 'you' || d.group === 'connected_user') ? '600' : '400')
      .attr('paint-order', 'stroke')
      .attr('stroke', '#000')
      .attr('stroke-width', 3)
      .attr('stroke-linecap', 'round')
      .attr('stroke-linejoin', 'round')
      .style('pointer-events', 'none');

    sim.on('tick', function() {
      linkSel
        .attr('x1', (d) => (d.source as GraphNode).x!)
        .attr('y1', (d) => (d.source as GraphNode).y!)
        .attr('x2', (d) => (d.target as GraphNode).x!)
        .attr('y2', (d) => (d.target as GraphNode).y!);
      nodeSel
        .attr('cx', (d) => d.x!)
        .attr('cy', (d) => d.y!);
      labelSel
        .attr('x', (d) => d.x!)
        .attr('y', (d) => d.y! + d.radius + 16);
    });
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      <TopNav />
      <div ref={containerRef} className="flex-1 relative" style={{ minHeight: 'calc(100vh - 56px)' }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-white/50 text-sm">Loading network...</div>
          </div>
        )}
        <svg ref={svgRef} className="w-full h-full" />
      </div>
    </div>
  );
}