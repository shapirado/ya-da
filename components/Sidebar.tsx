'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SignOutButton } from '@clerk/nextjs';
import { MorningTest } from './MorningTest';
import { NAV_ITEMS, isActive } from './navItems';


export function Sidebar({ morningOk, email }: { morningOk: boolean; email: string }) {
  const path = usePathname();
  return (
    <nav aria-label="ניווט ראשי" className="hidden md:flex flex-[1_1_220px] max-w-full bg-nav text-white rounded-[20px] px-3.5 py-6 flex-col gap-1 self-start md:sticky md:top-4">
      <div className="flex items-center gap-3 px-2 pb-5">
        <img src="/logo.png" alt="לוגו סטודיו ידיים" className="w-12 h-12 rounded-[14px] object-cover flex-none" />
        <div className="flex flex-col">
          <span className="font-bold text-[17px]">סטודיו ידיים</span>
          <span className="text-xs text-[#B9B7C2]">ניהול תשלומים</span>
        </div>
      </div>
      <div className="flex flex-row flex-wrap md:flex-col gap-1">
        {NAV_ITEMS.map((it) => {
          const active = isActive(it.href, path);
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
      <MorningTest />
      <div className="mt-2 px-2 flex items-center justify-between gap-2 text-xs text-[#B9B7C2]">
        <span dir="ltr" className="truncate" title={email}>{email}</span>
        <SignOutButton redirectUrl="/sign-in">
          <button type="button" className="min-h-11 px-2 bg-transparent border-0 text-[#D9D7E0] hover:text-white cursor-pointer text-sm" title="אנתק אותך מהמערכת">יציאה</button>
        </SignOutButton>
      </div>
    </nav>
  );
}
