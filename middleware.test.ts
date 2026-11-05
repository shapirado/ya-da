import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { isPublicRoute } from "@/src/lib/auth/routes";
import { isAllowedEmail } from "@/src/lib/auth/access";

// Capture the handler middleware.ts passes to clerkMiddleware so it can be
// driven directly with a fake `auth` object, and stub clerkClient's user
// lookup (no Clerk keys / network).
type Handler = (auth: unknown, req: NextRequest) => Promise<Response | void>;
const captured: { handler?: Handler } = {};

type FakeEmail = { emailAddress: string; verification: { status: string } | null };
const users: Record<string, { emailAddresses: FakeEmail[] }> = {};
const getUser = vi.fn(async (userId: string) => users[userId]);

vi.mock("@clerk/nextjs/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@clerk/nextjs/server")>();
  return {
    ...actual,
    clerkMiddleware: (handler: Handler) => {
      captured.handler = handler;
      return handler;
    },
    clerkClient: async () => ({ users: { getUser } }),
  };
});

let userCounter = 0;
function signedInAs(...emails: Array<[string, string | null]>) {
  const userId = `user_${++userCounter}`;
  users[userId] = {
    emailAddresses: emails.map(([emailAddress, status]) => ({
      emailAddress,
      verification: status ? { status } : null,
    })),
  };
  const protect = vi.fn(async () => ({ userId }));
  const auth = Object.assign(vi.fn(async () => ({ userId })), { protect });
  return { auth, protect, userId };
}

function req(path: string, method = "GET"): NextRequest {
  return new NextRequest(`http://localhost${path}`, { method });
}

describe("middleware route protection", () => {
  beforeEach(async () => {
    getUser.mockClear();
    await import("./middleware");
  });

  test("the Morning webhook path is a public route", () => {
    expect(isPublicRoute(req("/api/webhooks/morning", "POST"))).toBe(true);
    expect(isPublicRoute(req("/sign-in"))).toBe(true);
    expect(isPublicRoute(req("/dashboard"))).toBe(false);
    expect(isPublicRoute(req("/api/other"))).toBe(false);
  });

  test("POST /api/webhooks/morning never hits auth.protect()", async () => {
    const { auth, protect } = signedInAs(["someone@example.com", "verified"]);
    const res = await captured.handler!(auth, req("/api/webhooks/morning", "POST"));
    expect(protect).not.toHaveBeenCalled();
    expect(res).toBeUndefined();
  });

  test("protected app routes still go through auth.protect()", async () => {
    const { auth, protect } = signedInAs(["shapirado@gmail.com", "verified"]);
    await captured.handler!(auth, req("/dashboard"));
    expect(protect).toHaveBeenCalledTimes(1);
  });
});

describe("middleware email allowlist", () => {
  beforeEach(async () => {
    getUser.mockClear();
    await import("./middleware");
  });

  test("isAllowedEmail only accepts the single allowed address (case/whitespace-insensitive)", () => {
    expect(isAllowedEmail("shapirado@gmail.com")).toBe(true);
    expect(isAllowedEmail("  ShapiraDo@Gmail.com ")).toBe(true);
    expect(isAllowedEmail("someone@gmail.com")).toBe(false);
    expect(isAllowedEmail(null)).toBe(false);
  });

  test("the allowed account passes through", async () => {
    const { auth } = signedInAs(["shapirado@gmail.com", "verified"]);
    const res = await captured.handler!(auth, req("/dashboard"));
    expect(res).toBeUndefined();
  });

  test("any other signed-in account gets a 403", async () => {
    const { auth } = signedInAs(["intruder@gmail.com", "verified"]);
    const res = await captured.handler!(auth, req("/dashboard"));
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(403);
  });

  test("an unverified copy of the allowed address is not enough", async () => {
    const { auth } = signedInAs(["shapirado@gmail.com", "unverified"]);
    const res = await captured.handler!(auth, req("/families"));
    expect((res as Response).status).toBe(403);
  });

  test("an allowed user is looked up once, then cached", async () => {
    const { auth } = signedInAs(["shapirado@gmail.com", "verified"]);
    await captured.handler!(auth, req("/dashboard"));
    await captured.handler!(auth, req("/year"));
    expect(getUser).toHaveBeenCalledTimes(1);
  });
});
