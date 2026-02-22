'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

const NAV_ITEMS = [
  { href: '/resume',    label: 'Profile' },
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

  // Persist the current tab whenever it changes
  useEffect(() => {
    if (NAV_ITEMS.some(item => item.href === pathname)) {
      localStorage.setItem(LS_LAST_TAB, pathname);
    }
  }, [pathname]);

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
