'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SignOutButton } from '@clerk/nextjs';

const ITEMS = [
  { href: '/', label: 'לוח בקרה', icon: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></> },
  { href: '/children', label: 'ילדים', icon: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5" /><circle cx="17" cy="9" r="2.5" /><path d="M17 14c2.4 0 4 1.6 4.6 4.5" /></> },
  { href: '/activities', label: 'חוגים וקייטנות', icon: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></> },
  { href: '/reminders', label: 'תזכורות וואטסאפ', icon: <path d="M4 19l1.3-3.8A8 8 0 1 1 8.6 18z" /> },
  { href: '/payments', label: 'תשלומים וקבלות', icon: <><path d="M6 3h9l4 4v14H6z" /><path d="M9 12h7M9 16h5" /></> },
];

export function Sidebar({ morningOk, email }: { morningOk: boolean; email: string }) {
  const path = usePathname();
  return (
    <nav aria-label="ניווט ראשי" className="flex-[1_1_220px] max-w-full bg-nav text-white rounded-[20px] px-3.5 py-6 flex flex-col gap-1 self-start md:sticky md:top-4">
      <div className="flex items-center gap-3 px-2 pb-5">
        <img src="/logo.png" alt="לוגו סטודיו ידיים" className="w-12 h-12 rounded-[14px] object-cover flex-none" />
        <div className="flex flex-col">
          <span className="font-bold text-[17px]">סטודיו ידיים</span>
          <span className="text-xs text-[#B9B7C2]">ניהול תשלומים</span>
        </div>
      </div>
      <div className="flex flex-row flex-wrap md:flex-col gap-1">
        {ITEMS.map((it) => {
          const active = it.href === '/' ? path === '/' : path.startsWith(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-2.5 min-h-11 px-3 rounded-xl no-underline ${active ? 'bg-nav-active text-white font-medium' : 'text-[#D9D7E0] hover:bg-nav-active/60'}`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>{it.icon}</svg>
              {it.label}
            </Link>
          );
        })}
      </div>
      <div className="mt-6 p-3.5 rounded-[14px] bg-nav-active flex flex-col gap-1.5" title={morningOk ? 'אני מחוברת ל-Morning ויוצרת בו לקוחות וקבלות' : 'חסרים מפתחות Morning במשתני הסביבה'}>
        <span className="text-xs text-[#B9B7C2]">חיבור ל-Morning</span>
        <span className="flex items-center gap-2 text-sm">
          <span className={`w-2 h-2 rounded-full ${morningOk ? 'bg-[#4ADE80]' : 'bg-[#F87171]'}`} />
          {morningOk ? 'מחוברת' : 'לא מוגדר'}
        </span>
      </div>
      <div className="mt-2 px-2 flex items-center justify-between gap-2 text-xs text-[#B9B7C2]">
        <span dir="ltr" className="truncate" title={email}>{email}</span>
        <SignOutButton redirectUrl="/sign-in">
          <button type="button" className="min-h-11 px-2 bg-transparent border-0 text-[#D9D7E0] hover:text-white cursor-pointer text-sm" title="אנתק אותך מהמערכת">יציאה</button>
        </SignOutButton>
      </div>
    </nav>
  );
}
