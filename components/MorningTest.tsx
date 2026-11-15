'use client';

import { useState, useTransition } from 'react';
import { testMorning } from '@/app/actions';
import type { MorningTestResult } from '@/lib/morning';

/** Diagnostic button: runs a customer search against Morning and shows the raw response. */
export function MorningTest() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<MorningTestResult | null>(null);

  const run = () => start(async () => {
    try {
      setResult(await testMorning());
    } catch (e) {
      setResult({ tokenSource: '—', url: '—', status: null, body: `הפעולה נכשלה: ${(e as Error).message}` });
    }
  });

  const ok = result?.status != null && result.status >= 200 && result.status < 300;

  return (
    <div className="mt-2 flex flex-col gap-2">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        title="אחפש לקוחות ב-Morning ואציג את התשובה"
        className="min-h-11 px-3 rounded-xl border border-[#5C5A66] bg-transparent text-white text-sm cursor-pointer hover:bg-nav-active disabled:opacity-60 disabled:cursor-default"
      >
        {pending ? 'בודקת…' : 'בדיקת חיבור'}
      </button>
      {result && (
        <div className="rounded-xl bg-nav-active p-3 flex flex-col gap-1.5 text-xs" aria-live="polite">
          <span className="flex items-center gap-2 text-sm">
            <span className={`w-2 h-2 rounded-full ${ok ? 'bg-[#4ADE80]' : 'bg-[#F87171]'}`} />
            {result.status != null ? `HTTP ${result.status}` : 'ללא תשובה'}
          </span>
          <span dir="ltr" className="text-[#B9B7C2] break-all text-left">POST {result.url}</span>
          <span className="text-[#B9B7C2] break-all">טוקן: <span dir="ltr">{result.tokenSource}</span></span>
          <pre dir="ltr" className="m-0 max-h-80 overflow-auto whitespace-pre-wrap break-all text-left text-[11px] leading-snug bg-black/30 rounded-lg p-2">{result.body}</pre>
        </div>
      )}
    </div>
  );
}
