import { clerkClient } from "@clerk/nextjs/server";

// Ya-Da is a single-user app (spec: only Dalia signs in). Enforced here in
// code, independently of however the Clerk dashboard is configured.
export const ALLOWED_EMAILS = ["shapirado@gmail.com"];

export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ALLOWED_EMAILS.includes(email.trim().toLowerCase());
}

// The default Clerk session token carries no email, so the user record is
// looked up once per user id; positive results are cached for the life of
// the middleware instance to avoid a Clerk API call on every request.
const allowedUserIds = new Set<string>();

export async function isAllowedUser(userId: string): Promise<boolean> {
  if (allowedUserIds.has(userId)) return true;

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const allowed = user.emailAddresses.some(
    (address) =>
      address.verification?.status === "verified" && isAllowedEmail(address.emailAddress),
  );

  if (allowed) allowedUserIds.add(userId);
  return allowed;
}

export function forbiddenResponse(): Response {
  return new Response(
    '<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>Ya-Da</title></head>' +
      "<body><p>אין לחשבון הזה הרשאת גישה ל-Ya-Da.</p></body></html>",
    { status: 403, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}
