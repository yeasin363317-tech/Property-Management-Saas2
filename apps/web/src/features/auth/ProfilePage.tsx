import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, Card, ErrorBox, Field, Input, PageHeader } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth, type User } from './AuthContext';

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  currentPassword: z.string().optional(),
  newPassword: z.string().optional().refine((v) => !v || v.length >= 10, 'Use at least 10 characters'),
});

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const [msg, setMsg] = useState('');
  const [error, setError] = useState<unknown>(null);
  const f = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { name: user?.name } });
  return (
    <>
      <PageHeader title="Profile" />
      <div className="max-w-md"><Card>
        <form className="space-y-4" onSubmit={f.handleSubmit(async (v) => {
          setError(null); setMsg('');
          try {
            const body = { name: v.name, ...(v.newPassword ? { currentPassword: v.currentPassword, newPassword: v.newPassword } : {}) };
            setUser((await api<User>('/auth/me', { method: 'PATCH', body })).data);
            f.reset({ name: v.name }); setMsg('Profile saved.');
          } catch (e) { setError(e); }
        })}>
          {error != null && <ErrorBox error={error} />}
          {msg && <p role="status" className="text-sm text-green-700">{msg}</p>}
          <p className="text-sm text-slate-500">Signed in as {user?.email} ({user?.role.toLowerCase()})</p>
          <Field label="Name" htmlFor="name" error={f.formState.errors.name?.message}><Input id="name" {...f.register('name')} /></Field>
          <Field label="Current password (only to change password)" htmlFor="cp"><Input id="cp" type="password" autoComplete="current-password" {...f.register('currentPassword')} /></Field>
          <Field label="New password" htmlFor="np" error={f.formState.errors.newPassword?.message}><Input id="np" type="password" autoComplete="new-password" {...f.register('newPassword')} /></Field>
          <Button type="submit" disabled={f.formState.isSubmitting}>Save changes</Button>
        </form>
      </Card></div>
    </>
  );
}
