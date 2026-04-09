import { authStore } from '../store/authStore';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const { accessToken } = authStore.getState();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    // Token expired — attempt refresh
    const refreshed = await authStore.getState().refresh();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${authStore.getState().accessToken}`;
      const retry = await fetch(`${BASE_URL}${path}`, { ...options, headers });
      if (!retry.ok) {
        const err = await retry.json();
        throw new Error(err.error ?? 'Request failed');
      }
      return retry.json() as Promise<T>;
    }
    authStore.getState().logout();
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? 'Request failed');
  }

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
