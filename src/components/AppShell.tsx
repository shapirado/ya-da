import type { ReactNode } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "לוח בקרה", icon: <HomeIcon /> },
  { href: "/year", label: "תצוגה שנתית", icon: <YearIcon /> },
  { href: "/families", label: "משפחות", icon: <FamilyIcon /> },
  { href: "/classes", label: "חוגים", icon: <PaletteIcon /> },
];

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="yd yd-app">
      <aside className="yd-side">
        <div className="yd-logo">
          <Mark size={42} />
          <div>
            <div className="word">יה-דה</div>
            <div className="sub">הסטודיו של דליה</div>
          </div>
        </div>

        <nav aria-label="ניווט ראשי">
          {NAV_ITEMS.map((item) => (
            <a key={item.href} href={item.href} className="yd-nav">
              {item.icon}
              {item.label}
            </a>
          ))}
        </nav>

        <div style={{ marginTop: 14 }}>
          <button type="button" className="yd-btn primary block">
            <PlusIcon />
            רישום תשלום
          </button>
        </div>

        <div className="spacer" />

        <div className="yd-user">
          <span className="yd-avatar">ד</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500 }}>דליה</div>
            <div className="small muted">dalia@yada.co.il</div>
          </div>
        </div>
      </aside>

      <main className="yd-main">{children}</main>
    </div>
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

function icon(d: string) {
  return (
    <svg
      className="ic"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

function HomeIcon() {
  return icon("M4 11.2 12 4l8 7.2M6 9.6V20h5v-6h2v6h5V9.6");
}

function YearIcon() {
  return icon(
    "M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM4 9.5h16M8 3v4M16 3v4"
  );
}

function FamilyIcon() {
  return icon(
    "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM16.5 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM3.5 20v-1.5A4.5 4.5 0 0 1 8 14h2a4.5 4.5 0 0 1 4.5 4.5V20M15 14.5c2.5 0 5.5 1.2 5.5 3.6V20"
  );
}

function PaletteIcon() {
  return icon(
    "M12 3.5c-5 0-8.5 3.6-8.5 8 0 3.6 2.9 6.5 6.1 6.5.9 0 1.5-.6 1.5-1.4 0-.4-.2-.7-.4-1-.2-.3-.4-.6-.4-1 0-.8.6-1.4 1.4-1.4h1.6c3 0 5.7-2.4 5.7-5.7 0-2.2-2.7-4-7-4zM7.5 9.5h.1M10 7h.1M14 7h.1M16.5 9.5h.1"
  );
}

function PlusIcon() {
  return icon("M12 5v14M5 12h14");
}
