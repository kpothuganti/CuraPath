import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MedicationRecord } from '../types';
import { getPreferredLanguage } from './useLanguage';
import { getMedicationLogs } from '../api/medications';

const EN_NOTIF_STRINGS = {
  medTitle: 'Time to take your medications',
  medNudgeTitle: 'Did you take your medications?',
  medNudgeSuffix: '— due 30 minutes ago.',
  checkInTitle: 'Daily Check-In',
  checkInBody: 'How are you feeling today? Tap to complete your daily symptom check.',
};

function extractNotifStrings(s: Record<string, string>) {
  return {
    medTitle: s.medReminderTitle ?? EN_NOTIF_STRINGS.medTitle,
    medNudgeTitle: s.medNudgeTitle ?? EN_NOTIF_STRINGS.medNudgeTitle,
    medNudgeSuffix: s.medNudgeSuffix ?? EN_NOTIF_STRINGS.medNudgeSuffix,
    checkInTitle: s.checkInNotifTitle ?? EN_NOTIF_STRINGS.checkInTitle,
    checkInBody: s.checkInNotifBody ?? EN_NOTIF_STRINGS.checkInBody,
  };
}

async function getNotifStrings(): Promise<typeof EN_NOTIF_STRINGS> {
  const lang = await getPreferredLanguage();
  if (lang.code === 'en') return EN_NOTIF_STRINGS;

  const cacheKey = `ui_translations_${lang.code}`;
  const cached = await AsyncStorage.getItem(cacheKey);
  if (cached) return extractNotifStrings(JSON.parse(cached));

  // Cache miss (e.g. just cleared before rescheduling) — fetch directly so
  // notifications use the right language regardless of the async fetch race.
  try {
    const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
    const res = await fetch(`${BASE_URL}/translations/ui`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ languageCode: lang.code, languageName: lang.name }),
    });
    if (res.ok) {
      const data: Record<string, string> = await res.json();
      await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
      return extractNotifStrings(data);
    }
  } catch {}

  return EN_NOTIF_STRINGS;
}

const CHECKIN_NOTIF_ID = 'curapath_checkin_daily'; // fixed identifier — rescheduling replaces it atomically
const NOTIF_ID_KEY = 'checkin_notif_id'; // kept for legacy cleanup only
const NOTIF_TIME_KEY = 'checkin_time';
const NOTIF_ENABLED_KEY = 'checkin_enabled';
const MED_NOTIF_IDS_KEY = 'med_notif_ids'; // recurring daily "time to take" reminders only
const MED_NUDGE_MAP_KEY = 'med_nudge_map'; // today's cancellable nudges, keyed by time
const MED_NOTIF_ENABLED_KEY = 'med_notif_enabled';

interface NudgeEntry {
  id: string;
  dateStr: string; // guards against a stale entry surviving into a new day
  medIds: string[];
}

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
  const { status: existing } = await Notifications.getPermissionsAsync();
  const { status } = existing === 'granted'
    ? { status: 'granted' }
    : await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;

  const strings = await getNotifStrings();

  // Using a fixed identifier means rescheduling always replaces the previous
  // check-in notification — no AsyncStorage ID lookup required.
  await Notifications.scheduleNotificationAsync({
    identifier: CHECKIN_NOTIF_ID,
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
}

export async function cancelCheckInReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(CHECKIN_NOTIF_ID).catch(() => {});
  // Cancel legacy by stored ID if present
  const legacyId = await AsyncStorage.getItem(NOTIF_ID_KEY);
  if (legacyId) {
    await Notifications.cancelScheduledNotificationAsync(legacyId).catch(() => {});
    await AsyncStorage.removeItem(NOTIF_ID_KEY);
  }
  // Sweep all scheduled notifications and cancel any orphaned check-in ones by title
  const CHECK_IN_TITLES = ['Morning check-in', 'Daily check-in', 'Daily Check-In'];
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter(n => CHECK_IN_TITLES.includes(n.content.title ?? ''))
      .map(n => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {}))
  );
}

