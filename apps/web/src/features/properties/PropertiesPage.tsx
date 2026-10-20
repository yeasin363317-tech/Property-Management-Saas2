import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { ResourcePage, type ResourceConfig } from '../../components/ResourcePage';
import { api } from '../../lib/api';

const schema = z.object({ name: z.string().trim().min(1, 'Name is required').max(120), address: z.string().trim().min(1, 'Address is required').max(300), description: z.string().max(2000).optional() });

function ArchiveButton({ id }: { id: string }) {
  const qc = useQueryClient();
  const m = useMutation({ mutationFn: () => api(`/properties/${id}/archive`, { method: 'POST' }), onSuccess: () => qc.invalidateQueries(), onError: (e) => window.alert((e as Error).message) });
  return <button className="text-amber-700 hover:underline" onClick={() => window.confirm('Archive this property? It will be hidden from lists but its history is kept.') && m.mutate()}>Archive</button>;
}

const cfg: ResourceConfig = {
  title: 'Properties', singular: 'Property', path: '/properties', schema, searchable: true,
  fields: [{ name: 'name', label: 'Name', type: 'text', required: true }, { name: 'address', label: 'Address', type: 'text', required: true }, { name: 'description', label: 'Description', type: 'textarea' }],
  columns: [{ header: 'Name', render: (r) => <span className="font-medium">{r.name}</span> }, { header: 'Address', render: (r) => r.address }, { header: 'Units', render: (r) => r._count?.units ?? 0 }],
  rowActions: (r) => <ArchiveButton id={r.id} />,
};
export default () => <ResourcePage cfg={cfg} />;
