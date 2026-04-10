import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIF_ID_KEY = 'checkin_notif_id';
const NOTIF_TIME_KEY = 'checkin_time';
const NOTIF_ENABLED_KEY = 'checkin_enabled';

export interface CheckInNotifSettings {
  enabled: boolean;
  hour: number;
  minute: number;
}

export async function getCheckInNotifSettings(): Promise<CheckInNotifSettings> {
  const [enabled, time] = await Promise.all([
    AsyncStorage.getItem(NOTIF_ENABLED_KEY),
    AsyncStorage.getItem(NOTIF_TIME_KEY),
  ]);
  return {
    enabled: enabled !== 'false',
    ...(time ? JSON.parse(time) : { hour: 8, minute: 0 }),
  };
}

export async function scheduleCheckInReminder(hour: number, minute: number): Promise<void> {
  await cancelCheckInReminder();

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Morning check-in',
      body: 'How are you feeling today? Tap to complete your daily symptom check.',
      data: { screen: 'CheckIn' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });

  await AsyncStorage.setItem(NOTIF_ID_KEY, id);
}

export async function cancelCheckInReminder(): Promise<void> {
  const id = await AsyncStorage.getItem(NOTIF_ID_KEY);
  if (id) {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    await AsyncStorage.removeItem(NOTIF_ID_KEY);
  }
}

export async function saveCheckInNotifSettings(settings: CheckInNotifSettings): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(NOTIF_ENABLED_KEY, String(settings.enabled)),
    AsyncStorage.setItem(NOTIF_TIME_KEY, JSON.stringify({ hour: settings.hour, minute: settings.minute })),
  ]);
  if (settings.enabled) {
    await scheduleCheckInReminder(settings.hour, settings.minute);
  } else {
    await cancelCheckInReminder();
  }
}
