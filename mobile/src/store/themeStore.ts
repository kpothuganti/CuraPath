import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'theme_preference';

interface ThemeState {
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

export const themeStore = create<ThemeState>((set) => ({
  preference: 'system',
  setPreference: async (preference) => {
    set({ preference });
    await AsyncStorage.setItem(STORAGE_KEY, preference);
  },
  loadFromStorage: async () => {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      set({ preference: stored });
    }
  },
}));
