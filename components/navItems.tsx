// Main sections, shared by the desktop sidebar and the mobile tab bar.
export const NAV_ITEMS = [
  { href: '/', label: 'לוח בקרה', short: 'בית', icon: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></> },
  { href: '/children', label: 'ילדים', short: 'ילדים', icon: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5" /><circle cx="17" cy="9" r="2.5" /><path d="M17 14c2.4 0 4 1.6 4.6 4.5" /></> },
  { href: '/activities', label: 'חוגים וקייטנות', short: 'חוגים', icon: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></> },
  { href: '/reminders', label: 'תזכורות וואטסאפ', short: 'תזכורות', icon: <path d="M4 19l1.3-3.8A8 8 0 1 1 8.6 18z" /> },
  { href: '/payments', label: 'תשלומים וקבלות', short: 'תשלומים', icon: <><path d="M6 3h9l4 4v14H6z" /><path d="M9 12h7M9 16h5" /></> },
];

export const isActive = (href: string, path: string) => (href === '/' ? path === '/' : path.startsWith(href));
