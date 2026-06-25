import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MedicationRecord } from '../types';
import { getPreferredLanguage } from './useLanguage';

async function getNotifStrings(): Promise<{ medTitle: string; medNudgeTitle: string; medNudgeSuffix: string; checkInTitle: string; checkInBody: string }> {
  const lang = await getPreferredLanguage();
  if (lang.code === 'en') {
    return {
      medTitle: 'Time to take your medications',
      medNudgeTitle: 'Did you take your medications?',
      medNudgeSuffix: '— due 30 minutes ago.',
      checkInTitle: 'Morning check-in',
      checkInBody: 'How are you feeling today? Tap to complete your daily symptom check.',
    };
  }
  const cached = await AsyncStorage.getItem(`ui_translations_${lang.code}`);
  if (cached) {
    const s = JSON.parse(cached);
    return {
      medTitle: s.medReminderTitle ?? 'Time to take your medications',
      medNudgeTitle: s.medNudgeTitle ?? 'Did you take your medications?',
      medNudgeSuffix: s.medNudgeSuffix ?? '— due 30 minutes ago.',
      checkInTitle: s.checkInNotifTitle ?? 'Morning check-in',
      checkInBody: s.checkInNotifBody ?? 'How are you feeling today? Tap to complete your daily symptom check.',
    };
  }
  return {
    medTitle: 'Time to take your medications',
    medNudgeTitle: 'Did you take your medications?',
    medNudgeSuffix: '— due 30 minutes ago.',
    checkInTitle: 'Morning check-in',
    checkInBody: 'How are you feeling today? Tap to complete your daily symptom check.',
  };
}

const NOTIF_ID_KEY = 'checkin_notif_id';
const NOTIF_TIME_KEY = 'checkin_time';
const NOTIF_ENABLED_KEY = 'checkin_enabled';
const MED_NOTIF_IDS_KEY = 'med_notif_ids';
const MED_NOTIF_ENABLED_KEY = 'med_notif_enabled';

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

  const strings = await getNotifStrings();

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: strings.checkInTitle,
      body: strings.checkInBody,
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

export async function getMedNotifEnabled(): Promise<boolean> {
  const val = await AsyncStorage.getItem(MED_NOTIF_ENABLED_KEY);
  return val !== 'false';
}

export async function setMedNotifEnabled(enabled: boolean, medications: MedicationRecord[]): Promise<void> {
  await AsyncStorage.setItem(MED_NOTIF_ENABLED_KEY, String(enabled));
  if (enabled) {
    await scheduleMedReminders(medications);
  } else {
    await cancelAllMedReminders();
  }
}

export async function scheduleMedReminders(medications: MedicationRecord[]): Promise<void> {
  await cancelAllMedReminders();

  const { status: existing } = await Notifications.getPermissionsAsync();
  const { status } = existing === 'granted'
    ? { status: 'granted' }
    : await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;

  const strings = await getNotifStrings();
  const ids: string[] = [];

  const timeMap = new Map<string, MedicationRecord[]>();
  for (const med of medications) {
    for (const time of med.times) {
      if (!timeMap.has(time)) timeMap.set(time, []);
      timeMap.get(time)!.push(med);
    }
  }

  for (const [time, meds] of timeMap) {
    const [hourStr, minuteStr] = time.split(':');
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);

    const medList = meds.map((m) => `${m.name} ${m.dose}`).join(' · ');

    const reminderId = await Notifications.scheduleNotificationAsync({
      content: {
        title: strings.medTitle,
        body: medList,
        data: { screen: 'MedReminder', scheduledTime: time },
        interruptionLevel: 'timeSensitive',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
    ids.push(reminderId);

    const nudgeMinute = (minute + 30) % 60;
    const nudgeHour = minute + 30 >= 60 ? (hour + 1) % 24 : hour;

    const nudgeId = await Notifications.scheduleNotificationAsync({
      content: {
        title: strings.medNudgeTitle,
        body: `${medList} ${strings.medNudgeSuffix}`,
        data: { screen: 'MedReminder', scheduledTime: time, isNudge: true },
        interruptionLevel: 'timeSensitive',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: nudgeHour,
        minute: nudgeMinute,
      },
    });
    ids.push(nudgeId);
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
