'use client';

import { useFormStatus } from 'react-dom';

/** Submit button that switches to a feminine first-person loading label ("שומרת…"). */
export function SubmitButton({
  children, pending, className = 'btn-primary', title, name, value,
}: { children: React.ReactNode; pending: string; className?: string; title?: string; name?: string; value?: string }) {
  const { pending: busy } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={busy} title={title} name={name} value={value} aria-busy={busy}>
      {busy ? <><span className="spinner" aria-hidden />{pending}</> : children}
    </button>
  );
}
