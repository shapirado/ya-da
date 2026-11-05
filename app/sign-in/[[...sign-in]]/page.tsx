"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { AuthenticateWithRedirectCallback, useSignIn } from "@clerk/nextjs";

const GENERIC_ERROR = "לא הצלחנו להתחבר, נסי שוב";

export default function SignInPage() {
  const pathname = usePathname();
  const { isLoaded, signIn } = useSignIn();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (pathname?.endsWith("/sso-callback")) {
    return <AuthenticateWithRedirectCallback />;
  }

  function handleGoogleSignIn() {
    if (!isLoaded || isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    signIn
      .authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sign-in/sso-callback",
        redirectUrlComplete: "/dashboard",
      })
      .catch(() => {
        setError(GENERIC_ERROR);
        setIsSubmitting(false);
      });
  }

  return (
    <main className="yd yd-login">
      <span
        className="yd-dab"
        style={{ position: "absolute", top: 90, insetInlineEnd: 140, width: 26, height: 22 }}
        aria-hidden="true"
      />
      <span
        className="yd-dab mustard"
        style={{ position: "absolute", top: 220, insetInlineStart: 160, width: 34, height: 28 }}
        aria-hidden="true"
      />
      <span
        className="yd-dab sage"
        style={{ position: "absolute", bottom: 120, insetInlineEnd: 260, width: 20, height: 18 }}
        aria-hidden="true"
      />
      <span
        className="yd-dab teal"
        style={{ position: "absolute", bottom: 80, insetInlineStart: 300, width: 14, height: 12 }}
        aria-hidden="true"
      />

      <div className="yd-card yd-login-card">
        <div className="yd-login-head">
          <PaletteIllustration />
          <div className="yd-login-wordmark">
            <Mark size={36} />
            <span className="yd-login-word">Ya-Da</span>
          </div>
          <span className="muted small">מעקב תשלומים לסטודיו של דליה</span>
        </div>

        <button
          type="button"
          className="yd-btn secondary block lg"
          onClick={handleGoogleSignIn}
          disabled={!isLoaded || isSubmitting}
        >
          <GoogleIcon />
          כניסה עם Google
        </button>

        {error ? (
          <p role="alert" className="yd-login-error">
            {error}
          </p>
        ) : null}
      </div>
    </main>
  );
}

function Mark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path
        d="M24.6 5.2c9.4.4 17.6 7.2 18 16.8.5 10.6-7.3 20.2-18.2 20.6C13.6 43 5 35.4 5.4 24.8 5.8 14 14.4 4.8 24.6 5.2z"
        fill="var(--terracotta)"
      />
      <path
        d="M15.6 30.4c3.6 3.4 11.6 4 16.6-.6"
        stroke="var(--on-fill)"
        strokeWidth={3.2}
        fill="none"
        strokeLinecap="round"
      />
      <circle cx={18.6} cy={20.4} r={2.6} fill="var(--on-fill)" />
      <circle cx={29.6} cy={19.6} r={2.6} fill="var(--on-fill)" />
      <path
        d="M39.4 6.4c2.4-.4 4.4 1.4 4.2 3.6-.2 2.4-2.6 3.6-4.6 2.8-2.2-.8-2.4-6-.4-6.4z"
        fill="var(--mustard)"
      />
      <circle cx={7.6} cy={41.2} r={2.4} fill="var(--sage)" />
    </svg>
  );
}

function PaletteIllustration({ width = 200 }: { width?: number }) {
  return (
    <svg width={width} viewBox="0 0 220 150" aria-hidden="true">
      <ellipse cx={110} cy={138} rx={86} ry={7} fill="var(--paper-sunk)" />
      <path
        d="M48 84c-6-34 26-62 66-60 40 1 70 26 66 56-3 22-24 30-38 24-10-4-16 2-14 12 2 12-8 20-26 18-30-3-50-22-54-50z"
        fill="var(--card)"
        stroke="var(--line-strong)"
        strokeWidth={2.2}
      />
      <path
        d="M124 96c-7-1-12 5-9 12"
        stroke="var(--line-strong)"
        strokeWidth={2.2}
        fill="none"
      />
      <path
        d="M80 50c7-1 12 4 11 10s-8 9-14 6-5-15 3-16z"
        fill="var(--terracotta)"
      />
      <path d="M112 40c7 0 11 5 10 11s-9 8-14 5-4-16 4-16z" fill="var(--mustard)" />
      <path d="M145 54c6 1 9 6 7 12s-9 7-13 3-2-16 6-15z" fill="var(--teal)" />
      <path d="M70 82c6 0 10 5 9 10s-8 8-13 5-4-15 4-15z" fill="var(--sage)" />
      <path
        d="M178 18 136 76"
        stroke="var(--clay)"
        strokeWidth={6}
        strokeLinecap="round"
      />
      <path d="M140 70c-6 4-10 10-12 18 7-1 13-5 17-11z" fill="var(--terracotta)" />
      <path
        d="M138 74l5 4"
        stroke="var(--ink-muted)"
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      <path d="M22 40c3-1 5 1 5 3s-3 4-5 3-3-5 0-6z" fill="var(--mustard)" />
      <path d="M196 106c3 0 5 2 4 5s-4 3-6 2-1-7 2-7z" fill="var(--terracotta)" />
      <path d="M30 120c2-1 4 0 4 2s-2 3-4 2-2-4 0-4z" fill="var(--teal)" />
      <path
        d="M20 70c10-6 16 2 26-3"
        stroke="var(--sage)"
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg className="ic sm" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M21.6 12.23c0-.68-.06-1.33-.17-1.96H12v3.7h5.4a4.62 4.62 0 0 1-2 3.03v2.52h3.24c1.9-1.75 3-4.33 3-7.3z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.7 0 4.96-.9 6.62-2.43l-3.24-2.52c-.9.6-2.05.97-3.38.97-2.6 0-4.8-1.76-5.6-4.12H2.98v2.6A9.99 9.99 0 0 0 12 22z"
        fill="#34A853"
      />
      <path
        d="M6.4 13.9a6.1 6.1 0 0 1 0-3.8V7.5H2.98a10 10 0 0 0 0 9l3.42-2.6z"
        fill="#FBBC05"
      />
      <path
        d="M12 6.18c1.47 0 2.78.5 3.82 1.49l2.86-2.86A9.6 9.6 0 0 0 12 2a9.99 9.99 0 0 0-9.02 5.5l3.42 2.6c.8-2.36 3-4.12 5.6-4.12z"
        fill="#EA4335"
      />
    </svg>
  );
}
