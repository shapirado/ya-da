'use client';

import { useState } from 'react';
import { SignOutButton } from '@clerk/nextjs';
import { MorningTest } from './MorningTest';
import { Sheet } from './Sheet';

/** Phone only: what the desktop sidebar shows under the links (Morning status and test, account). */
export function MobileMenu({ morningOk, email }: { morningOk: boolean; email: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="תפריט — חיבור ל-Morning וחשבון" aria-expanded={open}
        className="md:hidden w-11 h-11 rounded-[14px] border border-line-strong bg-white text-ink flex items-center justify-center cursor-pointer flex-none">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>
      {open && (
        <Sheet title="חיבור וחשבון" onClose={() => setOpen(false)}>
          <div className="flex flex-col gap-3 pb-2">
            {/* MorningTest is styled for the dark sidebar, so it sits on the same dark card here */}
            <div className="rounded-[14px] bg-nav text-white p-3.5 flex flex-col gap-1.5">
              <span className="text-xs text-[#B9B7C2]">חיבור ל-Morning</span>
              <span className="flex items-center gap-2 text-sm">
                <span className={`w-2 h-2 rounded-full ${morningOk ? 'bg-[#4ADE80]' : 'bg-[#F87171]'}`} />
                {morningOk ? 'מחוברת' : 'לא מוגדר'}
              </span>
              <MorningTest />
            </div>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span dir="ltr" className="truncate text-muted" title={email}>{email}</span>
              <SignOutButton redirectUrl="/sign-in">
                <button type="button" className="btn-secondary flex-none" title="אנתק אותך מהמערכת">יציאה</button>
              </SignOutButton>
            </div>
          </div>
        </Sheet>
      )}
    </>
  );
}
