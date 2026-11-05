import { createRouteMatcher } from "@clerk/nextjs/server";

// Routes that bypass Clerk auth entirely.
// - /sign-in: the login page itself.
// - /api/webhooks/*: server-to-server deliveries (e.g. Morning). They carry
//   no Clerk session; each handler authenticates the sender itself (Morning:
//   HMAC signature over the raw body).
export const PUBLIC_ROUTE_PATTERNS = ["/sign-in(.*)", "/api/webhooks/(.*)"];

export const isPublicRoute = createRouteMatcher(PUBLIC_ROUTE_PATTERNS);
