import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MedicationRecord } from '../types';

const NOTIF_ID_KEY = 'checkin_notif_id';
const NOTIF_TIME_KEY = 'checkin_time';
const NOTIF_ENABLED_KEY = 'checkin_enabled';
const MED_NOTIF_IDS_KEY = 'med_notif_ids';

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

  const { status: existing } = await Notifications.getPermissionsAsync();
  const { status } = existing === 'granted'
    ? { status: 'granted' }
    : await Notifications.requestPermissionsAsync();
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

// ─── Medication reminders ─────────────────────────────────────────────────────

export async function scheduleMedReminders(medications: MedicationRecord[]): Promise<void> {
  await cancelAllMedReminders();

  const { status: existing } = await Notifications.getPermissionsAsync();
  const { status } = existing === 'granted'
    ? { status: 'granted' }
    : await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;

  const ids: string[] = [];

  for (const med of medications) {
    for (const time of med.times) {
      const [hourStr, minuteStr] = time.split(':');
      const hour = parseInt(hourStr, 10);
      const minute = parseInt(minuteStr, 10);

      // Primary reminder at scheduled time
      const reminderId = await Notifications.scheduleNotificationAsync({
        content: {
          title: `Time to take ${med.name}`,
          body: `${med.dose} · ${med.instructions}`,
          data: { screen: 'MedReminder', medicationId: med.id, scheduledTime: time },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
        },
      });
      ids.push(reminderId);

      // Missed-dose nudge 30 minutes later
      const nudgeMinute = (minute + 30) % 60;
      const nudgeHour = minute + 30 >= 60 ? (hour + 1) % 24 : hour;

      const nudgeId = await Notifications.scheduleNotificationAsync({
        content: {
          title: `Did you take ${med.name}?`,
          body: 'You have a dose that was due 30 minutes ago.',
          data: { screen: 'MedReminder', medicationId: med.id, scheduledTime: time, isNudge: true },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: nudgeHour,
          minute: nudgeMinute,
        },
      });
      ids.push(nudgeId);
    }
  }

  await AsyncStorage.setItem(MED_NOTIF_IDS_KEY, JSON.stringify(ids));
}

export async function cancelAllMedReminders(): Promise<void> {
  const stored = await AsyncStorage.getItem(MED_NOTIF_IDS_KEY);
  if (stored) {
    const ids: string[] = JSON.parse(stored);
    await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
    await AsyncStorage.removeItem(MED_NOTIF_IDS_KEY);
  }
}
