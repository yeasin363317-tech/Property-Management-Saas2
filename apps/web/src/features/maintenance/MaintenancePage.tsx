import { z } from 'zod';
import { ResourcePage, type ResourceConfig } from '../../components/ResourcePage';
import { Badge } from '../../components/ui';
import { money } from '../../lib/format';

const prio = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const stat = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED'];
const cost = z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, 'Enter an amount like 80 or 80.50').or(z.literal('')).optional();
const schema = z.object({ propertyId: z.string().uuid('Select a property'), title: z.string().trim().min(1, 'Title is required').max(160), description: z.string().trim().min(1, 'Description is required').max(4000), priority: z.enum(prio as [string, ...string[]]).or(z.literal('')).optional(), status: z.enum(stat as [string, ...string[]]).or(z.literal('')).optional(), estimatedCost: cost, actualCost: cost });

const cfg: ResourceConfig = {
  title: 'Maintenance', singular: 'Request', path: '/maintenance', schema,
  filters: [{ name: 'status', label: 'Status', options: stat }, { name: 'priority', label: 'Priority', options: prio }],
  defaults: { priority: 'MEDIUM' },
  fields: [
    { name: 'propertyId', label: 'Property', type: 'select', required: true, createOnly: true, remote: { path: '/properties', text: (r) => r.name } },
    { name: 'title', label: 'Title', type: 'text', required: true }, { name: 'description', label: 'Description', type: 'textarea', required: true },
    { name: 'priority', label: 'Priority', type: 'select', options: prio }, { name: 'status', label: 'Status', type: 'select', options: stat },
    { name: 'estimatedCost', label: 'Estimated cost', type: 'money' }, { name: 'actualCost', label: 'Actual cost', type: 'money' },
  ],
  columns: [
    { header: 'Title', render: (r) => <span className="font-medium">{r.title}</span> }, { header: 'Property', render: (r) => r.property?.name },
    { header: 'Priority', render: (r) => <Badge value={r.priority} /> }, { header: 'Status', render: (r) => <Badge value={r.status} /> },
    { header: 'Est. / actual', render: (r) => `${r.estimatedCost ? money(r.estimatedCost) : '—'} / ${r.actualCost ? money(r.actualCost) : '—'}` },
  ],
};
export default () => <ResourcePage cfg={cfg} />;
