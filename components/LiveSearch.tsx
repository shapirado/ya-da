'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { normName } from '@/lib/matching';

export type Suggestion = { id: string; name: string; sub: string; hay: string };

/**
 * Type-ahead search: a dropdown of matching children while typing; picking one (or Enter on the typed text)
 * filters the page list by putting the text in `?name=`. The list itself doesn't change while typing.
 * The dropdown hangs off the nearest `relative` parent (the search box), full width.
 */
export function LiveSearch({ suggestions, name = 'q', defaultValue = '', placeholder }: { suggestions: Suggestion[]; name?: string; defaultValue?: string; placeholder?: string }) {
  const router = useRouter();
  const [text, setText] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [busy, start] = useTransition();
  const box = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const q = normName(text);
    if (!q) return [];
    return suggestions.filter((s) => normName(s.hay).includes(q)).slice(0, 12);
  }, [text, suggestions]);

  // close when clicking anywhere else
  useEffect(() => {
    const off = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', off);
    return () => document.removeEventListener('mousedown', off);
  }, []);

  const go = (v: string) => {
    setOpen(false);
    setActive(-1);
    const params = new URLSearchParams(window.location.search);
    params.delete('ok');
    params.delete('err');
    if (v.trim()) params.set(name, v.trim());
    else params.delete(name);
    const qs = params.toString();
    start(() => router.replace(`${window.location.pathname}${qs ? `?${qs}` : ''}`, { scroll: false }));
  };
  const pick = (s: Suggestion) => { setText(s.name); go(s.name); };

  const showList = open && text.trim() !== '';

  return (
    <div ref={box} className="contents">
      <input
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls="child-suggest"
        aria-activedescendant={active >= 0 ? `child-suggest-${active}` : undefined}
        aria-autocomplete="list"
        aria-label="חיפוש"
        value={text}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          setActive(-1);
          if (!e.target.value) go(''); // the ✕ / emptying the box shows everyone again
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((i) => Math.min(i + 1, matches.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, -1)); }
          else if (e.key === 'Escape') setOpen(false);
          else if (e.key === 'Enter') { e.preventDefault(); if (showList && active >= 0 && matches[active]) pick(matches[active]); else go(text); }
        }}
        className="border-0 outline-0 flex-1 text-[15px] bg-transparent min-w-0"
      />
      {busy && <span className="spinner" aria-hidden />}
      {showList && (
        <ul id="child-suggest" role="listbox" className="absolute inset-x-0 top-[calc(100%+4px)] z-30 m-0 p-1 list-none bg-white border border-line rounded-xl shadow-[0_8px_24px_rgba(23,22,28,0.12)] max-h-[360px] overflow-y-auto">
          {matches.map((s, i) => (
            <li
              key={s.id}
              id={`child-suggest-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); pick(s); }}
              onMouseEnter={() => setActive(i)}
              className={`flex flex-col px-3 py-2 rounded-lg cursor-pointer ${i === active ? 'bg-accent-soft' : ''}`}
            >
              <span className="font-medium text-[15px]">{s.name}</span>
              {s.sub && <span className="text-xs text-muted">{s.sub}</span>}
            </li>
          ))}
          {!matches.length && <li className="px-3 py-2 text-sm text-muted">לא מצאתי</li>}
        </ul>
      )}
    </div>
  );
}
