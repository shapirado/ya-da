import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Everything except the sign-in page (and its OAuth callback) needs a signed-in user.
const isPublic = createRouteMatcher(['/sign-in(.*)']);

export default clerkMiddleware(
  async (auth, req) => {
    if (!isPublic(req)) await auth.protect();
  },
  { signInUrl: '/sign-in' },
);

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
