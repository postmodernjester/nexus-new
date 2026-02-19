'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/network',   label: 'Network' },
  { href: '/contacts',  label: 'Contacts' },
  { href: '/resume',    label: 'My Profile' },
];

export default function Nav() {
  const pathname = usePathname();

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
        href="/dashboard"
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
