export type StoredSession = {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  user_id?: string;
  user_email?: string;
};

export type SignUpResult = {
  session: StoredSession | null;
  requiresEmailConfirmation: boolean;
};

export const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
export const SUPABASE_AUTH_ENABLED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
const AUTH_STORAGE_KEY = 'hoot_auth_session_v1';

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  expires_in?: number;
  user?: {
    id?: string;
    email?: string;
  };
  error_description?: string;
  msg?: string;
  error?: string;
};

function authEndpoint(path: string): string {
  if (!SUPABASE_URL) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured.');
  }
  return `${SUPABASE_URL}/auth/v1/${path}`;
}

function mapTokenResponse(payload: unknown): StoredSession {
  const body = (payload ?? {}) as TokenResponse;
  const expiresIn = Number(body.expires_in || 3600);
  const nowSec = Math.floor(Date.now() / 1000);
  return {
    access_token: String(body.access_token || ''),
    refresh_token: String(body.refresh_token || ''),
    expires_at: Number(body.expires_at || nowSec + expiresIn),
    user_id: body.user?.id ? String(body.user.id) : undefined,
    user_email: body.user?.email ? String(body.user.email) : undefined,
  };
}

export async function signInWithPassword(email: string, password: string): Promise<StoredSession> {
  if (!SUPABASE_AUTH_ENABLED) {
    throw new Error('Supabase auth is not configured.');
  }
  const resp = await fetch(authEndpoint('token?grant_type=password'), {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  const body: TokenResponse = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = String(body.error_description || body.msg || body.error || 'Sign in failed.');
    throw new Error(msg);
  }
  const session = mapTokenResponse(body);
  if (!session.access_token) {
    throw new Error('Sign in did not return an access token.');
  }
  return session;
}

export async function signUpWithPassword(email: string, password: string): Promise<SignUpResult> {
  if (!SUPABASE_AUTH_ENABLED) {
    throw new Error('Supabase auth is not configured.');
  }
  const resp = await fetch(authEndpoint('signup'), {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  const body: TokenResponse = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = String(body.error_description || body.msg || body.error || 'Sign up failed.');
    throw new Error(msg);
  }
  const mapped = mapTokenResponse(body);
  const session = mapped.access_token ? mapped : null;
  return {
    session,
    requiresEmailConfirmation: session === null,
  };
}

export async function refreshSession(refreshToken: string): Promise<StoredSession> {
  if (!SUPABASE_AUTH_ENABLED) {
    throw new Error('Supabase auth is not configured.');
  }
  const resp = await fetch(authEndpoint('token?grant_type=refresh_token'), {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const body: TokenResponse = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = String(body.error_description || body.msg || body.error || 'Session refresh failed.');
    throw new Error(msg);
  }
  const session = mapTokenResponse(body);
  if (!session.access_token) {
    throw new Error('Session refresh did not return an access token.');
  }
  return session;
}

export function loadStoredSession(): StoredSession | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.access_token) return null;
    return parsed as StoredSession;
  } catch {
    return null;
  }
}

export function saveStoredSession(session: StoredSession): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredSession(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

export async function ensureActiveSession(session: StoredSession | null): Promise<StoredSession | null> {
  if (!session?.access_token) return null;
  const nowSec = Math.floor(Date.now() / 1000);
  const expiresAt = Number(session.expires_at || 0);
  if (!expiresAt || expiresAt > nowSec + 30) {
    return session;
  }
  if (!session.refresh_token) return null;
  try {
    return await refreshSession(session.refresh_token);
  } catch {
    return null;
  }
}
