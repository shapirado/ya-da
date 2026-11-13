import { redirect } from 'next/navigation';
import { SignOutButton } from '@clerk/nextjs';
import { Sidebar } from '@/components/Sidebar';
import { morningConfigured } from '@/lib/morning';
import { checkAccess } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const access = await checkAccess();
  if (!access.ok && access.reason === 'signed-out') redirect('/sign-in');
  if (!access.ok) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="card w-full max-w-sm flex flex-col gap-4 text-center items-center">
          <img src="/logo.png" alt="לוגו סטודיו ידיים" className="w-16 h-16 rounded-2xl object-cover" />
          <h1 className="m-0 text-xl font-bold">אין לך הרשאה למערכת</h1>
          <p className="m-0 text-sm text-muted">התחברת עם <span dir="ltr">{access.email || 'חשבון לא מאומת'}</span>, והכתובת הזו לא ברשימת המורשים.</p>
          <SignOutButton redirectUrl="/sign-in">
            <button type="button" className="btn-secondary w-full">התחברות עם חשבון אחר</button>
          </SignOutButton>
        </div>
      </main>
    );
  }
  return (
    <div className="min-h-screen p-4 flex flex-wrap gap-4 items-start">
      <Sidebar morningOk={morningConfigured()} email={access.email} />
      <main className="flex-[999_1_560px] min-w-0 flex flex-col gap-4">{children}</main>
    </div>
  );
}
