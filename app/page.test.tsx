import { describe, expect, test, vi } from "vitest";

const redirect = vi.fn();
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url) }));

describe("root route", () => {
  test("redirects to /dashboard", async () => {
    const { default: Home } = await import("./page");
    Home();
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });
});
