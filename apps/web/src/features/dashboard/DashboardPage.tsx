import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Card, Empty, ErrorBox, Input, PageHeader, Spinner, Table, Td } from '../../components/ui';
import { api, qs } from '../../lib/api';
import { date, monthStart, money, todayStr } from '../../lib/format';

const Stat = ({ title, value, hint }: { title: string; value: string | number; hint?: string }) => (
  <div className="rounded-lg border bg-white p-4 shadow-sm"><p className="text-xs uppercase text-slate-500">{title}</p><p className="mt-1 text-2xl font-semibold">{value}</p>{hint && <p className="text-xs text-slate-500">{hint}</p>}</div>
);

export default function DashboardPage() {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(todayStr());
  const q = useQuery({ queryKey: ['dashboard', from, to], queryFn: () => api<any>(`/dashboard${qs({ from, to })}`) });
  const d = q.data?.data;
  return (
    <>
      <PageHeader title="Dashboard">
        <Input aria-label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        <Input aria-label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
      </PageHeader>
      {q.isLoading ? <Spinner /> : q.error ? <ErrorBox error={q.error} /> : d && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat title="Properties" value={d.counts.properties} /><Stat title="Units" value={d.counts.units} />
            <Stat title="Occupied" value={d.counts.occupied} /><Stat title="Vacant" value={d.counts.vacant} hint={d.counts.maintenance ? `${d.counts.maintenance} in maintenance` : undefined} />
            <Stat title="Rent due this month" value={money(d.currentMonthRentDue)} />
            <Stat title="Rent collected" value={money(d.rentCollected)} hint={`${d.period.from} → ${d.period.to}`} />
            <Stat title="Outstanding balance" value={money(d.outstandingBalance)} hint="Unpaid rent due up to period end" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Recent payments">{d.recentPayments.length === 0 ? <Empty title="No payments yet" hint="Record a payment from Rent & payments." /> : (
              <Table headers={['Date', 'Tenant', 'Amount']}>{d.recentPayments.map((p: any) => <tr key={p.id}><Td>{date(p.paidAt)}</Td><Td>{p.obligation.lease.tenant.fullName} ({p.obligation.lease.unit.number})</Td><Td>{money(p.amount)}</Td></tr>)}</Table>)}</Card>
            <Card title="Upcoming lease expirations (60 days)" actions={<Link className="text-sm text-brand-600" to="/leases">All leases</Link>}>{d.upcomingLeaseExpirations.length === 0 ? <Empty title="No leases expiring soon" /> : (
              <Table headers={['Tenant', 'Unit', 'Ends']}>{d.upcomingLeaseExpirations.map((l: any) => <tr key={l.id}><Td>{l.tenant.fullName}</Td><Td>{l.unit.number}</Td><Td>{date(l.endDate)}</Td></tr>)}</Table>)}</Card>
            <Card title="Recent maintenance requests" actions={<Link className="text-sm text-brand-600" to="/maintenance">All requests</Link>}>{d.recentMaintenance.length === 0 ? <Empty title="No maintenance requests" /> : (
              <Table headers={['Title', 'Property', 'Status']}>{d.recentMaintenance.map((m: any) => <tr key={m.id}><Td>{m.title}</Td><Td>{m.property.name}</Td><Td><Badge value={m.status} /></Td></tr>)}</Table>)}</Card>
          </div>
        </div>
      )}
    </>
  );
}
