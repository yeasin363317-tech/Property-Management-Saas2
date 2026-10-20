import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge, Button, Card, Empty, ErrorBox, PageHeader, Pagination, Spinner } from '../../components/ui';
import { api, qs } from '../../lib/api';
import { date } from '../../lib/format';

export default function NotificationsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ['notifications', page], queryFn: () => api<any[]>(`/notifications${qs({ page })}`) });
  const read = useMutation({ mutationFn: (id: string) => api(`/notifications/${id}/read`, { method: 'POST' }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }); qc.invalidateQueries({ queryKey: ['unread'] }); } });
  const readAll = useMutation({ mutationFn: () => api('/notifications/read-all', { method: 'POST' }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }); qc.invalidateQueries({ queryKey: ['unread'] }); } });
  return (
    <>
      <PageHeader title="Notifications"><Button variant="secondary" disabled={readAll.isPending} onClick={() => readAll.mutate()}>Mark all as read</Button></PageHeader>
      <p className="mb-3 text-sm text-slate-500">In-app alerts only. Email reminders are not sent by this application.</p>
      <Card>
        {q.isLoading ? <Spinner /> : q.error ? <ErrorBox error={q.error} /> : q.data!.data.length === 0 ? <Empty title="You're all caught up" hint="Rent due, overdue rent, expiring leases and maintenance updates appear here." /> : (
          <ul className="divide-y">
            {q.data!.data.map((n) => (
              <li key={n.id} className={`flex items-start justify-between gap-3 py-3 ${n.readAt ? 'opacity-60' : ''}`}>
                <div><div className="flex items-center gap-2"><Badge value={n.type} /><span className="font-medium">{n.title}</span></div><p className="mt-1 text-sm text-slate-600">{n.message}</p><p className="text-xs text-slate-400">{date(n.createdAt)}</p></div>
                {!n.readAt && <button className="shrink-0 text-sm text-brand-600 hover:underline" onClick={() => read.mutate(n.id)}>Mark read</button>}
              </li>
            ))}
          </ul>
        )}
        <Pagination meta={q.data?.meta} onPage={setPage} />
      </Card>
    </>
  );
}
