// All business dates are calendar dates stored as UTC midnight (PostgreSQL DATE).
export const parseDate = (s: string) => new Date(`${s}T00:00:00.000Z`);
export const fmtDate = (d: Date) => d.toISOString().slice(0, 10);
export const today = () => parseDate(new Date().toISOString().slice(0, 10));
export const firstOfMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
export const endOfMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
