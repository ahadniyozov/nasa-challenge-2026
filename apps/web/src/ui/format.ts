import { currentLang } from '../i18n';

const ru = () => currentLang() === 'ru';
const num = (n: number, d = 0) => n.toLocaleString(ru() ? 'ru' : 'en', { maximumFractionDigits: d, minimumFractionDigits: d });

export const kg = (n: number) => `${n < 10 ? num(n, 1) : num(n)} ${ru() ? 'кг' : 'kg'}`;
export const W = (n: number) => `${n < 10 ? num(n, 1) : num(n)} ${ru() ? 'Вт' : 'W'}`;
export const M = (n: number) => `$${n < 10 ? num(n, 2) : num(n, 1)}M`;
export const GB = (n: number) =>
  n < 1 ? `${num(n * 1000)} ${ru() ? 'МБ' : 'MB'}` : n < 1000 ? `${num(n, 1)} ${ru() ? 'ГБ' : 'GB'}` : `${num(n / 1000, 1)} ${ru() ? 'ТБ' : 'TB'}`;
export const pct = (n: number) => `${Math.round(n * 100)}%`;
export const yr = (n: number) => (n > 100 ? (ru() ? '100+ лет' : '100+ yr') : `${num(n, 1)} ${ru() ? 'г' : 'yr'}`);
