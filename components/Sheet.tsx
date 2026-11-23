import Link from 'next/link';

/**
 * Phone bottom sheet (md:hidden). Closing is a link (closeHref) or a button (onClose), so it works
 * both for URL-driven panels on server pages and for client state.
 */
export function Sheet({ title, marker, closeHref, onClose, children, footer }: {
  title: React.ReactNode;
  marker?: React.ReactNode;
  closeHref?: string;
  onClose?: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const x = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>;
  const closeCls = 'w-11 h-11 rounded-xl border-0 bg-page text-ink flex items-center justify-center cursor-pointer no-underline flex-none';
  return (
    <div className="md:hidden fixed inset-0 z-40 bg-[rgba(23,22,28,0.45)] flex flex-col justify-end">
      {closeHref && <Link href={closeHref} aria-hidden tabIndex={-1} className="flex-1" />}
      {onClose && <button type="button" aria-hidden tabIndex={-1} onClick={onClose} className="flex-1 border-0 bg-transparent" />}
      <section role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} className="bg-white rounded-t-[22px] max-h-[78vh] flex flex-col">
        <div className="flex-none flex items-center gap-2.5 px-4 pt-3.5 pb-2">
          {marker}
          <h2 className="m-0 text-lg flex-1 flex items-center gap-2.5">{title}</h2>
          {closeHref
            ? <Link href={closeHref} aria-label="סגירה" className={closeCls}>{x}</Link>
            : <button type="button" onClick={onClose} aria-label="סגירה" className={closeCls}>{x}</button>}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-4">{children}</div>
        {footer && <div className="flex-none px-4 pt-3 pb-7 text-[13px] text-muted">{footer}</div>}
        {!footer && <div className="h-6 flex-none" />}
      </section>
    </div>
  );
}
