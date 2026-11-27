import axios, { type InternalAxiosRequestConfig } from 'axios';
import { clearSession, getSession, storeSession } from '../auth/session';
import type { AuthResponse } from './types';

const options = {
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  headers: { 'Content-Type': 'application/json' },
};
export const apiClient = axios.create(options);
const refreshClient = axios.create(options);

const publicAuthPaths = new Set(['/auth/login', '/auth/register', '/auth/yandex/login', '/auth/yandex/callback']);
const refreshLock = 'hub-auth-refresh';

interface SessionRequest extends InternalAxiosRequestConfig {
  sessionId?: string;
  sentAccessToken?: string;
  retriedAfterRefresh?: boolean;
}

let activeRefresh: { sessionId: string; promise: Promise<boolean> } | undefined;

function refreshSession(sessionId: string, failedToken: string) {
  if (activeRefresh?.sessionId === sessionId) return activeRefresh.promise;

  const exchange = async () => {
    const session = getSession();
    if (!session || session.id !== sessionId) return false;
    if (session.accessToken !== failedToken) return true;

    if (session.refreshToken) {
      try {
        const { data } = await refreshClient.post<AuthResponse>('/auth/refresh', {
          refresh_token: session.refreshToken,
        });
        if (getSession()?.id !== sessionId) return false;
        storeSession(data, sessionId);
        return true;
      } catch (error) {
        if (!axios.isAxiosError(error) || error.response?.status !== 401) throw error;
      }
    }

    if (getSession()?.id === sessionId) {
      clearSession();
      if (window.location.pathname !== '/login') window.location.assign('/login');
    }
    return false;
  };

  const promise = (navigator.locks ? navigator.locks.request(refreshLock, exchange) : exchange())
    .finally(() => {
      if (activeRefresh?.promise === promise) activeRefresh = undefined;
    });
  activeRefresh = { sessionId, promise };
  return promise;
}

apiClient.interceptors.request.use((config: SessionRequest) => {
  if (publicAuthPaths.has(config.url ?? '')) return config;

  const session = getSession();
  if (config.retriedAfterRefresh && config.sessionId !== session?.id) {
    throw new axios.CanceledError('Сессия изменилась');
  }
  if (session) {
    config.sessionId = session.id;
    config.sentAccessToken = session.accessToken;
    config.headers.set('Authorization', `Bearer ${session.accessToken}`);
  }
  return config;
});

apiClient.interceptors.response.use(undefined, async (error: unknown) => {
  if (!axios.isAxiosError(error) || error.response?.status !== 401) throw error;

  const config: SessionRequest | undefined = error.config;
  if (!config?.sessionId || !config.sentAccessToken || config.retriedAfterRefresh) throw error;

  if (!await refreshSession(config.sessionId, config.sentAccessToken)) throw error;
  config.retriedAfterRefresh = true;
  return apiClient.request(config);
});
