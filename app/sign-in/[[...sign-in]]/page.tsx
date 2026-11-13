'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { AuthenticateWithRedirectCallback, useSignIn } from '@clerk/nextjs';

const GENERIC_ERROR = 'לא הצלחתי לחבר אותך, נסי שוב';

export default function SignInPage() {
  const pathname = usePathname();
  const { isLoaded, signIn } = useSignIn();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (pathname?.endsWith('/sso-callback')) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div role="status" className="flex items-center gap-2 text-accent-dark"><span className="spinner" />מחברת אותך…</div>
        <AuthenticateWithRedirectCallback />
      </main>
    );
  }

  function handleGoogleSignIn() {
    if (!isLoaded || isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    signIn
      .authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/sign-in/sso-callback',
        redirectUrlComplete: '/',
      })
      .catch(() => {
        setError(GENERIC_ERROR);
        setIsSubmitting(false);
      });
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="card w-full max-w-sm flex flex-col gap-6 items-stretch text-center">
        <div className="flex flex-col items-center gap-3">
          <img src="/logo.png" alt="לוגו סטודיו ידיים" className="w-24 h-24 rounded-3xl object-cover" />
          <div>
            <h1 className="text-2xl font-bold m-0">סטודיו ידיים</h1>
            <p className="text-muted text-sm m-0 mt-1">ניהול תשלומים</p>
          </div>
        </div>

        <button
          type="button"
          className="btn-secondary min-h-12"
          onClick={handleGoogleSignIn}
          disabled={!isLoaded || isSubmitting}
          aria-busy={isSubmitting}
          title="אעביר אותך להתחברות עם חשבון Google"
        >
          {isSubmitting ? <span className="spinner" aria-hidden /> : <GoogleIcon />}
          {isSubmitting ? 'מעבירה אותך ל-Google…' : 'כניסה עם Google'}
        </button>

        {error ? <p role="alert" className="text-bad text-sm m-0">{error}</p> : null}
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21.6 12.23c0-.68-.06-1.33-.17-1.96H12v3.7h5.4a4.62 4.62 0 0 1-2 3.03v2.52h3.24c1.9-1.75 3-4.33 3-7.3z" fill="#4285F4" />
      <path d="M12 22c2.7 0 4.96-.9 6.62-2.43l-3.24-2.52c-.9.6-2.05.97-3.38.97-2.6 0-4.8-1.76-5.6-4.12H2.98v2.6A9.99 9.99 0 0 0 12 22z" fill="#34A853" />
      <path d="M6.4 13.9a6.1 6.1 0 0 1 0-3.8V7.5H2.98a10 10 0 0 0 0 9l3.42-2.6z" fill="#FBBC05" />
      <path d="M12 6.18c1.47 0 2.78.5 3.82 1.49l2.86-2.86A9.6 9.6 0 0 0 12 2a9.99 9.99 0 0 0-9.02 5.5l3.42 2.6c.8-2.36 3-4.12 5.6-4.12z" fill="#EA4335" />
    </svg>
  );
}
