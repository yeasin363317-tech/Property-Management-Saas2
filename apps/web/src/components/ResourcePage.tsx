import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import type { ZodTypeAny } from 'zod';
import { api, qs } from '../lib/api';
import { label as fmtLabel } from '../lib/format';
import { Button, Card, Empty, ErrorBox, Field, Input, Modal, PageHeader, Pagination, Select, Spinner, Table, Td, Textarea } from './ui';

export interface FieldDef {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'money' | 'date' | 'select' | 'email';
  required?: boolean;
  options?: string[];
  remote?: { path: string; text: (r: any) => string };
  createOnly?: boolean;
}
export interface Column { header: string; render: (r: any) => ReactNode }
export interface ResourceConfig {
  title: string;
  singular: string;
  path: string;
  fields: FieldDef[];
  schema: ZodTypeAny;
  columns: Column[];
  searchable?: boolean;
  filters?: { name: string; label: string; options: string[] }[];
  canDelete?: boolean;
  rowActions?: (r: any, refresh: () => void) => ReactNode;
  defaults?: Record<string, unknown>;
}

function RemoteOptions({ def, ...rest }: { def: FieldDef } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const q = useQuery({ queryKey: ['options', def.remote!.path], queryFn: () => api<any[]>(`${def.remote!.path}?pageSize=100`) });
  return (
    <Select {...rest}>
      <option value="">{q.isLoading ? 'Loading…' : 'Select…'}</option>
      {q.data?.data.map((r) => <option key={r.id} value={r.id}>{def.remote!.text(r)}</option>)}
    </Select>
  );
}

function RecordForm({ cfg, record, onDone }: { cfg: ResourceConfig; record?: any; onDone: () => void }) {
  const qc = useQueryClient();
  const editing = Boolean(record);
  const defaults: Record<string, unknown> = { ...cfg.defaults };
  for (const f of cfg.fields) defaults[f.name] = record ? (f.type === 'date' ? String(record[f.name] ?? '').slice(0, 10) : record[f.name] ?? '') : defaults[f.name] ?? '';
  const form = useForm<any>({ resolver: zodResolver(cfg.schema), defaultValues: defaults });
  const m = useMutation({
    mutationFn: (values: Record<string, unknown>) => {
      const body: Record<string, unknown> = {};
      for (const f of cfg.fields) {
        if (editing && f.createOnly) continue;
        const v = values[f.name];
        if (v === '' || v === undefined) { if (editing && !f.required && f.type !== 'select') body[f.name] = null; continue; }
        body[f.name] = v;
      }
      return api(editing ? `${cfg.path}/${record.id}` : cfg.path, { method: editing ? 'PATCH' : 'POST', body });
    },
    onSuccess: () => { qc.invalidateQueries(); onDone(); },
  });
  const errs = form.formState.errors as Record<string, { message?: string }>;
  return (
    <form className="space-y-3" onSubmit={form.handleSubmit((v) => m.mutate(v))} noValidate>
      {m.error && <ErrorBox error={m.error} />}
      {cfg.fields.filter((f) => !(editing && f.createOnly)).map((f) => (
        <Field key={f.name} label={f.label + (f.required ? ' *' : '')} htmlFor={f.name} error={errs[f.name]?.message}>
          {f.type === 'textarea' ? <Textarea id={f.name} {...form.register(f.name)} />
            : f.type === 'select' && f.remote ? <RemoteOptions def={f} id={f.name} {...form.register(f.name)} />
            : f.type === 'select' ? <Select id={f.name} {...form.register(f.name)}><option value="">Select…</option>{f.options!.map((o) => <option key={o} value={o}>{fmtLabel(o)}</option>)}</Select>
            : <Input id={f.name} type={f.type === 'date' ? 'date' : f.type === 'email' ? 'email' : 'text'} inputMode={f.type === 'money' ? 'decimal' : undefined} {...form.register(f.name)} />}
        </Field>
      ))}
      <div className="flex justify-end gap-2 pt-2"><Button variant="secondary" onClick={onDone}>Cancel</Button><Button type="submit" disabled={m.isPending}>{m.isPending ? 'Saving…' : 'Save'}</Button></div>
    </form>
  );
}

export function ResourcePage({ cfg }: { cfg: ResourceConfig }) {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<any | 'new' | null>(null);
  const params = { page, search, ...filters };
  const q = useQuery({ queryKey: [cfg.path, params], queryFn: () => api<any[]>(`${cfg.path}${qs(params)}`) });
  const refresh = () => qc.invalidateQueries();
  const del = useMutation({ mutationFn: (id: string) => api(`${cfg.path}/${id}`, { method: 'DELETE' }), onSuccess: refresh });

  return (
    <>
      <PageHeader title={cfg.title}><Button onClick={() => setEditing('new')}>Add {cfg.singular}</Button></PageHeader>
      <Card>
        <div className="mb-3 flex flex-wrap gap-2 print:hidden">
          {cfg.searchable && <Input aria-label="Search" placeholder="Search…" className="max-w-xs" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />}
          {cfg.filters?.map((f) => (
            <Select key={f.name} aria-label={f.label} className="max-w-[12rem]" value={filters[f.name] ?? ''} onChange={(e) => { setFilters({ ...filters, [f.name]: e.target.value }); setPage(1); }}>
              <option value="">{f.label}: all</option>{f.options.map((o) => <option key={o} value={o}>{fmtLabel(o)}</option>)}
            </Select>
          ))}
        </div>
        {q.isLoading ? <Spinner /> : q.error ? <ErrorBox error={q.error} /> : q.data!.data.length === 0 ? (
          <Empty title={`No ${cfg.title.toLowerCase()} found`} hint={`Use “Add ${cfg.singular}” to create the first one.`} />
        ) : (
          <Table headers={[...cfg.columns.map((c) => c.header), 'Actions']}>
            {q.data!.data.map((r) => (
              <tr key={r.id}>
                {cfg.columns.map((c) => <Td key={c.header}>{c.render(r)}</Td>)}
                <Td className="whitespace-nowrap">
                  <button className="mr-3 text-brand-600 hover:underline" onClick={() => setEditing(r)}>Edit</button>
                  {cfg.rowActions?.(r, refresh)}
                  {cfg.canDelete && <button className="ml-3 text-red-600 hover:underline" onClick={() => window.confirm(`Delete this ${cfg.singular.toLowerCase()}?`) && del.mutate(r.id)}>Delete</button>}
                </Td>
              </tr>
            ))}
          </Table>
        )}
        {del.error && <ErrorBox error={del.error} />}
        <Pagination meta={q.data?.meta} onPage={setPage} />
      </Card>
      {editing && <Modal title={editing === 'new' ? `Add ${cfg.singular}` : `Edit ${cfg.singular}`} onClose={() => setEditing(null)}><RecordForm cfg={cfg} record={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} /></Modal>}
    </>
  );
}
