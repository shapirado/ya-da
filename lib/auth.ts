import 'server-only';
import { auth, currentUser } from '@clerk/nextjs/server';

/**
 * Only emails listed in ALLOWED_EMAILS (comma-separated) may use the app.
 * Signing in with Google proves who someone is; this decides whether they get in.
 * (You can also set an allowlist in the Clerk dashboard → Restrictions.)
 */
function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export type Access = { ok: true; email: string } | { ok: false; reason: 'signed-out' | 'not-allowed'; email?: string };

export async function checkAccess(): Promise<Access> {
  const { userId } = await auth();
  if (!userId) return { ok: false, reason: 'signed-out' };
  const user = await currentUser();
  const emails = (user?.emailAddresses || [])
    .filter((e) => e.verification?.status === 'verified')
    .map((e) => e.emailAddress.toLowerCase());
  const allow = allowedEmails();
  const match = emails.find((e) => allow.includes(e));
  if (match) return { ok: true, email: match };
  return { ok: false, reason: 'not-allowed', email: emails[0] };
}

/** Call at the top of every server action — actions can be invoked directly, outside any page. */
export async function requireAccess(): Promise<void> {
  const a = await checkAccess();
  if (!a.ok) throw new Error('אין הרשאה');
}
