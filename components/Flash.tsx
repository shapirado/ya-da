import { Notice } from './ui';

/** Shows ?ok= / ?err= messages left by server actions. */
export function Flash({ ok, err }: { ok?: string; err?: string }) {
  // both can come back from one save (e.g. details saved, Morning update failed)
  if (err && ok) return <><Notice tone="bad">{err}</Notice><Notice tone="ok">{ok}</Notice></>;
  if (err) return <Notice tone="bad">{err}</Notice>;
  if (ok) return <Notice tone="ok">{ok}</Notice>;
  return null;
}
