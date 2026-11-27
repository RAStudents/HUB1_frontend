import type { AuthResponse } from '../api/types';

export const SESSION_KEY = 'hub_auth_session';

interface Session {
  id: string;
  accessToken: string;
  refreshToken: string | null;
}

// Without Web Locks, keep the rotating token private to the tab that received it.
let tabRefreshToken: { id: string; token: string } | undefined;

export function parseSession(value: string | null): Session | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as Session | null;
  } catch {
    return null;
  }
}

export function getSession(): Session | null {
  const session = parseSession(localStorage.getItem(SESSION_KEY));
  if (session) {
    if (tabRefreshToken?.id === session.id) return { ...session, refreshToken: tabRefreshToken.token };
    return session;
  }
  const legacyToken = localStorage.getItem('access_token');
  return legacyToken ? { id: legacyToken, accessToken: legacyToken, refreshToken: null } : null;
}

export function storeSession(tokens: Pick<AuthResponse, 'access_token' | 'refresh_token'>, id?: string) {
  const sessionId = id ?? crypto.getRandomValues(new Uint32Array(4)).join('-');
  tabRefreshToken = !navigator.locks && tokens.refresh_token
    ? { id: sessionId, token: tokens.refresh_token }
    : undefined;
  const oldAccessToken = localStorage.getItem('access_token');
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    id: sessionId,
    accessToken: tokens.access_token,
    refreshToken: navigator.locks ? tokens.refresh_token : null,
  }));
  if (oldAccessToken) localStorage.removeItem('access_token');
}

export function clearSession() {
  tabRefreshToken = undefined;
  localStorage.removeItem('access_token');
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem('auth_user');
}
