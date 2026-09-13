import React, { useMemo, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { dischargeStore } from '../../store/dischargeStore';
import { authStore } from '../../store/authStore';
import { getLatestDischarge } from '../../api/discharge';
import { getMedications, logMedication, getMedicationLogs } from '../../api/medications';
import { getTodayCheckIn } from '../../api/checkin';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { MedicationRecord } from '../../types';
import Disclaimer from '../../components/Disclaimer';
import { useTheme } from '../../hooks/useTheme';
import { useUITranslations } from '../../hooks/useUITranslations';
import { Ionicons } from '@expo/vector-icons';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function format12hr(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

function parseRecoveryDays(timeframe: string | undefined): number {
  if (!timeframe) return 30;
  const s = timeframe.toLowerCase();
  // "within X days" / "X days"
  const daysMatch = s.match(/(\d+)\s*day/);
  if (daysMatch) return parseInt(daysMatch[1], 10);
  // "X-Y weeks" — take the upper bound
  const rangeWeeks = s.match(/(\d+)\s*[-–]\s*(\d+)\s*week/);
  if (rangeWeeks) return parseInt(rangeWeeks[2], 10) * 7;
  // "X weeks"
  const weeksMatch = s.match(/(\d+)\s*week/);
  if (weeksMatch) return parseInt(weeksMatch[1], 10) * 7;
  // "X months"
  const monthsMatch = s.match(/(\d+)\s*month/);
  if (monthsMatch) return parseInt(monthsMatch[1], 10) * 30;
  return 30;
}

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { discharge, medications, setDischarge, setMedications } = dischargeStore();
  const { user } = authStore();
  const [checkInDone, setCheckInDone] = useState(false);
  const [loading, setLoading] = useState(!discharge);
  // keys are `${medicationId}_${time}` e.g. "abc123_08:00"
  const [takenKeys, setTakenKeys] = useState<Set<string>>(new Set());
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { t, greeting } = useUITranslations();

  const firstName = user?.first_name ?? user?.email.split('@')[0] ?? 'there';

  useEffect(() => {
    async function load() {
      try {
        if (!discharge) {
          const d = await getLatestDischarge();
          setDischarge(d.data);
        }
        const m = await getMedications();
        setMedications(m.data);
        const logs = await getMedicationLogs(1);
        const todayStr = new Date().toDateString();
        const taken = new Set(
          logs.data
            .filter((l) => !l.skipped && l.taken_at && new Date(l.taken_at).toDateString() === todayStr)
            .map((l) => {
              const t = new Date(l.scheduled_time);
              const hh = String(t.getHours()).padStart(2, '0');
              const mm = String(t.getMinutes()).padStart(2, '0');
              return `${l.medication_id}_${hh}:${mm}`;
            })
        );
        setTakenKeys(taken);
        const ci = await getTodayCheckIn();
        setCheckInDone(ci.data.completed);
      } catch {
        // no discharge yet — show empty state
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleMedAction(med: MedicationRecord, time: string, action: 'taken' | 'skipped') {
    const today = new Date();
    const [h, m] = time.split(':');
    today.setHours(Number(h), Number(m), 0, 0);
    await logMedication(med.id, today.toISOString(), action);
    setTakenKeys((prev) => new Set(prev).add(`${med.id}_${time}`));
  }

  const restrictions = discharge?.parsed_json?.activity_restrictions ?? [];
  const daysSince = discharge
    ? Math.floor((Date.now() - new Date(discharge.created_at).getTime()) / 86400000)
    : 0;
  const totalRecoveryDays = parseRecoveryDays(
    discharge?.parsed_json?.follow_up_appointments?.[0]?.timeframe
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator color={C.accent} />
      </SafeAreaView>
    );
  }

  if (!discharge) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <Text style={styles.emptyTitle}>{t('welcomeTitle')}</Text>
        <Text style={styles.emptySub}>{t('uploadPrompt')}</Text>
        <TouchableOpacity style={styles.uploadBtn} onPress={() => navigation.navigate('Upload')}>
          <Text style={styles.uploadBtnText}>{t('uploadBtn')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.greeting}>{greeting}, {firstName}</Text>
          <Text style={styles.dayTitle}>{t('dayOfRecovery', { n: daysSince + 1 })}</Text>
        </View>

        <View style={styles.progressCard}>
          <Text style={styles.progressLabel}>{t('recoveryProgress')}</Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.min((daysSince / totalRecoveryDays) * 100, 100)}%` }]} />
          </View>
          <Text style={styles.progressDays}>
            {t('daysProgress', { done: daysSince, total: totalRecoveryDays, remaining: Math.max(totalRecoveryDays - daysSince, 0) })}
          </Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('dailyCheckIn')}</Text>
        </View>
        {checkInDone ? (
          <View style={styles.checkinDoneCard}>
            <View style={styles.checkinDoneIcon}>
              <Ionicons name="checkmark-circle" size={22} color={C.success} />
            </View>
            <View style={styles.checkinText}>
              <Text style={styles.checkinDoneLabel}>Completed for today</Text>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.checkinCard} onPress={() => navigation.navigate('CheckIn')}>
            <View style={styles.checkinIcon}><Ionicons name="fitness-outline" size={22} color={C.accent} /></View>
            <View style={styles.checkinText}>
              <Text style={styles.checkinLabel}>{t('howAreYouFeeling')}</Text>
              <Text style={styles.checkinSub}>
                {t('questionsCount', { n: discharge.parsed_json.red_flags.length })}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.accent} />
          </TouchableOpacity>
        )}

        {medications.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('todaysMedications')}</Text>
            </View>
            {medications.map((med, medIndex) => {
              const translatedInstructions = discharge.parsed_json.medications?.[medIndex]?.instructions ?? med.instructions;
              return (
                <View key={med.id} style={styles.medCard}>
                  <View style={styles.medIcon}><Ionicons name="medical-outline" size={20} color={C.accent} /></View>
                  <View style={styles.medInfo}>
                    <Text style={styles.medName}>{med.name} {med.dose}</Text>
                    <Text style={styles.medDetail}>{translatedInstructions}</Text>
                    <View style={styles.medTimesRow}>
                      {(med.times.length > 0 ? med.times : ['08:00']).map((time) => {
                        const key = `${med.id}_${time}`;
                        const taken = takenKeys.has(key);
                        return taken ? (
                          <View key={time} style={styles.medDoseTaken}>
                            <Text style={styles.medDoseTakenText}>✓ {format12hr(time)}</Text>
                          </View>
                        ) : (
                          <TouchableOpacity
                            key={time}
                            style={styles.medDoseBtn}
                            onPress={() => handleMedAction(med, time, 'taken')}
                          >
                            <Text style={styles.medDoseBtnText}>{t('take')} {format12hr(time)}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {restrictions.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('activityReminders')}</Text>
            </View>
            {restrictions.map((r, i) => (
              <View key={i} style={styles.taskCard}>
                <Text style={styles.taskLabel}>{r}</Text>
              </View>
            ))}
          </>
        )}

        <View style={styles.disclaimerWrap}>
          <Disclaimer />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(C: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    center: { alignItems: 'center', justifyContent: 'center', padding: 32 },
    scroll: { paddingBottom: 40 },
    header: { padding: 20, paddingBottom: 0 },
    greeting: { color: C.textTertiary, fontSize: 13, marginBottom: 2 },
    dayTitle: { color: C.textPrimary, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
    progressCard: {
      margin: 16, padding: 14,
      backgroundColor: C.surfaceAccent,
      borderWidth: 1, borderColor: C.borderAccent, borderRadius: 16,
    },
    progressLabel: { color: C.accentSubtext, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
    track: { height: 6, backgroundColor: C.trackBg, borderRadius: 3, overflow: 'hidden' },
    fill: { height: '100%', backgroundColor: C.accent, borderRadius: 3 },
    progressDays: { color: C.accentSubtext, fontSize: 12, marginTop: 6 },
    sectionHeader: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    sectionTitle: { color: C.textPrimary, fontSize: 15, fontWeight: '700' },
    checkinCard: {
      marginHorizontal: 20, marginBottom: 4, padding: 16,
      backgroundColor: C.accentSurface,
      borderWidth: 1, borderColor: C.accentBorder, borderRadius: 16,
      flexDirection: 'row', alignItems: 'center', gap: 14,
    },
    checkinIcon: {
      width: 44, height: 44, borderRadius: 14,
      backgroundColor: C.surfaceAccent,
      alignItems: 'center', justifyContent: 'center',
    },
    checkinDoneCard: {
      marginHorizontal: 20, marginBottom: 4, padding: 16,
      backgroundColor: C.successSurface,
      borderWidth: 1, borderColor: C.successBorder, borderRadius: 16,
      flexDirection: 'row', alignItems: 'center', gap: 14,
    },
    checkinDoneIcon: {
      width: 44, height: 44, borderRadius: 14,
      backgroundColor: C.successSurface,
      borderWidth: 1, borderColor: C.successBorder,
      alignItems: 'center', justifyContent: 'center',
    },
    checkinDoneLabel: { color: C.success, fontSize: 14, fontWeight: '700', marginBottom: 2 },
    checkinDoneSub: { color: C.success, fontSize: 12, opacity: 0.7 },
    checkinText: { flex: 1 },
    checkinLabel: { color: C.textPrimary, fontSize: 14, fontWeight: '700', marginBottom: 2 },
    checkinSub: { color: C.accentSubtext, fontSize: 12 },
    medCard: {
      marginHorizontal: 20, marginBottom: 8, padding: 14,
      backgroundColor: C.surface,
      borderWidth: 1, borderColor: C.border, borderRadius: 14,
      flexDirection: 'row', alignItems: 'center', gap: 14,
    },
    medIcon: {
      width: 42, height: 42, borderRadius: 12,
      backgroundColor: C.successSurface,
      borderWidth: 1, borderColor: C.successBorder,
      alignItems: 'center', justifyContent: 'center',
    },
    medInfo: { flex: 1 },
    medName: { color: C.textPrimary, fontSize: 14, fontWeight: '700' },
    medDetail: { color: C.textTertiary, fontSize: 12, marginTop: 2 },
    medTime: { color: C.success, fontSize: 11, fontWeight: '600', marginTop: 4 },
    medTimesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
    medDoseBtn: { backgroundColor: C.success, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    medDoseBtnText: { color: '#0d2b1e', fontSize: 12, fontWeight: '700' },
    medDoseTaken: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: C.successSurface, borderWidth: 1, borderColor: C.successBorder },
    medDoseTakenText: { color: C.success, fontSize: 12, fontWeight: '700' },
    taskCard: {
      marginHorizontal: 20, marginBottom: 8, padding: 14,
      backgroundColor: C.surface,
      borderWidth: 1, borderColor: C.border, borderRadius: 14,
      borderLeftWidth: 3, borderLeftColor: C.accent,
    },
    taskLabel: { color: C.textSecondary, fontSize: 14, lineHeight: 20 },
    updateBtn: { marginHorizontal: 20, marginTop: 24, backgroundColor: C.surfaceStrong, borderWidth: 1, borderColor: C.borderMed, borderRadius: 16, padding: 16, alignItems: 'center' },
    updateBtnText: { color: C.textSecondary, fontSize: 15, fontWeight: '600' },
    disclaimerWrap: { marginHorizontal: 20, marginTop: 8 },
    emptyTitle: { color: C.textPrimary, fontSize: 22, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
    emptySub: { color: C.textTertiary, fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
    uploadBtn: { backgroundColor: C.accent, padding: 16, borderRadius: 16 },
    uploadBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  });
}
