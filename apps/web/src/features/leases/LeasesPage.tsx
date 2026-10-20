import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Modal, PageHeader, Pagination, Select, Spinner, Table, Td } from '../../components/ui';
import { api, qs } from '../../lib/api';
import { date, money } from '../../lib/format';

const amount = z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, 'Enter an amount like 1200 or 1200.50');
const createSchema = z.object({ unitId: z.string().uuid('Select a unit'), tenantId: z.string().uuid('Select a tenant'), startDate: z.string().min(1, 'Required'), endDate: z.string().min(1, 'Required'), monthlyRent: amount, securityDeposit: amount.or(z.literal('')).optional(), dueDay: z.coerce.number().int().min(1, '1–28').max(28, '1–28') })
  .refine((v) => v.endDate > v.startDate, { path: ['endDate'], message: 'End date must be after start date' });

function useList(path: string) { return useQuery({ queryKey: ['options', path], queryFn: () => api<any[]>(`${path}?pageSize=100`) }); }

function CreateLease({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const units = useList('/units'); const tenants = useList('/tenants?active=true');
  const f = useForm<any>({ resolver: zodResolver(createSchema), defaultValues: { dueDay: 1, securityDeposit: '0' } });
  const m = useMutation({ mutationFn: (v: any) => api('/leases', { method: 'POST', body: v }), onSuccess: () => { qc.invalidateQueries(); onDone(); } });
  const e = f.formState.errors as Record<string, { message?: string }>;
  const unitId = f.watch('unitId');
  return (
    <form className="space-y-3" noValidate onSubmit={f.handleSubmit((v) => m.mutate(v))}>
      {m.error && <ErrorBox error={m.error} />}
      <Field label="Unit *" htmlFor="unitId" error={e.unitId?.message}><Select id="unitId" {...f.register('unitId', { onChange: (ev) => { const u = units.data?.data.find((x) => x.id === ev.target.value); if (u) f.setValue('monthlyRent', String(u.monthlyRent)); } })}><option value="">Select…</option>{units.data?.data.filter((u) => u.status !== 'MAINTENANCE').map((u) => <option key={u.id} value={u.id}>{u.property.name} · {u.number}</option>)}</Select></Field>
      <Field label="Tenant *" htmlFor="tenantId" error={e.tenantId?.message}><Select id="tenantId" {...f.register('tenantId')}><option value="">Select…</option>{tenants.data?.data.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}</Select></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start date *" htmlFor="startDate" error={e.startDate?.message}><Input id="startDate" type="date" {...f.register('startDate')} /></Field>
        <Field label="End date *" htmlFor="endDate" error={e.endDate?.message}><Input id="endDate" type="date" {...f.register('endDate')} /></Field>
        <Field label="Monthly rent *" htmlFor="monthlyRent" error={e.monthlyRent?.message}><Input id="monthlyRent" inputMode="decimal" {...f.register('monthlyRent')} /></Field>
        <Field label="Security deposit" htmlFor="securityDeposit" error={e.securityDeposit?.message}><Input id="securityDeposit" inputMode="decimal" {...f.register('securityDeposit')} /></Field>
        <Field label="Rent due day (1–28) *" htmlFor="dueDay" error={e.dueDay?.message}><Input id="dueDay" type="number" min={1} max={28} {...f.register('dueDay')} /></Field>
      </div>
      {unitId === '' && <p className="text-xs text-slate-500">Choosing a unit pre-fills its monthly rent.</p>}
      <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onDone}>Cancel</Button><Button type="submit" disabled={m.isPending}>{m.isPending ? 'Saving…' : 'Create lease'}</Button></div>
    </form>
  );
}

function Terminate({ lease, onDone }: { lease: any; onDone: () => void }) {
  const qc = useQueryClient();
  const [d, setD] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const m = useMutation({ mutationFn: () => api(`/leases/${lease.id}/terminate`, { method: 'POST', body: { date: d, reason } }), onSuccess: () => { qc.invalidateQueries(); onDone(); } });
  return (
    <div className="space-y-3">
      {m.error && <ErrorBox error={m.error} />}
      <p className="text-sm text-slate-600">Ends the lease for {lease.tenant.fullName}. Payment history is preserved.</p>
      <Field label="Termination date" htmlFor="td"><Input id="td" type="date" value={d} onChange={(e) => setD(e.target.value)} /></Field>
      <Field label="Reason (optional)" htmlFor="tr"><Input id="tr" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onDone}>Cancel</Button><Button variant="danger" disabled={m.isPending} onClick={() => m.mutate()}>Terminate lease</Button></div>
    </div>
  );
}

