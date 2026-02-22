'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const NAV_ITEMS = [
  { href: '/resume',    label: 'Resume' },
  { href: '/contacts',  label: 'Contacts' },
  { href: '/network',   label: 'Network' },
  { href: '/chronicle', label: 'Chronicle' },
  { href: '/dashboard', label: 'Dashboard' },
];

const LS_LAST_TAB = 'nexus_last_tab';

export function getLastVisitedTab(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(LS_LAST_TAB) || '/dashboard';
  }
  return '/dashboard';
}

export default function Nav() {
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState(0);

  // Persist the current tab whenever it changes
  useEffect(() => {
    if (NAV_ITEMS.some(item => item.href === pathname)) {
      localStorage.setItem(LS_LAST_TAB, pathname);
    }
  }, [pathname]);

  // Fetch pending invitation count
  useEffect(() => {
    async function fetchPending() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { count } = await supabase
        .from('link_invitations')
        .select('id', { count: 'exact', head: true })
        .eq('to_user_id', user.id)
        .eq('status', 'pending');
      setPendingCount(count || 0);
    }
    fetchPending();
  }, [pathname]);

  const worldActive = pathname?.startsWith('/world');

  return (
    <nav
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 20px',
        background: '#0f172a',
        borderBottom: '1px solid #1e293b',
        zIndex: 30,
        position: 'relative',
      }}
    >
      {/* Left side: NEXUS logo + globe icon */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <Link
          href={getLastVisitedTab()}
          style={{
            fontSize: '18px',
            fontWeight: 'bold',
            color: '#fff',
            textDecoration: 'none',
            letterSpacing: '-0.5px',
          }}
        >
          NEXUS
        </Link>
        <Link
          href="/world"
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: worldActive ? '#fff' : 'transparent',
            color: worldActive ? '#0f172a' : '#94a3b8',
            textDecoration: 'none',
            transition: 'all 0.15s',
          }}
          title="World"
        >
          {/* Globe SVG icon */}
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          {/* Pending invitation badge */}
          {pendingCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: -2,
                right: -2,
                background: '#ef4444',
                color: '#fff',
                fontSize: '9px',
                fontWeight: 700,
                borderRadius: '50%',
                width: 16,
                height: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1,
              }}
            >
              {pendingCount > 9 ? '9+' : pendingCount}
            </span>
          )}
        </Link>
      </div>

      {/* Right side: nav items */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 500,
                textDecoration: 'none',
                color: active ? '#0f172a' : '#94a3b8',
                background: active ? '#fff' : 'transparent',
                transition: 'all 0.15s',
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
