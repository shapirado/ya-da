import { Notice } from './ui';

/** Shows ?ok= / ?err= messages left by server actions. */
export function Flash({ ok, err }: { ok?: string; err?: string }) {
  if (err) return <Notice tone="bad">{err}</Notice>;
  if (ok) return <Notice tone="ok">{ok}</Notice>;
  return null;
}
