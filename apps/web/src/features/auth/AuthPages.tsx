import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { Button, ErrorBox, Field, Input } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from './AuthContext';

function Shell({ title, children, footer }: { title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-lg border bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold">Property Manager</h1>
        <p className="mb-5 text-sm text-slate-500">{title}</p>
        {children}
        {footer && <div className="mt-4 text-center text-sm text-slate-600">{footer}</div>}
      </div>
    </main>
  );
}

const password = z.string().min(10, 'Use at least 10 characters');

export function LoginPage() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [error, setError] = useState<unknown>(null);
  const schema = z.object({ email: z.string().email('Enter a valid email'), password: z.string().min(1, 'Password is required') });
  const f = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  if (user) return <Navigate to="/" replace />;
  return (
    <Shell title="Sign in to your account" footer={<><Link className="text-brand-600" to="/forgot-password">Forgot password?</Link> · <Link className="text-brand-600" to="/register">Create account</Link></>}>
      <form className="space-y-4" onSubmit={f.handleSubmit(async (v) => { setError(null); try { await login(v.email, v.password); nav('/'); } catch (e) { setError(e); } })}>
        {error != null && <ErrorBox error={error} />}
        <Field label="Email" htmlFor="email" error={f.formState.errors.email?.message}><Input id="email" type="email" autoComplete="email" {...f.register('email')} /></Field>
        <Field label="Password" htmlFor="password" error={f.formState.errors.password?.message}><Input id="password" type="password" autoComplete="current-password" {...f.register('password')} /></Field>
        <Button type="submit" className="w-full" disabled={f.formState.isSubmitting}>Sign in</Button>
      </form>
    </Shell>
  );
}

export function RegisterPage() {
  const { user, register } = useAuth();
  const nav = useNavigate();
  const [error, setError] = useState<unknown>(null);
  const schema = z.object({ name: z.string().trim().min(1, 'Name is required'), email: z.string().email('Enter a valid email'), password });
  const f = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  if (user) return <Navigate to="/" replace />;
  return (
    <Shell title="Create your account" footer={<>Already registered? <Link className="text-brand-600" to="/login">Sign in</Link></>}>
      <form className="space-y-4" onSubmit={f.handleSubmit(async (v) => { setError(null); try { await register(v.name, v.email, v.password); nav('/'); } catch (e) { setError(e); } })}>
        {error != null && <ErrorBox error={error} />}
        <Field label="Name" htmlFor="name" error={f.formState.errors.name?.message}><Input id="name" autoComplete="name" {...f.register('name')} /></Field>
        <Field label="Email" htmlFor="email" error={f.formState.errors.email?.message}><Input id="email" type="email" autoComplete="email" {...f.register('email')} /></Field>
        <Field label="Password" htmlFor="password" error={f.formState.errors.password?.message}><Input id="password" type="password" autoComplete="new-password" {...f.register('password')} /></Field>
        <Button type="submit" className="w-full" disabled={f.formState.isSubmitting}>Create account</Button>
      </form>
    </Shell>
  );
}

export function ForgotPasswordPage() {
  const [result, setResult] = useState<{ emailConfigured: boolean } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const schema = z.object({ email: z.string().email('Enter a valid email') });
  const f = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  return (
    <Shell title="Reset your password" footer={<Link className="text-brand-600" to="/login">Back to sign in</Link>}>
      {result ? (
        <p className="text-sm text-slate-700" role="status">
          {result.emailConfigured
            ? 'If an account exists for that address, a reset link has been sent. It expires in 1 hour.'
            : 'Email delivery is not configured on this server, so no email was sent. Ask your administrator to configure SMTP.'}
        </p>
      ) : (
        <form className="space-y-4" onSubmit={f.handleSubmit(async (v) => { setError(null); try { setResult((await api('/auth/forgot-password', { method: 'POST', body: v })).data); } catch (e) { setError(e); } })}>
          {error != null && <ErrorBox error={error} />}
          <Field label="Email" htmlFor="email" error={f.formState.errors.email?.message}><Input id="email" type="email" {...f.register('email')} /></Field>
          <Button type="submit" className="w-full" disabled={f.formState.isSubmitting}>Request reset link</Button>
        </form>
      )}
    </Shell>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const schema = z.object({ password });
  const f = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  return (
    <Shell title="Choose a new password" footer={<Link className="text-brand-600" to="/login">Back to sign in</Link>}>
      {done ? <p role="status" className="text-sm">Password updated. You can now sign in.</p> : (
        <form className="space-y-4" onSubmit={f.handleSubmit(async (v) => { setError(null); try { await api('/auth/reset-password', { method: 'POST', body: { token: params.get('token') ?? '', password: v.password } }); setDone(true); } catch (e) { setError(e); } })}>
          {error != null && <ErrorBox error={error} />}
          <Field label="New password" htmlFor="password" error={f.formState.errors.password?.message}><Input id="password" type="password" autoComplete="new-password" {...f.register('password')} /></Field>
          <Button type="submit" className="w-full" disabled={f.formState.isSubmitting}>Update password</Button>
        </form>
      )}
    </Shell>
  );
}
