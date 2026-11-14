// TEMPORARY i18n layer (RU for the team, EN for judges). English text is the key: t('Year {n} of {m}', { n, m }).
// To remove Russian before submission: delete ru-*.ts and LangToggle.tsx, and make makeT() return the English branch.
import { useMemo } from 'react';
import { create } from 'zustand';
import { RU_2D } from './ru-2d';
import { RU_CONTENT } from './ru-content';
import { RU_MISSIONS } from './ru-missions';
import { RU_UI } from './ru-ui';

const RU: Record<string, string> = { ...RU_2D, ...RU_MISSIONS, ...RU_CONTENT, ...RU_UI };

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
  // English is the default (judges); Russian stays behind the RU/EN toggle until the final build
  lang: readSaved() ?? 'en',
  setLang: (lang) => {
    try { localStorage.setItem('lang', lang); } catch { /* private mode */ }
    document.documentElement.lang = lang;
    set({ lang });
  },
}));

type Params = Record<string, string | number>;
const fill = (s: string, p?: Params) => (p ? s.replace(/\{(\w+)\}/g, (_, k: string) => String(p[k] ?? '')) : s);

export interface T {
  lang: Lang;
  /** UI string, English text is the key: t('Fix {n} errors', { n }) */
  t(en: string, params?: Params): string;
}

export function makeT(lang: Lang): T {
  if (lang === 'en') return { lang, t: fill };
  return { lang, t: (en, p) => fill(RU[en] ?? en, p) };
}

export function useT(): T {
  const lang = useLang((s) => s.lang);
  return useMemo(() => makeT(lang), [lang]);
}
