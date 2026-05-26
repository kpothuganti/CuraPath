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

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { discharge, medications, setDischarge, setMedications } = dischargeStore();
  const { user } = authStore();
  const [checkInDone, setCheckInDone] = useState(false);
  const [loading, setLoading] = useState(!discharge);
  const [takenMedIds, setTakenMedIds] = useState<Set<string>>(new Set());
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

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
            .map((l) => l.medication_id)
        );
        setTakenMedIds(taken);
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

  async function handleMedAction(med: MedicationRecord, action: 'taken' | 'skipped') {
    const today = new Date();
    const [h, m] = (med.times[0] ?? '08:00').split(':');
    today.setHours(Number(h), Number(m), 0, 0);
    await logMedication(med.id, today.toISOString(), action);
    setTakenMedIds((prev) => new Set(prev).add(med.id));
  }

  const restrictions = discharge?.parsed_json?.activity_restrictions ?? [];
  const daysSince = discharge
    ? Math.floor((Date.now() - new Date(discharge.created_at).getTime()) / 86400000)
    : 0;

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
        <Text style={styles.emptyTitle}>Welcome to CuraPath</Text>
        <Text style={styles.emptySub}>Upload your discharge paperwork to get started.</Text>
        <TouchableOpacity style={styles.uploadBtn} onPress={() => navigation.navigate('Upload')}>
          <Text style={styles.uploadBtnText}>Upload instructions</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.greeting}>Good Morning, {firstName}</Text>
          <Text style={styles.dayTitle}>Day {daysSince + 1} of Recovery</Text>
        </View>

        <View style={styles.progressCard}>
          <Text style={styles.progressLabel}>Recovery Progress</Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.min((daysSince / 30) * 100, 100)}%` }]} />
          </View>
          <Text style={styles.progressDays}>
            {daysSince} of 30 days · {Math.max(30 - daysSince, 0)} days remaining
          </Text>
        </View>

        {!checkInDone && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Daily Check-In</Text>
            </View>
            <TouchableOpacity style={styles.checkinCard} onPress={() => navigation.navigate('CheckIn')}>
              <View style={styles.checkinIcon}><Text style={{ fontSize: 22 }}>🩺</Text></View>
              <View style={styles.checkinText}>
                <Text style={styles.checkinLabel}>How are you feeling today?</Text>
                <Text style={styles.checkinSub}>
                  {discharge.parsed_json.red_flags.length} questions · takes 1 minute
                </Text>
              </View>
              <Text style={{ color: C.accent, fontSize: 18 }}>›</Text>
            </TouchableOpacity>
          </>
        )}

        {medications.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Today's Medications</Text>
            </View>
            {medications.map((med) => (
              <View key={med.id} style={styles.medCard}>
                <View style={styles.medIcon}><Text style={{ fontSize: 20 }}>💊</Text></View>
                <View style={styles.medInfo}>
                  <Text style={styles.medName}>{med.name} {med.dose}</Text>
                  <Text style={styles.medDetail}>{med.instructions}</Text>
                  <Text style={styles.medTime}>{med.times.join(' · ')}</Text>
                </View>
                {takenMedIds.has(med.id) ? (
                  <View style={styles.medBtnTaken}>
                    <Text style={styles.medBtnTakenText}>✓ Taken</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.medBtn}
                    onPress={() => handleMedAction(med, 'taken')}
                  >
                    <Text style={styles.medBtnText}>Take</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </>
        )}

        {restrictions.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Activity Reminders</Text>
            </View>
            {restrictions.map((r, i) => (
              <View key={i} style={styles.taskCard}>
                <View style={styles.taskCheck} />
                <Text style={styles.taskLabel}>{r}</Text>
              </View>
            ))}
          </>
        )}

        <View style={styles.disclaimerWrap}>
          <Disclaimer />
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('Upload')}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function makeStyles(C: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    center: { alignItems: 'center', justifyContent: 'center', padding: 32 },
    scroll: { paddingBottom: 120 },
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
    medBtn: { backgroundColor: C.success, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
    medBtnText: { color: '#0d2b1e', fontSize: 12, fontWeight: '700' },
    medBtnTaken: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: C.successSurface, borderWidth: 1, borderColor: C.successBorder },
    medBtnTakenText: { color: C.success, fontSize: 12, fontWeight: '700' },
    taskCard: {
      marginHorizontal: 20, marginBottom: 8, padding: 14,
      backgroundColor: C.surface,
      borderWidth: 1, borderColor: C.border, borderRadius: 14,
      flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    },
    taskCheck: {
      width: 22, height: 22, borderRadius: 11,
      borderWidth: 2, borderColor: C.checkRing, marginTop: 1,
    },
    taskLabel: { color: C.textSecondary, fontSize: 14, lineHeight: 20, flex: 1 },
    disclaimerWrap: { marginHorizontal: 20, marginTop: 24 },
    emptyTitle: { color: C.textPrimary, fontSize: 22, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
    emptySub: { color: C.textTertiary, fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
    uploadBtn: { backgroundColor: C.accent, padding: 16, borderRadius: 16 },
    uploadBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    fab: {
      position: 'absolute', right: 20, bottom: 100,
      width: 56, height: 56, borderRadius: 28,
      backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
      shadowColor: C.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12,
    },
    fabText: { color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 30 },
  });
}
