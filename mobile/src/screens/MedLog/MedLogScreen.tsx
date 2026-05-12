import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getMedicationLogs } from '../../api/medications';
import { MedicationLog } from '../../types';
import { useTheme } from '../../hooks/useTheme';

const STATUS_COLORS: Record<string, string> = { taken: '#34d399', skip: '#f59e0b', pending: '#ef4444' };

function statusDot(s: string, fallback: string) {
  return { width: 10, height: 10, borderRadius: 5, backgroundColor: STATUS_COLORS[s] ?? fallback };
}

function statusLabel(s: string, fallback: string) {
  return { color: STATUS_COLORS[s] ?? fallback, fontSize: 12, fontWeight: '700' as const };
}

export default function MedLogScreen() {
  const [logs, setLogs] = useState<(MedicationLog & { medication_name?: string; dose?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      getMedicationLogs(30)
        .then((res) => setLogs(res.data as any))
        .finally(() => setLoading(false));
    }, [])
  );

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
        <Text style={styles.title}>Medication Log</Text>
        <Text style={styles.sub}>Last 30 days</Text>
      </View>
      <FlatList
        data={logs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No medication logs yet.</Text>}
        renderItem={({ item }) => {
          const status = item.skipped ? 'skip' : item.taken_at ? 'taken' : 'pending';
          return (
            <View style={styles.row}>
              <View style={statusDot(status, C.checkRing)} />
              <View style={styles.info}>
                <Text style={styles.medName}>{item.medication_name} {item.dose}</Text>
                <Text style={styles.time}>
                  Scheduled {new Date(item.scheduled_time).toLocaleString()}
                </Text>
              </View>
              <Text style={statusLabel(status, C.textMuted)}>
                {item.skipped ? 'Skipped' : item.taken_at ? 'Taken' : 'Missed'}
              </Text>
            </View>
          );
        }}
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
    row: {
      flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
      backgroundColor: C.surface,
      borderWidth: 1, borderColor: C.border, borderRadius: 14, marginBottom: 8,
    },
    info: { flex: 1 },
    medName: { color: C.textPrimary, fontSize: 14, fontWeight: '600' },
    time: { color: C.textTertiary, fontSize: 11, marginTop: 2 },
  });
}
