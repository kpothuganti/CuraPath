import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

import { authStore } from '../store/authStore';

// Auth screens
import WelcomeScreen from '../screens/Onboarding/WelcomeScreen';
import RegisterScreen from '../screens/Onboarding/RegisterScreen';
import LoginScreen from '../screens/Onboarding/LoginScreen';

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
  // App modals
  Upload: undefined;
  Processing: { type: 'photo' | 'pdf'; base64?: string; text?: string };
  CheckIn: undefined;
  RedFlagAlert: { triggeredFlags: string[]; providerPhone?: string };
  // Tab root
  Tabs: undefined;
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
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarStyle: {
          backgroundColor: '#14141c',
          borderTopColor: 'rgba(255,255,255,0.07)',
        },
        tabBarActiveTintColor: '#4f7eff',
        tabBarInactiveTintColor: '#555',
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Instructions" component={InstructionsScreen} />
      <Tab.Screen name="MedLog" component={MedLogScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, isLoading } = authStore();

  if (isLoading) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="Tabs" component={TabNavigator} />
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
