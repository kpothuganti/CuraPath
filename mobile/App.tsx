import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import AppNavigator from './src/navigation/AppNavigator';
import { authStore } from './src/store/authStore';

export default function App() {
  const { loadFromStorage } = authStore();

  useEffect(() => {
    loadFromStorage();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <AppNavigator />
    </>
  );
}
