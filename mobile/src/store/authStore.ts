import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile } from '../types';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  setAuth: (user: UserProfile, accessToken: string, refreshToken: string, persist?: boolean) => Promise<void>;
  refresh: () => Promise<boolean>;
  logout: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

export const authStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: true,

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
    set({ user, accessToken, refreshToken });
  },

  refresh: async () => {
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
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },
}));
