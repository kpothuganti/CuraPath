import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import AppNavigator from './src/navigation/AppNavigator';
import { authStore } from './src/store/authStore';

export default function App() {
  const { loadFromStorage } = authStore();

  useEffect(() => {
    async function init() {
      await loadFromStorage();
      // Proactively refresh the access token on startup so the first API
      // call never hits a 401 due to an expired token from a previous session
      const { refreshToken, refresh, logout } = authStore.getState();
      if (refreshToken) {
        const success = await refresh();
        if (!success) await logout();
      }
    }
    init();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <AppNavigator />
    </>
  );
}
