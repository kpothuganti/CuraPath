import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import AppNavigator from './src/navigation/AppNavigator';
import { authStore } from './src/store/authStore';
import { themeStore } from './src/store/themeStore';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const { loadFromStorage } = authStore();
  const preference = themeStore((s) => s.preference);
  const system = useColorScheme();

  const isDark = preference === 'dark' || (preference === 'system' && system !== 'light');
  const statusBarStyle = isDark ? 'light' : 'dark';

  useEffect(() => {
    async function init() {
      try {
        await themeStore.getState().loadFromStorage();
        await loadFromStorage();
        const { refreshToken, refresh, logout } = authStore.getState();
        if (refreshToken) {
          try {
            const success = await refresh();
            if (!success) await logout(); // server explicitly rejected the token (401/403)
          } catch {
            // network or server error on startup — keep the user logged in
          }
        }
      } finally {
        SplashScreen.hideAsync();
      }
    }
    init();
  }, []);

  return (
    <>
      <StatusBar style={statusBarStyle} />
      <AppNavigator />
    </>
  );
}
