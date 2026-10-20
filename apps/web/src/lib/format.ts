export const money = (v: string | number | null | undefined) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(v ?? 0));
export const date = (v: string | null | undefined) => (v ? v.slice(0, 10) : '—');
export const label = (v: string) => v.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
export const monthStart = () => new Date().toISOString().slice(0, 8) + '01';
export const todayStr = () => new Date().toISOString().slice(0, 10);
