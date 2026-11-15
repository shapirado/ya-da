'use client';

import { useRouter } from 'next/navigation';

// A <select> that navigates to the chosen option's href.
export function NavSelect({ label, placeholder, value, options, on }: {
  label: string;
  placeholder: string;
  value: string; // '' when no option is active
  options: { value: string; label: string; href: string }[];
  on?: boolean;
}) {
  const router = useRouter();
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => {
        const o = options.find((x) => x.value === e.target.value);
        if (o) router.push(o.href);
      }}
      className={`min-h-11 px-3.5 rounded-full border text-sm text-ink bg-white cursor-pointer ${on ? 'border-accent bg-accent-soft' : 'border-line-strong'}`}
    >
      <option value="" disabled={!value} hidden={!!value}>{placeholder}</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
