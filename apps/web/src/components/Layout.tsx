import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../features/auth/AuthContext';

const nav = [
  ['/', 'Dashboard'], ['/properties', 'Properties'], ['/units', 'Units'], ['/tenants', 'Tenants'], ['/leases', 'Leases'],
  ['/rent', 'Rent & payments'], ['/expenses', 'Expenses'], ['/maintenance', 'Maintenance'], ['/reports', 'Reports'], ['/notifications', 'Notifications'], ['/profile', 'Profile'],
] as const;

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const unread = useQuery({ queryKey: ['unread'], queryFn: async () => { await api('/notifications/refresh', { method: 'POST' }); return (await api('/notifications?pageSize=1&unread=true')).meta?.unread as number; }, refetchInterval: 300_000 });
  return (
    <div className="min-h-screen md:flex">
      <header className="flex items-center justify-between border-b bg-white px-4 py-3 md:hidden print:hidden">
        <strong>Property Manager</strong>
        <button aria-label="Toggle menu" aria-expanded={open} className="rounded border px-3 py-1" onClick={() => setOpen(!open)}>Menu</button>
      </header>
      <aside className={`${open ? 'block' : 'hidden'} w-full shrink-0 border-r bg-white p-4 md:block md:w-60 print:hidden`}>
        <p className="mb-4 hidden text-lg font-semibold md:block">Property Manager</p>
        <nav aria-label="Main" className="space-y-1">
          {nav.map(([to, text]) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)} className={({ isActive }) => `flex items-center justify-between rounded-md px-3 py-2 text-sm ${isActive ? 'bg-brand-50 font-medium text-brand-700' : 'text-slate-700 hover:bg-slate-100'}`}>
              {text}{to === '/notifications' && unread.data ? <span className="rounded-full bg-red-600 px-2 text-xs text-white">{unread.data}</span> : null}
            </NavLink>
          ))}
        </nav>
        <div className="mt-6 border-t pt-4 text-sm"><p className="truncate text-slate-600">{user?.name}</p><button className="mt-2 text-brand-600 hover:underline" onClick={async () => { await logout(); navigate('/login'); }}>Sign out</button></div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-6"><Outlet /></main>
    </div>
  );
}
