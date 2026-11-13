'use client';

import { useState, useTransition } from 'react';
import { logReminder } from '@/app/actions';
import { WhatsAppIcon } from './ui';

/** Opens WhatsApp with the prepared text and records that a reminder was sent. */
export function WaButton({ href, payerId, total, message, label = 'פתיחה בוואטסאפ', title, className = 'btn-wa' }: {
  href: string | null; payerId: string; total: number; message: string; label?: string; title?: string; className?: string;
}) {
  const [, start] = useTransition();
  if (!href) return <span className="text-sm text-muted" title="אין למשלם/ת מספר טלפון ב-Morning">אין טלפון</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      title={title || 'אפתח את WhatsApp עם ההודעה המוכנה'}
      className={`${className} no-underline`}
      onClick={() => start(() => logReminder(payerId, total, message))}
    >
      <WhatsAppIcon />{label}
    </a>
  );
}

export function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn-secondary"
      title="אעתיק את ההודעה ללוח"
      onClick={async () => { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1800); }}
    >
      {done ? 'העתקתי ✓' : 'העתקה'}
    </button>
  );
}
