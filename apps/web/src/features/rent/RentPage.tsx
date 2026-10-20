import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Modal, PageHeader, Pagination, Select, Spinner, Table, Td } from '../../components/ui';
import { api, qs } from '../../lib/api';
import { date, label, money, todayStr } from '../../lib/format';

const methods = ['CASH', 'BANK_TRANSFER', 'CARD', 'MOBILE_MONEY', 'CHEQUE', 'OTHER'];

function RecordPayment({ ob, onDone }: { ob: any; onDone: () => void }) {
  const qc = useQueryClient();
  const key = useRef(crypto.randomUUID()); // one key per opened form => double-clicks and retries never double-count
  const [amount, setAmount] = useState(ob.balance);
  const [paidAt, setPaidAt] = useState(todayStr());
  const [method, setMethod] = useState('BANK_TRANSFER');
  const [reference, setReference] = useState('');
  const m = useMutation({
    mutationFn: () => api('/payments', { method: 'POST', body: { obligationId: ob.id, amount, paidAt, method, reference: reference || undefined, idempotencyKey: key.current } }),
    onSuccess: () => { qc.invalidateQueries(); onDone(); },
  });
  const valid = /^\d{1,10}(\.\d{1,2})?$/.test(amount) && Number(amount) > 0 && Number(amount) <= Number(ob.balance);
  return (
    <div className="space-y-3">
      {m.error && <ErrorBox error={m.error} />}
      <p className="text-sm text-slate-600">{ob.lease.tenant.fullName} · unit {ob.lease.unit.number} · due {date(ob.dueDate)} · balance <strong>{money(ob.balance)}</strong></p>
      <Field label="Amount" htmlFor="pa" error={valid ? undefined : `Enter an amount up to ${money(ob.balance)}`}><Input id="pa" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
      <Field label="Payment date" htmlFor="pd"><Input id="pd" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} /></Field>
      <Field label="Method" htmlFor="pm"><Select id="pm" value={method} onChange={(e) => setMethod(e.target.value)}>{methods.map((x) => <option key={x} value={x}>{label(x)}</option>)}</Select></Field>
      <Field label="Transaction reference" htmlFor="pr"><Input id="pr" value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
      <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onDone}>Cancel</Button><Button disabled={!valid || m.isPending} onClick={() => m.mutate()}>{m.isPending ? 'Recording…' : 'Record payment'}</Button></div>
    </div>
  );
}

function History({ ob, onClose }: { ob: any; onClose: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['obligation', ob.id], queryFn: () => api<any>(`/rent/obligations/${ob.id}`) });
  const rev = useMutation({ mutationFn: (id: string) => { const reason = window.prompt('Reason for reversing this payment?'); if (!reason || reason.trim().length < 3) throw new Error('A reason (min 3 characters) is required'); return api(`/payments/${id}/reverse`, { method: 'POST', body: { reason } }); }, onSuccess: () => qc.invalidateQueries() });
  const reversed = new Set(q.data?.data.payments.filter((p: any) => p.kind === 'REVERSAL').map((p: any) => p.reversesId));
  return (
    <Modal title="Payment history" onClose={onClose}>
      {q.isLoading ? <Spinner /> : q.error ? <ErrorBox error={q.error} /> : q.data!.data.payments.length === 0 ? <Empty title="No payments recorded" /> : (
        <Table headers={['Date', 'Type', 'Amount', 'Method', '']}>
          {q.data!.data.payments.map((p: any) => (
            <tr key={p.id}><Td>{date(p.paidAt)}</Td><Td>{label(p.kind)}</Td><Td>{money(p.amount)}</Td><Td>{label(p.method)}</Td>
              <Td className="whitespace-nowrap"><Link className="mr-2 text-brand-600 hover:underline" to={`/receipts/${p.id}`}>Receipt</Link>{p.kind === 'PAYMENT' && !reversed.has(p.id) && <button className="text-red-600 hover:underline" onClick={() => rev.mutate(p.id)}>Reverse</button>}</Td></tr>
          ))}
        </Table>
      )}
      {rev.error && <ErrorBox error={rev.error} />}
    </Modal>
  );
}

export default function RentPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [month, setMonth] = useState(todayStr().slice(0, 7));
  const [modal, setModal] = useState<{ kind: 'pay' | 'history'; ob: any } | null>(null);
  const q = useQuery({ queryKey: ['/rent', page, status, from, to], queryFn: () => api<any[]>(`/rent/obligations${qs({ page, status, from, to })}`) });
  const gen = useMutation({ mutationFn: () => api<{ created: number }>('/rent/obligations/generate', { method: 'POST', body: { month } }), onSuccess: () => qc.invalidateQueries() });
  return (
    <>
      <PageHeader title="Rent & payments">
        <Input aria-label="Month to generate" type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" />
        <Button variant="secondary" disabled={gen.isPending} onClick={() => gen.mutate()}>Generate rent for month</Button>
      </PageHeader>
      {gen.isSuccess && <p role="status" className="mb-3 text-sm text-green-700">{gen.data.data.created} new rent obligation(s) created.</p>}
      {gen.error && <ErrorBox error={gen.error} />}
      <Card>
        <div className="mb-3 flex flex-wrap gap-2">
          <Select aria-label="Status" className="max-w-[12rem]" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">Status: all</option>{['UNPAID', 'PARTIAL', 'OVERDUE', 'PAID'].map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>
          <Input aria-label="Due from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="w-40" />
          <Input aria-label="Due to" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="w-40" />
        </div>
        {q.isLoading ? <Spinner /> : q.error ? <ErrorBox error={q.error} /> : q.data!.data.length === 0 ? <Empty title="No rent obligations" hint="Pick a month above and generate rent for your active leases." /> : (
          <Table headers={['Tenant', 'Unit', 'Due date', 'Due', 'Paid', 'Balance', 'Status', 'Actions']}>
            {q.data!.data.map((o) => (
              <tr key={o.id}>
                <Td className="font-medium">{o.lease.tenant.fullName}</Td><Td>{o.lease.unit.property.name} · {o.lease.unit.number}</Td><Td>{date(o.dueDate)}</Td>
                <Td>{money(o.amountDue)}</Td><Td>{money(o.paidAmount)}</Td><Td>{money(o.balance)}</Td><Td><Badge value={o.displayStatus} /></Td>
                <Td className="whitespace-nowrap">{o.displayStatus !== 'PAID' && <button className="mr-3 text-brand-600 hover:underline" onClick={() => setModal({ kind: 'pay', ob: o })}>Record payment</button>}<button className="text-slate-600 hover:underline" onClick={() => setModal({ kind: 'history', ob: o })}>History</button></Td>
              </tr>
            ))}
          </Table>
        )}
        <Pagination meta={q.data?.meta} onPage={setPage} />
      </Card>
      {modal?.kind === 'pay' && <Modal title="Record payment" onClose={() => setModal(null)}><RecordPayment ob={modal.ob} onDone={() => setModal(null)} /></Modal>}
      {modal?.kind === 'history' && <History ob={modal.ob} onClose={() => setModal(null)} />}
    </>
  );
}
