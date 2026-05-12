import React, { useEffect, useRef } from 'react';
import { NavigationContainerRef, NavigationContainer, NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import * as Notifications from 'expo-notifications';

// Show notifications when app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

import { authStore } from '../store/authStore';
import { useTheme } from '../hooks/useTheme';

// Auth screens
import WelcomeScreen from '../screens/Onboarding/WelcomeScreen';
import RegisterScreen from '../screens/Onboarding/RegisterScreen';
import LoginScreen from '../screens/Onboarding/LoginScreen';
import PermissionsScreen from '../screens/Onboarding/PermissionsScreen';
import ReviewScreen from '../screens/Review/ReviewScreen';

// App screens
import HomeScreen from '../screens/Home/HomeScreen';
import InstructionsScreen from '../screens/Instructions/InstructionsScreen';
import MedLogScreen from '../screens/MedLog/MedLogScreen';
import SettingsScreen from '../screens/Settings/SettingsScreen';
import UploadScreen from '../screens/Upload/UploadScreen';
import ProcessingScreen from '../screens/Processing/ProcessingScreen';
import CheckInScreen from '../screens/CheckIn/CheckInScreen';
import RedFlagAlertScreen from '../screens/RedFlagAlert/RedFlagAlertScreen';

export type RootStackParamList = {
  // Auth
  Welcome: undefined;
  Register: undefined;
  Login: undefined;
  Permissions: undefined;
  // App modals
  Upload: undefined;
  Processing: { type: 'photo' | 'pdf'; base64?: string; text?: string };
  Review: { parsedJson: import('../../../shared/types').DischargeJSON; uploadParams: { type: 'photo' | 'pdf'; base64?: string; text?: string } };
  CheckIn: undefined;
  RedFlagAlert: { triggeredFlags: string[]; providerPhone?: string };
  // Tab root
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
};

export type TabParamList = {
  Home: undefined;
  Instructions: undefined;
  MedLog: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Home: '🏠',
    Instructions: '📋',
    MedLog: '💊',
    Settings: '⚙️',
  };
  return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.4 }}>{icons[name]}</Text>;
}

function TabNavigator() {
  const C = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarStyle: {
          backgroundColor: C.bg,
          borderTopColor: C.border,
        },
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: C.textMuted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Instructions" component={InstructionsScreen} />
      <Tab.Screen name="MedLog" component={MedLogScreen} options={{ tabBarLabel: 'Med Log' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, isLoading } = authStore();
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);

  useEffect(() => {
    function handleNotificationData(data: Record<string, unknown>) {
      if (data?.screen === 'CheckIn') {
        navigationRef.current?.navigate('CheckIn');
      } else if (data?.screen === 'MedReminder') {
        navigationRef.current?.navigate('Tabs');
      }
    }

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response?.notification.request.content.data) {
        handleNotificationData(response.notification.request.content.data as Record<string, unknown>);
      }
    });

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationData(response.notification.request.content.data as Record<string, unknown>);
    });
    return () => sub.remove();
  }, []);

  if (isLoading) return null;

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="Tabs" component={TabNavigator} />
            <Stack.Screen name="Permissions" component={PermissionsScreen} />
            <Stack.Screen name="Review" component={ReviewScreen} options={{ presentation: 'modal', gestureEnabled: false }} />
            <Stack.Screen name="Upload" component={UploadScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="Processing" component={ProcessingScreen} options={{ presentation: 'modal', gestureEnabled: false }} />
            <Stack.Screen name="CheckIn" component={CheckInScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="RedFlagAlert" component={RedFlagAlertScreen} options={{ presentation: 'modal', gestureEnabled: false }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
