import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { api } from '../../lib/api';
import { ResourcePage, type ResourceConfig } from '../../components/ResourcePage';
import { Badge } from '../../components/ui';

const schema = z.object({ fullName: z.string().trim().min(1, 'Name is required').max(120), email: z.string().email('Enter a valid email').or(z.literal('')).optional(), phone: z.string().max(40).optional(), emergencyContact: z.string().max(300).optional(), active: z.any().optional() });

function ActiveToggle({ t }: { t: any }) {
  const qc = useQueryClient();
  const m = useMutation({ mutationFn: () => api(`/tenants/${t.id}`, { method: 'PATCH', body: { active: !t.active } }), onSuccess: () => qc.invalidateQueries(), onError: (e) => window.alert((e as Error).message) });
  return <button className="text-amber-700 hover:underline" onClick={() => (t.active ? window.confirm('Mark this tenant as former?') : true) && m.mutate()}>{t.active ? 'Mark former' : 'Reactivate'}</button>;
}

const cfg: ResourceConfig = {
  title: 'Tenants', singular: 'Tenant', path: '/tenants', schema, searchable: true,
  filters: [{ name: 'active', label: 'Status', options: ['true', 'false'] }],
  rowActions: (r) => <ActiveToggle t={r} />,
  fields: [
    { name: 'fullName', label: 'Full name', type: 'text', required: true }, { name: 'email', label: 'Email', type: 'email' }, { name: 'phone', label: 'Phone', type: 'text' },
    { name: 'emergencyContact', label: 'Emergency contact (optional)', type: 'text' },
  ],
  columns: [{ header: 'Name', render: (r) => <span className="font-medium">{r.fullName}</span> }, { header: 'Email', render: (r) => r.email ?? '—' }, { header: 'Phone', render: (r) => r.phone ?? '—' }, { header: 'Status', render: (r) => <Badge value={r.active ? 'ACTIVE' : 'FORMER'} /> }],
};
export default () => <ResourcePage cfg={cfg} />;
