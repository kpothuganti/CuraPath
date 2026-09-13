import { Router, Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import pool from '../db';

const router = Router();
const client = new Anthropic();

const UI_STRINGS: Record<string, string> = {
  // Greeting
  goodMorning: 'Good Morning',
  goodAfternoon: 'Good Afternoon',
  goodEvening: 'Good Evening',
  // Home screen
  dayOfRecovery: 'Day {n} of Recovery',
  recoveryProgress: 'Recovery Progress',
  daysProgress: '{done} of {total} days · {remaining} days remaining',
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
  // Instructions screen
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
  // Medication log
  medicationLog: 'Medication Log',
  last30Days: 'Last 30 days',
  today: 'Today',
  takenStatus: 'Taken',
  skippedStatus: 'Skipped',
  missedStatus: 'Missed',
  upcomingStatus: 'Upcoming',
  noMedicationsScheduled: 'No medications scheduled.',
  // Check-in
  dailyCheckInTitle: 'Daily Check-In',
  checkInSubtitle: 'Answer a few quick questions about how you\'re feeling today.',
  yes: 'Yes',
  no: 'No',
  submitCheckIn: 'Submit check-in',
  // Settings
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
  // Tab bar
  homeTab: 'Home',
  instructionsTab: 'Instructions',
  medLogTab: 'Med Log',
  settingsTab: 'Settings',
  // Notifications
  medReminderTitle: 'Time to take your medications',
  medNudgeTitle: 'Did you take your medications?',
  medNudgeSuffix: '— due 30 minutes ago.',
  checkInNotifTitle: 'Daily check-in',
  checkInNotifBody: 'How are you feeling today? Tap to complete your daily symptom check.',
  // Disclaimer
  disclaimer: 'CuraPath helps you track instructions from your healthcare provider. It does not provide medical advice, diagnosis, or treatment recommendations. AI-extracted content may contain errors — always refer to your original discharge paperwork and contact your care team with any health concerns. In an emergency, call 911.',
};

// POST /translations/ui — no auth required, translations are not PHI
router.post('/ui', async (req: Request, res: Response): Promise<void> => {
  const { languageCode, languageName } = req.body as { languageCode?: string; languageName?: string };

  if (!languageCode || !languageName) {
    res.status(400).json({ error: 'languageCode and languageName are required' });
    return;
  }

  if (languageCode === 'en') {
    res.json({ data: UI_STRINGS });
    return;
  }

  try {
    // Check cache first
    const cached = await pool.query(
      `SELECT strings_json FROM ui_translations WHERE language_code = $1`,
      [languageCode]
    );
    if (cached.rows[0]) {
      res.json({ data: cached.rows[0].strings_json });
      return;
    }

    // Translate via Claude
    const prompt = `Translate the following JSON object's values from English to ${languageName}.
Keep all keys exactly as-is. Keep placeholder tokens like {n}, {done}, {remaining} exactly as-is.
Return ONLY valid JSON, no explanation.

${JSON.stringify(UI_STRINGS, null, 2)}`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = (message.content[0] as { type: string; text: string }).text.trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    const translated: Record<string, string> = JSON.parse(jsonMatch[0]);

    // Cache in DB
    await pool.query(
      `INSERT INTO ui_translations (language_code, strings_json)
       VALUES ($1, $2)
       ON CONFLICT (language_code) DO UPDATE SET strings_json = EXCLUDED.strings_json`,
      [languageCode, JSON.stringify(translated)]
    );

    res.json({ data: translated });
  } catch (err) {
    console.error('UI translation error', err);
    // Fall back to English on error
    res.json({ data: UI_STRINGS });
  }
});

export default router;
export { UI_STRINGS };
