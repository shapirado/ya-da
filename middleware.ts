import { clerkMiddleware } from "@clerk/nextjs/server";
import { isPublicRoute } from "@/src/lib/auth/routes";
import { forbiddenResponse, isAllowedUser } from "@/src/lib/auth/access";

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;

  // Signed-out visitors are redirected to sign-in; signed-in accounts other
  // than the single allowed one get a 403.
  const { userId } = await auth.protect();
  if (!(await isAllowedUser(userId))) {
    return forbiddenResponse();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
