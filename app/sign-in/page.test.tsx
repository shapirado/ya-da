import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SignInPage from "./[[...sign-in]]/page";

vi.mock("@clerk/nextjs", () => ({
  useSignIn: () => ({
    isLoaded: true,
    signIn: {
      authenticateWithRedirect: vi.fn(),
    },
  }),
}));

describe("sign-in page", () => {
  it("shows one Google button and no email/password fields", () => {
    render(<SignInPage />);
    expect(
      screen.getByRole("button", { name: /google/i })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/סיסמה|password/i)).not.toBeInTheDocument();
  });
});
