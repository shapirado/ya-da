import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { isPublicRoute } from "@/src/lib/auth/routes";

// Capture the handler middleware.ts passes to clerkMiddleware so it can be
// driven directly with a fake `auth` object (no Clerk keys / network).
type Handler = (auth: unknown, req: NextRequest) => Promise<unknown>;
const captured: { handler?: Handler } = {};

vi.mock("@clerk/nextjs/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@clerk/nextjs/server")>();
  return {
    ...actual,
    clerkMiddleware: (handler: Handler) => {
      captured.handler = handler;
      return handler;
    },
  };
});

function fakeAuth() {
  const protect = vi.fn(async () => ({ userId: "user_1" }));
  const auth = Object.assign(vi.fn(async () => ({ userId: "user_1" })), { protect });
  return { auth, protect };
}

function req(path: string, method = "GET"): NextRequest {
  return new NextRequest(`http://localhost${path}`, { method });
}

describe("middleware route protection", () => {
  beforeEach(async () => {
    await import("./middleware");
  });

  test("the Morning webhook path is a public route", () => {
    expect(isPublicRoute(req("/api/webhooks/morning", "POST"))).toBe(true);
    expect(isPublicRoute(req("/sign-in"))).toBe(true);
    expect(isPublicRoute(req("/dashboard"))).toBe(false);
    expect(isPublicRoute(req("/api/other"))).toBe(false);
  });

  test("POST /api/webhooks/morning never hits auth.protect()", async () => {
    const { auth, protect } = fakeAuth();
    await captured.handler!(auth, req("/api/webhooks/morning", "POST"));
    expect(protect).not.toHaveBeenCalled();
  });

  test("protected app routes still go through auth.protect()", async () => {
    const { auth, protect } = fakeAuth();
    await captured.handler!(auth, req("/dashboard"));
    expect(protect).toHaveBeenCalledTimes(1);
  });
});
