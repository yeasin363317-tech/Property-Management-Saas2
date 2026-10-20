import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { forwardRef, useEffect } from 'react';
import { label } from '../lib/format';

export function Button({ variant = 'primary', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }) {
  const styles = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700',
    secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  }[variant];
  return <button type="button" {...p} className={`inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${styles} ${className}`} />;
}

const field = 'block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>((p, ref) => <input ref={ref} {...p} className={`${field} ${p.className ?? ''}`} />);
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>((p, ref) => <textarea ref={ref} rows={3} {...p} className={field} />);
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>((p, ref) => <select ref={ref} {...p} className={`${field} ${p.className ?? ''}`} />);

export function Field({ label: l, error, children, htmlFor }: { label: string; error?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-slate-700">{l}</label>
      {children}
      {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function Card({ title, children, actions }: { title?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      {(title || actions) && (
        <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
          {actions}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

const tone: Record<string, string> = {
  PAID: 'bg-green-100 text-green-800', OCCUPIED: 'bg-green-100 text-green-800', ACTIVE: 'bg-green-100 text-green-800', RESOLVED: 'bg-green-100 text-green-800',
  PARTIAL: 'bg-amber-100 text-amber-800', MEDIUM: 'bg-amber-100 text-amber-800', IN_PROGRESS: 'bg-amber-100 text-amber-800', MAINTENANCE: 'bg-amber-100 text-amber-800',
  OVERDUE: 'bg-red-100 text-red-800', URGENT: 'bg-red-100 text-red-800', HIGH: 'bg-orange-100 text-orange-800', OPEN: 'bg-blue-100 text-blue-800',
};
export const Badge = ({ value }: { value: string }) => (
  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${tone[value] ?? 'bg-slate-100 text-slate-700'}`}>{label(value)}</span>
);

export const Spinner = () => <p role="status" className="p-6 text-center text-sm text-slate-500">Loading…</p>;
export const ErrorBox = ({ error }: { error: unknown }) => <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{(error as Error)?.message ?? 'Something went wrong'}</p>;
export const Empty = ({ title, hint }: { title: string; hint?: string }) => (
  <div className="p-8 text-center"><p className="font-medium text-slate-700">{title}</p>{hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}</div>
);

export function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b text-xs uppercase text-slate-500"><tr>{headers.map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}
export const Td = ({ children, className = '' }: { children?: ReactNode; className?: string }) => <td className={`px-3 py-2 align-top ${className}`}>{children}</td>;

export function Pagination({ meta, onPage }: { meta?: { page: number; pageSize: number; total: number }; onPage: (p: number) => void }) {
  if (!meta || meta.total <= meta.pageSize) return null;
  const pages = Math.ceil(meta.total / meta.pageSize);
  return (
    <div className="flex items-center justify-between pt-3 text-sm">
      <span className="text-slate-500">Page {meta.page} of {pages} · {meta.total} records</span>
      <div className="flex gap-2">
        <Button variant="secondary" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>Previous</Button>
        <Button variant="secondary" disabled={meta.page >= pages} onClick={() => onPage(meta.page + 1)}>Next</Button>
      </div>
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4 print:hidden" role="dialog" aria-modal="true" aria-label={title}>
      <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-lg bg-white p-5 shadow-xl sm:max-w-lg sm:rounded-lg">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">{title}</h2><button aria-label="Close" onClick={onClose} className="text-slate-500 hover:text-slate-800">✕</button></div>
        {children}
      </div>
    </div>
  );
}

export const PageHeader = ({ title, children }: { title: string; children?: ReactNode }) => (
  <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden"><h1 className="text-xl font-semibold">{title}</h1><div className="flex flex-wrap gap-2">{children}</div></div>
);

export const confirmAction = (msg: string) => window.confirm(msg);