export async function saveCheckInNotifSettings(settings: CheckInNotifSettings, medications?: MedicationRecord[]): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(NOTIF_ENABLED_KEY, String(settings.enabled)),
    AsyncStorage.setItem(NOTIF_TIME_KEY, JSON.stringify({ hour: settings.hour, minute: settings.minute })),
  ]);
  // Nuclear cancel — wipes every scheduled notification to guarantee no orphans survive
  await Notifications.cancelAllScheduledNotificationsAsync();
  await AsyncStorage.multiRemove([NOTIF_ID_KEY, MED_NOTIF_IDS_KEY, MED_NUDGE_MAP_KEY]);
  // Reschedule check-in if enabled
  if (settings.enabled) {
    await scheduleCheckInReminder(settings.hour, settings.minute);
  }
  // Reschedule med reminders so they aren't lost
  if (medications && medications.length > 0) {
    const medEnabled = await getMedNotifEnabled();
    if (medEnabled) await scheduleMedReminders(medications);
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

function medTimeMap(medications: MedicationRecord[]): Map<string, MedicationRecord[]> {
  const timeMap = new Map<string, MedicationRecord[]>();
  for (const med of medications) {
    for (const time of med.times) {
      if (!timeMap.has(time)) timeMap.set(time, []);
      timeMap.get(time)!.push(med);
    }
  }
  return timeMap;
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

  for (const [time, meds] of medTimeMap(medications)) {
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
  }

  await AsyncStorage.setItem(MED_NOTIF_IDS_KEY, JSON.stringify(ids));

  // Nudges are scheduled separately (not recurring) so a logged dose can
  // cancel just today's nudge without affecting tomorrow's.
  await refreshTodayNudges(medications);
}

// A "did you take it?" nudge fires 30 minutes after a dose time, but only if
// that dose hasn't actually been logged. Local notifications can't be
// cancelled per-occurrence of a recurring trigger — cancelling by ID kills
// the whole daily series — so nudges are scheduled fresh, one day at a time,
// as one-shot notifications for today only. Call this once per day (e.g. on
// app open) to keep today's window populated; cancelNudgeIfComplete handles
// suppressing one when its doses get logged.
//
// This function awaits a network fetch plus a loop of schedule calls, which
// takes a real moment — if a dose gets tapped "Take" while this is still
// running, cancelNudgeIfComplete (fired by that tap) finds nothing to
// cancel yet, and this function would otherwise finish a moment later using
// stale pre-tap data, scheduling a nudge nothing will ever cancel.
// getLiveTakenKeys reads the live client-side ref at each decision point
// (not a frozen snapshot), closing that window to just the final check.
export async function refreshTodayNudges(
  medications: MedicationRecord[],
  getLiveTakenKeys?: () => Set<string>
): Promise<void> {
  // Clear whatever was scheduled for a previous day before recomputing.
  await cancelAllNudges();

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  const strings = await getNotifStrings();
  const todayStr = new Date().toDateString();
  const now = new Date();

  const logsRes = await getMedicationLogs(1);
  const takenToday = new Set(
    logsRes.data
      .filter((l) => !l.skipped && l.taken_at && new Date(l.taken_at).toDateString() === todayStr)
      .map((l) => {
        const t = new Date(l.scheduled_time);
        const hh = String(t.getHours()).padStart(2, '0');
        const mm = String(t.getMinutes()).padStart(2, '0');
        return `${l.medication_id}_${hh}:${mm}`;
      })
  );

  const nudgeMap: Record<string, NudgeEntry> = {};

  for (const [time, meds] of medTimeMap(medications)) {
    const liveTaken = getLiveTakenKeys?.() ?? new Set<string>();
    const allTaken = meds.every((m) => takenToday.has(`${m.id}_${time}`) || liveTaken.has(`${m.id}_${time}`));
    if (allTaken) continue; // already handled — no nudge needed

    const [hourStr, minuteStr] = time.split(':');
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);
    const nudgeMinute = (minute + 30) % 60;
    const nudgeHour = minute + 30 >= 60 ? (hour + 1) % 24 : hour;

    const nudgeDate = new Date();
    nudgeDate.setHours(nudgeHour, nudgeMinute, 0, 0);
    if (nudgeDate <= now) continue; // this dose's nudge window already passed today

    const medList = meds.map((m) => `${m.name} ${m.dose}`).join(' · ');
    const nudgeId = await Notifications.scheduleNotificationAsync({
      content: {
        title: strings.medNudgeTitle,
        body: `${medList} ${strings.medNudgeSuffix}`,
        data: { screen: 'MedReminder', scheduledTime: time, isNudge: true },
        interruptionLevel: 'timeSensitive',
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: nudgeDate },
    });

    nudgeMap[time] = { id: nudgeId, dateStr: todayStr, medIds: meds.map((m) => m.id) };
  }

  await AsyncStorage.setItem(MED_NUDGE_MAP_KEY, JSON.stringify(nudgeMap));
}

// Called after logging a dose as taken — cancels today's nudge for that
// time slot once every medication scheduled at that time has been logged.
export async function cancelNudgeIfComplete(time: string, takenKeys: Set<string>): Promise<void> {
  const stored = await AsyncStorage.getItem(MED_NUDGE_MAP_KEY);
  if (!stored) return;
  const nudgeMap: Record<string, NudgeEntry> = JSON.parse(stored);

  const entry = nudgeMap[time];
  if (!entry || entry.dateStr !== new Date().toDateString()) return;

  const allTaken = entry.medIds.every((medId) => takenKeys.has(`${medId}_${time}`));
  if (!allTaken) return;

  await Notifications.cancelScheduledNotificationAsync(entry.id).catch(() => {});
  delete nudgeMap[time];
  await AsyncStorage.setItem(MED_NUDGE_MAP_KEY, JSON.stringify(nudgeMap));
}

async function cancelAllNudges(): Promise<void> {
  const stored = await AsyncStorage.getItem(MED_NUDGE_MAP_KEY);
  if (stored) {
    const nudgeMap: Record<string, NudgeEntry> = JSON.parse(stored);
    await Promise.all(
      Object.values(nudgeMap).map((entry) => Notifications.cancelScheduledNotificationAsync(entry.id).catch(() => {}))
    );
    await AsyncStorage.removeItem(MED_NUDGE_MAP_KEY);
  }
}

export async function cancelAllMedReminders(): Promise<void> {
  const stored = await AsyncStorage.getItem(MED_NOTIF_IDS_KEY);
  if (stored) {
    const ids: string[] = JSON.parse(stored);
    await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
    await AsyncStorage.removeItem(MED_NOTIF_IDS_KEY);
  }
  await cancelAllNudges();
}
