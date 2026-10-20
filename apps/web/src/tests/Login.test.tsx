import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../features/auth/AuthContext';
import { LoginPage } from '../features/auth/AuthPages';

function setup(fetchImpl: typeof fetch) {
  vi.stubGlobal('fetch', fetchImpl);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter><AuthProvider><LoginPage /></AuthProvider></MemoryRouter>
    </QueryClientProvider>,
  );
}
afterEach(() => vi.unstubAllGlobals());

const json = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

describe('LoginPage', () => {
  it('shows validation messages for empty and malformed input without calling the API login', async () => {
    const fetchMock = vi.fn(() => json(401, { error: { message: 'no session' } })) as unknown as typeof fetch;
    setup(fetchMock);
    await userEvent.click(await screen.findByRole('button', { name: /sign in/i }));
    expect(await screen.findByText('Enter a valid email')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect((fetchMock as any).mock.calls.some((c: any[]) => String(c[0]).endsWith('/auth/login'))).toBe(false);
  });

  it('shows the server error for wrong credentials', async () => {
    const fetchMock = vi.fn((url: string) => (String(url).endsWith('/auth/login') ? json(401, { error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' } }) : json(401, { error: { message: 'no session' } }))) as unknown as typeof fetch;
    setup(fetchMock);
    await userEvent.type(await screen.findByLabelText('Email'), 'a@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrongpass');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password'));
  });
});
