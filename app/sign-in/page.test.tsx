import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import SignInPage from "./[[...sign-in]]/page";

const authenticateWithRedirect = vi.fn();
let mockPathname = "/sign-in";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

vi.mock("@clerk/nextjs", () => ({
  useSignIn: () => ({
    isLoaded: true,
    signIn: {
      authenticateWithRedirect,
    },
  }),
  AuthenticateWithRedirectCallback: () => (
    <div data-testid="sso-callback" />
  ),
}));

describe("sign-in page", () => {
  beforeEach(() => {
    mockPathname = "/sign-in";
    authenticateWithRedirect.mockReset();
  });

  it("shows one Google button and no email/password fields", () => {
    render(<SignInPage />);
    expect(
      screen.getByRole("button", { name: /google/i })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/סיסמה|password/i)).not.toBeInTheDocument();
  });

  it("renders the Clerk redirect callback handler on the sso-callback path", () => {
    mockPathname = "/sign-in/sso-callback";
    render(<SignInPage />);
    expect(screen.getByTestId("sso-callback")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /google/i })
    ).not.toBeInTheDocument();
  });

  it("shows a Hebrew error message and allows retry when the redirect call fails", async () => {
    authenticateWithRedirect.mockRejectedValueOnce(new Error("boom"));
    render(<SignInPage />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /google/i }));
    });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "לא הצלחנו להתחבר, נסי שוב"
      );
    });

    const button = screen.getByRole("button", { name: /google/i });
    expect(button).not.toBeDisabled();

    authenticateWithRedirect.mockResolvedValueOnce(undefined);
    await act(async () => {
      fireEvent.click(button);
    });
    expect(authenticateWithRedirect).toHaveBeenCalledTimes(2);
  });

  it("disables the button immediately after the first click to prevent double submission", async () => {
    let resolveRedirect: () => void = () => {};
    authenticateWithRedirect.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveRedirect = resolve;
        })
    );
    render(<SignInPage />);

    const button = screen.getByRole("button", { name: /google/i });
    fireEvent.click(button);

    expect(button).toBeDisabled();
    expect(authenticateWithRedirect).toHaveBeenCalledTimes(1);

    fireEvent.click(button);
    expect(authenticateWithRedirect).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRedirect();
    });
  });

  it("sends the user straight to /dashboard after Google sign-in completes", async () => {
    authenticateWithRedirect.mockResolvedValueOnce(undefined);
    render(<SignInPage />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /google/i }));
    });
    expect(authenticateWithRedirect).toHaveBeenCalledWith(
      expect.objectContaining({ redirectUrlComplete: "/dashboard" })
    );
  });
});