function Renew({ lease, onDone }: { lease: any; onDone: () => void }) {
  const qc = useQueryClient();
  const [end, setEnd] = useState('');
  const [rent, setRent] = useState(String(lease.monthlyRent));
  const m = useMutation({ mutationFn: () => api(`/leases/${lease.id}/renew`, { method: 'POST', body: { endDate: end, monthlyRent: rent } }), onSuccess: () => { qc.invalidateQueries(); onDone(); } });
  return (
    <div className="space-y-3">
      {m.error && <ErrorBox error={m.error} />}
      <p className="text-sm text-slate-600">Creates a new lease starting the day after {date(lease.endDate)}.</p>
      <Field label="New end date" htmlFor="re"><Input id="re" type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
      <Field label="Monthly rent" htmlFor="rr"><Input id="rr" inputMode="decimal" value={rent} onChange={(e) => setRent(e.target.value)} /></Field>
      <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onDone}>Cancel</Button><Button disabled={!end || m.isPending} onClick={() => m.mutate()}>Renew lease</Button></div>
    </div>
  );
}

export default function LeasesPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [expiring, setExpiring] = useState(false);
  const [modal, setModal] = useState<{ kind: 'new' | 'terminate' | 'renew'; lease?: any } | null>(null);
  const q = useQuery({ queryKey: ['/leases', page, status, expiring], queryFn: () => api<any[]>(`/leases${qs({ page, status, expiringInDays: expiring ? 60 : undefined })}`) });
  const soon = (l: any) => l.status === 'ACTIVE' && new Date(l.endDate).getTime() - Date.now() < 60 * 86400000;
  return (
    <>
      <PageHeader title="Leases"><Button onClick={() => setModal({ kind: 'new' })}>New lease</Button></PageHeader>
      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <Select aria-label="Status" className="max-w-[12rem]" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">Status: all</option>{['ACTIVE', 'ENDED', 'TERMINATED', 'RENEWED'].map((s) => <option key={s} value={s}>{s[0] + s.slice(1).toLowerCase()}</option>)}</Select>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={expiring} onChange={(e) => { setExpiring(e.target.checked); setPage(1); }} /> Expiring within 60 days</label>
        </div>
        {q.isLoading ? <Spinner /> : q.error ? <ErrorBox error={q.error} /> : q.data!.data.length === 0 ? <Empty title="No leases found" hint="Create a lease to start generating rent." /> : (
          <Table headers={['Tenant', 'Unit', 'Term', 'Rent', 'Due day', 'Status', 'Actions']}>
            {q.data!.data.map((l) => (
              <tr key={l.id}>
                <Td className="font-medium">{l.tenant.fullName}</Td><Td>{l.unit.property.name} · {l.unit.number}</Td>
                <Td>{date(l.startDate)} → {date(l.endDate)} {soon(l) && <span className="ml-1 text-xs text-amber-700">expiring soon</span>}</Td>
                <Td>{money(l.monthlyRent)}</Td><Td>{l.dueDay}</Td><Td><Badge value={l.status} /></Td>
                <Td className="whitespace-nowrap">{l.status === 'ACTIVE' && <><button className="mr-3 text-brand-600 hover:underline" onClick={() => setModal({ kind: 'renew', lease: l })}>Renew</button><button className="text-red-600 hover:underline" onClick={() => setModal({ kind: 'terminate', lease: l })}>Terminate</button></>}</Td>
              </tr>
            ))}
          </Table>
        )}
        <Pagination meta={q.data?.meta} onPage={setPage} />
      </Card>
      {modal && <Modal title={modal.kind === 'new' ? 'New lease' : modal.kind === 'renew' ? 'Renew lease' : 'Terminate lease'} onClose={() => setModal(null)}>
        {modal.kind === 'new' ? <CreateLease onDone={() => setModal(null)} /> : modal.kind === 'renew' ? <Renew lease={modal.lease} onDone={() => setModal(null)} /> : <Terminate lease={modal.lease} onDone={() => setModal(null)} />}
      </Modal>}
    </>
  );
}
