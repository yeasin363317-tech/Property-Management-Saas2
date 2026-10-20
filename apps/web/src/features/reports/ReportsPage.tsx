import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Card, Empty, ErrorBox, Input, PageHeader, Select, Spinner, Table, Td } from '../../components/ui';
import { api, qs } from '../../lib/api';
import { money, monthStart, todayStr } from '../../lib/format';

const kinds = [
  ['summary', 'Summary'], ['monthly', 'Monthly income & expenses'], ['by-property', 'By property'], ['collections', 'Rent collection (payments)'], ['outstanding', 'Outstanding balances'], ['expenses', 'Expenses'],
] as const;
const moneyCols = new Set(['rentDue', 'rentCollected', 'outstandingBalance', 'expenses', 'netOperatingCashFlow', 'amountDue', 'paid', 'balance', 'amount']);
const names: Record<string, string> = { netOperatingCashFlow: 'Net operating cash flow', rentDue: 'Rent due', rentCollected: 'Rent collected', outstandingBalance: 'Outstanding balance', amountDue: 'Amount due' };
const heading = (k: string) => names[k] ?? k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());

export default function ReportsPage() {
  const [kind, setKind] = useState<string>('summary');
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(todayStr());
  const [propertyId, setPropertyId] = useState('');
  const props = useQuery({ queryKey: ['options', '/properties'], queryFn: () => api<any[]>('/properties?pageSize=100') });
  const params = { from, to, propertyId };
  const q = useQuery({ queryKey: ['report', kind, params], queryFn: () => api<any>(`/reports/${kind}${qs(params)}`) });
  const rows: Record<string, unknown>[] = q.data ? (Array.isArray(q.data.data) ? q.data.data : [q.data.data]) : [];
  const cols = rows[0] ? Object.keys(rows[0]).filter((c) => c !== 'from' && c !== 'to') : [];
  const csvHref = `/api/v1/reports/${kind}${qs({ ...params, format: 'csv' })}`;
  return (
    <>
      <PageHeader title="Reports">
        <Button variant="secondary" onClick={() => window.print()}>Print</Button>
        <a href={csvHref} className="inline-flex items-center rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">Export CSV</a>
      </PageHeader>
      <Card>
        <div className="mb-4 flex flex-wrap gap-2 print:hidden">
          <Select aria-label="Report" className="max-w-[16rem]" value={kind} onChange={(e) => setKind(e.target.value)}>{kinds.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</Select>
          <Input aria-label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          <Input aria-label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          {kind !== 'by-property' && <Select aria-label="Property" className="max-w-[14rem]" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}><option value="">All properties</option>{props.data?.data.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>}
        </div>
        <h2 className="mb-2 hidden text-lg font-semibold print:block">{kinds.find(([k]) => k === kind)![1]} · {from} to {to}</h2>
        {q.isLoading ? <Spinner /> : q.error ? <ErrorBox error={q.error} /> : rows.length === 0 ? <Empty title="No data for this period" /> : (
          <Table headers={cols.map(heading)}>{rows.map((r, i) => <tr key={i}>{cols.map((c) => <Td key={c}>{moneyCols.has(c) ? money(r[c] as string) : String(r[c] ?? '')}</Td>)}</tr>)}</Table>
        )}
        {kind === 'summary' && <p className="mt-4 text-xs text-slate-500">Rent collected is cash received in the period, not profit. Net operating cash flow = rent collected − expenses. Outstanding balance is the unpaid rent that was due on or before the end date.</p>}
      </Card>
    </>
  );
}
