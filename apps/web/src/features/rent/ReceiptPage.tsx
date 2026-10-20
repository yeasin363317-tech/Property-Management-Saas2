import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Button, ErrorBox, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { date, label, money } from '../../lib/format';

export default function ReceiptPage() {
  const { id } = useParams();
  const q = useQuery({ queryKey: ['receipt', id], queryFn: () => api<any>(`/payments/${id}/receipt`) });
  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} />;
  const r = q.data!.data;
  const Row = ({ k, v }: { k: string; v: string }) => <div className="flex justify-between border-b py-2 text-sm"><span className="text-slate-500">{k}</span><span className="font-medium">{v}</span></div>;
  return (
    <div className="mx-auto max-w-md">
      <div className="mb-4 flex gap-2 print:hidden"><Link to="/rent" className="rounded-md border px-3 py-2 text-sm">Back</Link><Button onClick={() => window.print()}>Print receipt</Button></div>
      <article className="rounded-lg border bg-white p-6 shadow-sm print:border-0 print:shadow-none">
        <h1 className="text-xl font-semibold">{r.kind === 'REVERSAL' ? 'Payment reversal' : 'Rent receipt'}</h1>
        <p className="mb-4 text-sm text-slate-500">No. {r.receiptNumber} · issued by {r.issuedBy}</p>
        <Row k="Tenant" v={r.tenant} /><Row k="Property" v={`${r.property} — unit ${r.unit}`} /><Row k="Address" v={r.address} />
        <Row k="Rent period" v={String(r.period).slice(0, 7)} /><Row k="Payment date" v={date(r.paidAt)} /><Row k="Method" v={label(r.method)} />
        {r.reference && <Row k="Reference" v={r.reference} />}
        <Row k="Amount" v={money(r.amount)} /><Row k="Rent due for period" v={money(r.rentDue)} /><Row k="Total paid for period" v={money(r.totalPaid)} /><Row k="Balance remaining" v={money(r.balance)} />
      </article>
    </div>
  );
}
