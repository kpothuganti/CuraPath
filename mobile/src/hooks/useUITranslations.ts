import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/client';
import { getPreferredLanguage, SUPPORTED_LANGUAGES } from './useLanguage';

export type UIStrings = Record<string, string>;

const CACHE_PREFIX = 'ui_translations_';

const EN_FALLBACK: UIStrings = {
  goodMorning: 'Good Morning',
  goodAfternoon: 'Good Afternoon',
  goodEvening: 'Good Evening',
  dayOfRecovery: 'Day {n} of Recovery',
  recoveryProgress: 'Recovery Progress',
  daysProgress: '{done} of 30 days · {remaining} days remaining',
  dailyCheckIn: 'Daily Check-In',
  howAreYouFeeling: 'How are you feeling today?',
  questionsCount: '{n} questions · takes 1 minute',
  todaysMedications: "Today's Medications",
  take: 'Take',
  taken: 'Taken',
  activityReminders: 'Activity Reminders',
  updateInstructions: 'Update instructions',
  welcomeTitle: 'Welcome to CuraPath',
  uploadPrompt: 'Upload your discharge paperwork to get started.',
  uploadBtn: 'Upload instructions',
  yourInstructions: 'Your Instructions',
  uploaded: 'Uploaded',
  warningSigns: 'Warning signs — call your doctor if you notice:',
  medicationsSection: 'Medications',
  activityRestrictionsSection: 'Activity restrictions',
  followUpSection: 'Follow-up appointments',
  dietSection: 'Diet',
  woundCareSection: 'Wound Care',
  sleepingSection: 'Sleeping',
  exercisesSection: 'Exercises',
  medicationLog: 'Medication Log',
  last30Days: 'Last 30 days',
  today: 'Today',
  takenStatus: 'Taken',
  skippedStatus: 'Skipped',
  missedStatus: 'Missed',
  upcomingStatus: 'Upcoming',
  noMedicationsScheduled: 'No medications scheduled.',
  dailyCheckInTitle: 'Daily Check-In',
  checkInSubtitle: "Answer a few quick questions about how you're feeling today.",
  yes: 'Yes',
  no: 'No',
  submitCheckIn: 'Submit check-in',
  settings: 'Settings',
  account: 'Account',
  email: 'Email',
  careTeam: 'Care team',
  providerPhone: 'Provider phone',
  notifications: 'Notifications',
  medicationReminders: 'Medication reminders',
  dailyCheckInReminder: 'Daily check-in reminder',
  reminderTime: 'Reminder time',
  language: 'Language',
  instructionsLanguage: 'Instructions language',
  legal: 'Legal',
  logOut: 'Log out',
  deleteAccount: 'Delete my account & data',
  medReminderTitle: 'Time to take your medications',
  medNudgeTitle: 'Did you take your medications?',
  medNudgeSuffix: '— due 30 minutes ago.',
  checkInNotifTitle: 'Morning check-in',
  checkInNotifBody: "How are you feeling today? Tap to complete your daily symptom check.",
  disclaimer: 'CuraPath helps you track instructions from your healthcare provider. It does not provide medical advice, diagnosis, or treatment recommendations. AI-extracted content may contain errors — always refer to your original discharge paperwork and contact your care team with any health concerns. In an emergency, call 911.',
};

function getGreeting(strings: UIStrings): string {
  const hour = new Date().getHours();
  if (hour < 12) return strings.goodMorning;
  if (hour < 17) return strings.goodAfternoon;
  return strings.goodEvening;
}

function t(strings: UIStrings, key: string, vars?: Record<string, string | number>): string {
  let str = strings[key] ?? EN_FALLBACK[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(`{${k}}`, String(v));
    }
  }
  return str;
}

export function useUITranslations() {
  const [strings, setStrings] = useState<UIStrings>(EN_FALLBACK);

  useEffect(() => {
    async function load() {
      const lang = await getPreferredLanguage();
      if (lang.code === 'en') { setStrings(EN_FALLBACK); return; }

      const cacheKey = `${CACHE_PREFIX}${lang.code}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) { setStrings(JSON.parse(cached)); return; }

      try {
        const res = await api.post<{ data: UIStrings }>('/translations/ui', {
          languageCode: lang.code,
          languageName: lang.name,
        });
        await AsyncStorage.setItem(cacheKey, JSON.stringify(res.data));
        setStrings(res.data);
      } catch {
        setStrings(EN_FALLBACK);
      }
    }
    load();
  }, []);

  return {
    strings,
    t: (key: string, vars?: Record<string, string | number>) => t(strings, key, vars),
    greeting: getGreeting(strings),
  };
}

export async function clearUITranslationCache(): Promise<void> {
  const keys = SUPPORTED_LANGUAGES.map((l) => `${CACHE_PREFIX}${l.code}`);
  await AsyncStorage.multiRemove(keys);
}
