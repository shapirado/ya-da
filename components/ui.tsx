import type { PaymentMethod } from '@/lib/types';

export function Dot({ color, size = 10, square = false }: { color: string; size?: number; square?: boolean }) {
  return <span aria-hidden className="inline-block flex-none" style={{ width: size, height: size, borderRadius: square ? 3 : size, background: color }} />;
}

/**
 * Page title. `children` are the desktop actions; on phones they hide and `mobile` (small icon
 * buttons) shows instead, and `lead` (a back link or a logo) sits before the title.
 */
export function PageHeader({ title, sub, children, mobile, lead }: { title: React.ReactNode; sub?: React.ReactNode; children?: React.ReactNode; mobile?: React.ReactNode; lead?: React.ReactNode }) {
  return (
    <header className="flex flex-nowrap md:flex-wrap items-center justify-between gap-3 px-1 py-1 md:py-2">
      {lead && <span className="md:hidden flex-none flex">{lead}</span>}
      <div className="flex-1 md:flex-none min-w-0 flex flex-col md:gap-1">
        <h1 className="m-0 text-[22px] md:text-[30px] font-bold leading-tight">{title}</h1>
        {sub && <span className="text-muted text-[13px] md:text-[15px]">{sub}</span>}
      </div>
      {mobile && <div className="md:hidden flex-none flex items-center gap-2">{mobile}</div>}
      {children && <div className="hidden md:flex flex-wrap items-center gap-2.5">{children}</div>}
    </header>
  );
}

/** Square 44px icon button for PageHeader's `mobile` slot. */
export const iconBtn = 'w-11 h-11 rounded-[14px] bg-accent text-white flex items-center justify-center flex-none no-underline border-0 cursor-pointer';
export function PlusIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><path d="M12 5v14M5 12h14" /></svg>;
}
export function BackIcon() {
  // RTL: "back" points right
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M9 6l6 6-6 6" /></svg>;
}

const STATUS = {
  paid: { label: 'שולם', cls: 'bg-ok-soft text-ok' },
  deposit: { label: 'מקדמה', cls: 'bg-accent-soft text-accent-dark' },
  partial: { label: 'שולם חלקית', cls: 'bg-warn-soft text-warn' },
  unpaid: { label: 'לא שולם', cls: 'bg-bad-soft text-bad' },
} as const;

export function StatusChip({ status }: { status: 'paid' | 'deposit' | 'partial' | 'unpaid' }) {
  const s = STATUS[status];
  return <span className={`chip ${s.cls}`}>{s.label}</span>;
}

export const METHOD_LABEL: Record<string, string> = {
  bit: 'ביט', paybox: 'פייבוקס', bank: 'העברה בנקאית', cash: 'מזומן', credit: 'אשראי', other: 'אחר',
};

export function MethodIcon({ method, size = 22 }: { method: PaymentMethod | string | null; size?: number }) {
  if (method === 'bit') return <img src="/bit.png" alt="" width={size} height={size} className="object-contain flex-none" />;
  if (method === 'paybox') return <img src="/paybox.png" alt="" width={size} height={size} className="object-contain flex-none" />;
  return (
    <svg width={size - 2} height={size - 2} viewBox="0 0 24 24" fill="none" stroke="#5C5A66" strokeWidth="1.8" aria-hidden className="flex-none">
      {method === 'cash' ? <><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></> : <path d="M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" />}
    </svg>
  );
}

export function Method({ method }: { method: string | null }) {
  return (
    <span className="inline-flex items-center gap-2">
      <MethodIcon method={method} />
      {METHOD_LABEL[method || 'other'] || method}
    </span>
  );
}

export function isGirl(gender: string | null | undefined): boolean {
  const g = (gender || '').trim().toLowerCase();
  return ['בת', 'נקבה', 'f', 'female', 'girl'].includes(g);
}

export function GenderIcon({ gender, size = 36 }: { gender: string | null | undefined; size?: number }) {
  const girl = isGirl(gender);
  return girl ? (
    <svg width={size} height={size} viewBox="0 0 36 36" role="img" aria-label="בת" className="flex-none">
      <circle cx="18" cy="18" r="18" fill="#FBE3EE" /><circle cx="8.5" cy="14" r="4.5" fill="#B83A72" /><circle cx="27.5" cy="14" r="4.5" fill="#B83A72" />
      <circle cx="18" cy="20" r="9" fill="#F3CFB4" /><path d="M9 18c0-6 4-9.5 9-9.5s9 3.5 9 9.5c-2.5-2.5-5.5-3.5-9-3.5s-6.5 1-9 3.5z" fill="#6B3424" />
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 36 36" role="img" aria-label="בן" className="flex-none">
      <circle cx="18" cy="18" r="18" fill="#E2E8FB" /><circle cx="18" cy="20" r="9" fill="#F3CFB4" />
      <path d="M9 17.5c0-5.5 4-8.5 9-8.5s9 3 9 8.5c-1.5-1-3.5-2.5-6-2.5-1 1.2-3.5 2-6 2s-4.5-.3-6 .5z" fill="#3E2A20" />
    </svg>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'ok' | 'warn' | 'bad'; children: React.ReactNode }) {
  const cls = { info: 'bg-accent-soft text-accent-dark', ok: 'bg-ok-soft text-ok', warn: 'bg-warn-soft text-warn', bad: 'bg-bad-soft text-bad' }[tone];
  return <div role="status" className={`flex items-center gap-2.5 px-4 py-3 rounded-[14px] text-sm ${cls}`}>{children}</div>;
}

export function WhatsAppIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M4 19l1.3-3.8A8 8 0 1 1 8.6 18z" /><path d="M9 9.5c.3 2 2 3.8 4 4.4" />
    </svg>
  );
}

export const SWATCHES = ['#E4572E', '#2A9D8F', '#3446C4', '#D9901E', '#8E5BD9', '#C2417A', '#1F8A70', '#5C5A66'];
