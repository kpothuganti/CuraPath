import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, SectionList, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getMedications, getMedicationLogs } from '../../api/medications';
import { dischargeStore } from '../../store/dischargeStore';
import { MedicationLog, MedicationRecord } from '../../types';
import { useTheme } from '../../hooks/useTheme';
import { useUITranslations } from '../../hooks/useUITranslations';

type DoseStatus = 'taken' | 'skipped' | 'missed' | 'upcoming';

interface DoseRow {
  id: string;
  medName: string;
  dose: string;
  scheduledTime: Date;
  status: DoseStatus;
}

function getStatus(time: Date, log?: MedicationLog): DoseStatus {
  if (log?.skipped) return 'skipped';
  if (log?.taken_at) return 'taken';
  return time < new Date() ? 'missed' : 'upcoming';
}

const STATUS_COLOR: Record<DoseStatus, string> = {
  taken: '#34d399',
  skipped: '#f59e0b',
  missed: '#ef4444',
  upcoming: '#8a95a8',
};

function buildTodayDoses(
  medications: MedicationRecord[],
  logs: (MedicationLog & { medication_name?: string; dose?: string })[]
): DoseRow[] {
  const todayStr = new Date().toDateString();
  const todayLogs = logs.filter(
    (l) => new Date(l.scheduled_time).toDateString() === todayStr
  );

  const rows: DoseRow[] = [];
  for (const med of medications) {
    const times = med.times.length > 0 ? med.times : ['08:00'];
    for (const time of times) {
      const [h, m] = time.split(':').map(Number);
      const scheduled = new Date();
      scheduled.setHours(h, m, 0, 0);

      const log = todayLogs.find((l) => {
        const lt = new Date(l.scheduled_time);
        return l.medication_id === med.id && lt.getHours() === h && lt.getMinutes() === m;
      });

      rows.push({
        id: `${med.id}_${time}`,
        medName: med.name,
        dose: med.dose ?? '',
        scheduledTime: scheduled,
        status: getStatus(scheduled, log),
      });
    }
  }

  return rows.sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime());
}

function buildHistoryDoses(
  logs: (MedicationLog & { medication_name?: string; dose?: string })[]
): { title: string; data: DoseRow[] }[] {
  const todayStr = new Date().toDateString();
  const past = logs.filter((l) => new Date(l.scheduled_time).toDateString() !== todayStr);

  const byDate: Record<string, DoseRow[]> = {};
  for (const log of past) {
    const dateStr = new Date(log.scheduled_time).toLocaleDateString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric',
    });
    if (!byDate[dateStr]) byDate[dateStr] = [];
    byDate[dateStr].push({
      id: log.id,
      medName: log.medication_name ?? '',
      dose: log.dose ?? '',
      scheduledTime: new Date(log.scheduled_time),
      status: getStatus(new Date(log.scheduled_time), log),
    });
  }

  return Object.entries(byDate).map(([title, data]) => ({ title, data }));
}

export default function MedLogScreen() {
  const { medications } = dischargeStore();
  const [logs, setLogs] = useState<(MedicationLog & { medication_name?: string; dose?: string })[]>([]);
  const [meds, setMeds] = useState<MedicationRecord[]>(medications);
  const [loading, setLoading] = useState(true);
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { t } = useUITranslations();

  const STATUS_LABEL: Record<DoseStatus, string> = {
    taken: t('takenStatus'),
    skipped: t('skippedStatus'),
    missed: t('missedStatus'),
    upcoming: t('upcomingStatus'),
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      Promise.all([getMedications(), getMedicationLogs(30)])
        .then(([medsRes, logsRes]) => {
          setMeds(medsRes.data);
          setLogs(logsRes.data as any);
        })
        .finally(() => setLoading(false));
    }, [])
  );

  const todayDoses = useMemo(() => buildTodayDoses(meds, logs), [meds, logs]);
  const historySections = useMemo(() => buildHistoryDoses(logs), [logs]);

  const sections = [
    { title: t('today'), data: todayDoses },
    ...historySections,
  ];

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator color={C.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('medicationLog')}</Text>
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>{t('noMedicationsScheduled')}</Text>}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={[styles.dot, { backgroundColor: STATUS_COLOR[item.status] }]} />
            <View style={styles.info}>
              <Text style={styles.medName}>{item.medName} {item.dose}</Text>
              <Text style={styles.time}>
                {item.scheduledTime.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            <Text style={[styles.statusLabel, { color: STATUS_COLOR[item.status] }]}>
              {STATUS_LABEL[item.status]}
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

function makeStyles(C: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    center: { alignItems: 'center', justifyContent: 'center' },
    header: { padding: 20 },
    title: { color: C.textPrimary, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
    sub: { color: C.textMuted, fontSize: 12, marginTop: 4 },
    list: { paddingHorizontal: 20, paddingBottom: 40 },
    empty: { color: C.textMuted, fontSize: 14, textAlign: 'center', marginTop: 40 },
    sectionHeader: { paddingVertical: 10, paddingTop: 16 },
    sectionTitle: { color: C.accent, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
      backgroundColor: C.surface,
      borderWidth: 1, borderColor: C.border, borderRadius: 14, marginBottom: 8,
    },
    dot: { width: 10, height: 10, borderRadius: 5 },
    info: { flex: 1 },
    medName: { color: C.textPrimary, fontSize: 14, fontWeight: '600' },
    time: { color: C.textTertiary, fontSize: 11, marginTop: 2 },
    statusLabel: { fontSize: 12, fontWeight: '700' },
  });
}
