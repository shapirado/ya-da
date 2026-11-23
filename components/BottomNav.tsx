'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS, isActive } from './navItems';

/** Phone tab bar (under 768px); the sidebar takes over from md up. */
export function BottomNav() {
  const path = usePathname();
  // full-screen forms with their own bottom bar
  if (path === '/children/new') return null;
  return (
    <nav aria-label="ניווט ראשי" className="md:hidden fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 bg-white border-t border-line px-1 pt-1.5 pb-[max(12px,env(safe-area-inset-bottom))]">
      {NAV_ITEMS.map((it) => {
        const on = isActive(it.href, path);
        return (
          <Link key={it.href} href={it.href} aria-current={on ? 'page' : undefined}
            className={`flex flex-col items-center justify-center gap-[3px] min-h-12 no-underline text-[11px] ${on ? 'text-accent font-semibold' : 'text-muted'}`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={on ? 1.9 : 1.8} aria-hidden>{it.icon}</svg>
            {it.short}
          </Link>
        );
      })}
    </nav>
  );
}
