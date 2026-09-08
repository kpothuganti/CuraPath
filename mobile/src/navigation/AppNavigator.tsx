import React, { useEffect, useRef } from 'react';
import { NavigationContainerRef, NavigationContainer, NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
import { useUITranslations } from '../hooks/useUITranslations';

// Auth screens
import WelcomeScreen from '../screens/Onboarding/WelcomeScreen';
import RegisterScreen from '../screens/Onboarding/RegisterScreen';
import LoginScreen from '../screens/Onboarding/LoginScreen';
import ForgotPasswordScreen from '../screens/Onboarding/ForgotPasswordScreen';
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
  ForgotPassword: undefined;
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

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, focused, color }: { name: string; focused: boolean; color: string }) {
  const icons: Record<string, { active: IoniconName; inactive: IoniconName }> = {
    Home:         { active: 'home',          inactive: 'home-outline' },
    Instructions: { active: 'document-text', inactive: 'document-text-outline' },
    MedLog:       { active: 'medical',       inactive: 'medical-outline' },
    Settings:     { active: 'settings',      inactive: 'settings-outline' },
  };
  const icon = icons[name];
  return <Ionicons name={focused ? icon.active : icon.inactive} size={24} color={color} />;
}

function TabNavigator() {
  const C = useTheme();
  const { t } = useUITranslations();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color }) => <TabIcon name={route.name} focused={focused} color={color} />,
        tabBarStyle: {
          backgroundColor: C.bg,
          borderTopColor: C.border,
        },
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: C.textMuted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: t('homeTab') }} />
      <Tab.Screen name="Instructions" component={InstructionsScreen} options={{ tabBarLabel: t('instructionsTab') }} />
      <Tab.Screen name="MedLog" component={MedLogScreen} options={{ tabBarLabel: t('medLogTab') }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabel: t('settingsTab') }} />
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
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
