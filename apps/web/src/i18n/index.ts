// UI strings. The game is English only; English text is written in place and passed through t(),
// which fills {params}: t('Year {n} of {m}', { n, m }). Keeping t() everywhere means a translation
// can be added later in one place without touching the screens.
type Params = Record<string, string | number>;
const fill = (s: string, p?: Params) => (p ? s.replace(/\{(\w+)\}/g, (_, k: string) => String(p[k] ?? '')) : s);

export interface T {
  /** UI string with {params} filled in: t('Fix {n} errors', { n }) */
  t(en: string, params?: Params): string;
}

const EN: T = { t: fill };

export function useT(): T {
  return EN;
}
