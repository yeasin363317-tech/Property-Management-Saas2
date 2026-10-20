import { z } from 'zod';
import { ResourcePage, type ResourceConfig } from '../../components/ResourcePage';
import { Badge } from '../../components/ui';
import { date, money } from '../../lib/format';

const cats = ['REPAIRS', 'UTILITIES', 'TAXES', 'INSURANCE', 'MANAGEMENT', 'CLEANING', 'OTHER'];
const schema = z.object({ propertyId: z.string().uuid().or(z.literal('')).optional(), category: z.enum(cats as [string, ...string[]], { errorMap: () => ({ message: 'Select a category' }) }), amount: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, 'Enter an amount like 150 or 150.25').refine((v) => Number(v) > 0, 'Must be greater than zero'), incurredAt: z.string().min(1, 'Date is required'), notes: z.string().max(1000).optional() });

const cfg: ResourceConfig = {
  title: 'Expenses', singular: 'Expense', path: '/expenses', schema, canDelete: true,
  filters: [{ name: 'category', label: 'Category', options: cats }],
  fields: [
    { name: 'category', label: 'Category', type: 'select', required: true, options: cats }, { name: 'amount', label: 'Amount', type: 'money', required: true },
    { name: 'incurredAt', label: 'Date', type: 'date', required: true }, { name: 'propertyId', label: 'Property (optional)', type: 'select', remote: { path: '/properties', text: (r) => r.name } },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ],
  columns: [{ header: 'Date', render: (r) => date(r.incurredAt) }, { header: 'Category', render: (r) => <Badge value={r.category} /> }, { header: 'Property', render: (r) => r.property?.name ?? '—' }, { header: 'Amount', render: (r) => money(r.amount) }, { header: 'Notes', render: (r) => r.notes ?? '' }],
};
export default () => <ResourcePage cfg={cfg} />;
