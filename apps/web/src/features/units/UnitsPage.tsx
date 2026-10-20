import { z } from 'zod';
import { ResourcePage, type ResourceConfig } from '../../components/ResourcePage';
import { Badge } from '../../components/ui';
import { money } from '../../lib/format';

const amount = z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, 'Enter an amount like 1200 or 1200.50');
const schema = z.object({ propertyId: z.string().uuid('Select a property'), number: z.string().trim().min(1, 'Unit number is required').max(40), description: z.string().max(1000).optional(), monthlyRent: amount, status: z.enum(['VACANT', 'MAINTENANCE']).or(z.literal('')).optional() });

const cfg: ResourceConfig = {
  title: 'Units', singular: 'Unit', path: '/units', schema, searchable: true,
  filters: [{ name: 'status', label: 'Status', options: ['VACANT', 'OCCUPIED', 'MAINTENANCE'] }],
  fields: [
    { name: 'propertyId', label: 'Property', type: 'select', required: true, createOnly: true, remote: { path: '/properties', text: (r) => r.name } },
    { name: 'number', label: 'Unit number', type: 'text', required: true },
    { name: 'monthlyRent', label: 'Monthly rent', type: 'money', required: true },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'status', label: 'Status override (vacant / maintenance)', type: 'select', options: ['VACANT', 'MAINTENANCE'] },
  ],
  columns: [
    { header: 'Unit', render: (r) => <span className="font-medium">{r.number}</span> }, { header: 'Property', render: (r) => r.property?.name },
    { header: 'Rent', render: (r) => money(r.monthlyRent) }, { header: 'Status', render: (r) => <Badge value={r.status} /> },
    { header: 'Tenant', render: (r) => r.leases?.[0]?.tenant.fullName ?? '—' },
  ],
};
export default () => <ResourcePage cfg={cfg} />;
