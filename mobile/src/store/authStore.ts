import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile } from '../types';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// Refresh tokens rotate server-side (old one deleted, new one issued) on every
// use. If two callers race — e.g. App.tsx's proactive refresh on launch and
// client.ts's reactive refresh after a 401 from an already-mounted screen —
// both read the same stale token, the second one to land gets a real 401 from
// the server, and gets treated as an explicit rejection (logout), even though
// the first call already succeeded. Sharing one in-flight promise across all
// callers means only one network request ever happens per refresh cycle.
let refreshPromise: Promise<boolean> | null = null;

interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  persisted: boolean;
  setAuth: (user: UserProfile, accessToken: string, refreshToken: string, persist?: boolean) => Promise<void>;
  updateUser: (user: UserProfile) => Promise<void>;
  refresh: () => Promise<boolean>;
  logout: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

export const authStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: true,
  persisted: false,

  setAuth: async (user, accessToken, refreshToken, persist = false) => {
    if (persist) {
      await AsyncStorage.multiSet([
        ['accessToken', accessToken],
        ['refreshToken', refreshToken],
        ['user', JSON.stringify(user)],
      ]);
    } else {
      // Clear any previously persisted session so old tokens don't auto-login
      await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user']);
    }
    set({ user, accessToken, refreshToken, persisted: persist });
  },

  updateUser: async (user) => {
    if (get().persisted) {
      await AsyncStorage.setItem('user', JSON.stringify(user));
    }
    set({ user });
  },

  refresh: async () => {
    if (refreshPromise) return refreshPromise; // join the in-flight call instead of racing it

    refreshPromise = (async () => {
      const { refreshToken } = get();
      if (!refreshToken) return false;
      // Let network errors throw — caller should only logout on explicit server rejection
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (res.status === 401 || res.status === 403) return false; // explicit token rejection → logout
      if (!res.ok) throw new Error(`refresh failed ${res.status}`); // server error → keep logged in
      const { data } = await res.json();
      await AsyncStorage.multiSet([
        ['accessToken', data.accessToken],
        ['refreshToken', data.refreshToken],
      ]);
      set({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      return true;
    })();

    try {
      return await refreshPromise;
    } finally {
      refreshPromise = null;
    }
  },

  logout: async () => {
    await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user']);
    set({ user: null, accessToken: null, refreshToken: null });
  },

  loadFromStorage: async () => {
    try {
      const [[, accessToken], [, refreshToken], [, userJson]] = await AsyncStorage.multiGet([
        'accessToken',
        'refreshToken',
        'user',
      ]);
      set({
        accessToken,
        refreshToken,
        user: userJson ? JSON.parse(userJson) : null,
        persisted: !!userJson,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },
}));
