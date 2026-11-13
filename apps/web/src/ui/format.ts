export const kg = (n: number) => (n < 10 ? `${n.toFixed(1)} kg` : `${Math.round(n).toLocaleString('en')} kg`);
export const W = (n: number) => (n < 10 ? `${n.toFixed(1)} W` : `${Math.round(n).toLocaleString('en')} W`);
export const M = (n: number) => `$${n < 10 ? n.toFixed(2) : n.toFixed(1)}M`;
export const GB = (n: number) => (n < 1 ? `${(n * 1000).toFixed(0)} MB` : `${n.toFixed(1)} GB`);
export const pct = (n: number) => `${Math.round(n * 100)}%`;
export const yr = (n: number) => (n > 100 ? '100+ yr' : `${n.toFixed(1)} yr`);
