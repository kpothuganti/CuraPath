import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { getMedicationLogs } from '../../api/medications';
import { MedicationLog } from '../../types';

export default function MedLogScreen() {
  const [logs, setLogs] = useState<(MedicationLog & { medication_name?: string; dose?: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMedicationLogs(30)
      .then((res) => setLogs(res.data as any))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator color="#4f7eff" />
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
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.statusDot(item.skipped ? 'skip' : item.taken_at ? 'taken' : 'pending')} />
            <View style={styles.info}>
              <Text style={styles.medName}>{item.medication_name} {item.dose}</Text>
              <Text style={styles.time}>
                Scheduled {new Date(item.scheduled_time).toLocaleString()}
              </Text>
            </View>
            <Text style={styles.status(item.skipped ? 'skip' : item.taken_at ? 'taken' : 'pending')}>
              {item.skipped ? 'Skipped' : item.taken_at ? 'Taken' : 'Missed'}
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const statusColors: Record<string, string> = { taken: '#34d399', skip: '#f59e0b', pending: '#ef4444' };

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#13131a' },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { padding: 20 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  sub: { color: '#555', fontSize: 12, marginTop: 4 },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  empty: { color: '#555', fontSize: 14, textAlign: 'center', marginTop: 40 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderRadius: 14, marginBottom: 8,
  },
  statusDot: (s: string) => ({
    width: 10, height: 10, borderRadius: 5, backgroundColor: statusColors[s] ?? '#333',
  }),
  info: { flex: 1 },
  medName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  time: { color: '#666', fontSize: 11, marginTop: 2 },
  status: (s: string) => ({ color: statusColors[s] ?? '#555', fontSize: 12, fontWeight: '700' }),
});
