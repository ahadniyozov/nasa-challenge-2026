// TEMPORARY i18n layer (RU for the team, EN for judges).
// To remove Russian before submission:
//   1. delete ru.ts, ru-kid.ts, ru-runner.ts and the LangToggle in App.tsx
//   2. make makeT() return the English branch only (or replace calls with the raw strings)
import { useMemo } from 'react';
import { create } from 'zustand';
import { RU_BLURBS, RU_MSG, RU_NAMES, RU_RULES, RU_UI as RU_BASE } from './ru';
import { RU_KID } from './ru-kid';
import { RU_RUNNER } from './ru-runner';

const RU_UI: Record<string, string> = { ...RU_BASE, ...RU_KID, ...RU_RUNNER };

export type Lang = 'en' | 'ru';

function readSaved(): Lang | null {
  try {
    const v = localStorage.getItem('lang');
    return v === 'en' || v === 'ru' ? v : null;
  } catch {
    return null;
  }
}

export const useLang = create<{ lang: Lang; setLang(l: Lang): void }>((set) => ({
  lang: readSaved() ?? 'ru',
  setLang: (lang) => {
    try { localStorage.setItem('lang', lang); } catch { /* private mode */ }
    document.documentElement.lang = lang;
    set({ lang });
  },
}));

type Params = Record<string, string | number>;
const fill = (s: string, p?: Params) => (p ? s.replace(/\{(\w+)\}/g, (_, k) => String(p[k] ?? '')) : s);

export interface T {
  lang: Lang;
  /** UI string, English text is the key: t('Fix {n} errors', { n }) */
  t(en: string, params?: Params): string;
  /** catalog / scenario name */
  name(en: string): string;
  /** catalog description by id */
  blurb(id: string, en: string): string;
  /** message produced by the engine (review, events, lessons) */
  msg(en: string): string;
}

export function makeT(lang: Lang): T {
  if (lang === 'en') return { lang, t: fill, name: (s) => s, blurb: (_, s) => s, msg: (s) => s };
  const name = (s: string) => RU_NAMES[s] ?? s;
  return {
    lang,
    t: (en, p) => fill(RU_UI[en] ?? en, p),
    name,
    blurb: (id, en) => RU_BLURBS[id] ?? en,
    msg: (en) => {
      if (RU_MSG[en]) return RU_MSG[en];
      for (const [re, fn] of RU_RULES) {
        const m = en.match(re);
        if (m) return fn(m, name);
      }
      return en;
    },
  };
}

export function useT(): T {
  const lang = useLang((s) => s.lang);
  return useMemo(() => makeT(lang), [lang]);
}

/** Current language outside React (formatters). */
export const currentLang = () => useLang.getState().lang;
