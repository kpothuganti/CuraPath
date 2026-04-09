import React from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { dischargeStore } from '../../store/dischargeStore';
import Disclaimer from '../../components/Disclaimer';

export default function InstructionsScreen() {
  const { discharge } = dischargeStore();
  const p = discharge?.parsed_json;

  if (!p) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <Text style={styles.empty}>No instructions uploaded yet.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Your Instructions</Text>
          <Text style={styles.sub}>
            Uploaded {new Date(discharge!.created_at).toLocaleDateString()}
          </Text>
        </View>

        {p.red_flags.length > 0 && (
          <Section title="⚠️ Warning signs — call your doctor if you notice:">
            <View style={styles.pills}>
              {p.red_flags.map((f, i) => (
                <Text key={i} style={[styles.pill, styles.pillRed]}>{f}</Text>
              ))}
            </View>
          </Section>
        )}

        {p.medications.length > 0 && (
          <Section title="💊 Medications">
            {p.medications.map((m, i) => (
              <View key={i} style={styles.medRow}>
                <Text style={styles.medName}>{m.name} {m.dose}</Text>
                <Text style={styles.medDetail}>{m.frequency} · {m.times.join(', ')} · {m.instructions}</Text>
              </View>
            ))}
          </Section>
        )}

        {p.activity_restrictions.length > 0 && (
          <Section title="🚶 Activity restrictions">
            <View style={styles.pills}>
              {p.activity_restrictions.map((r, i) => (
                <Text key={i} style={styles.pill}>{r}</Text>
              ))}
            </View>
          </Section>
        )}

        {p.follow_up_appointments.length > 0 && (
          <Section title="📅 Follow-up appointments">
            {p.follow_up_appointments.map((a, i) => (
              <View key={i} style={styles.apptRow}>
                <Text style={styles.apptType}>{a.type}</Text>
                <Text style={styles.apptTime}>{a.timeframe}</Text>
              </View>
            ))}
          </Section>
        )}

        {p.diet_restrictions.length > 0 && (
          <Section title="🍽️ Diet">
            <View style={styles.pills}>
              {p.diet_restrictions.map((d, i) => (
                <Text key={i} style={[styles.pill, styles.pillGreen]}>{d}</Text>
              ))}
            </View>
          </Section>
        )}

        {p.wound_care.length > 0 && (
          <Section title="🩹 Wound care">
            <View style={styles.pills}>
              {p.wound_care.map((w, i) => (
                <Text key={i} style={styles.pill}>{w}</Text>
              ))}
            </View>
          </Section>
        )}

        <View style={styles.disclaimerWrap}><Disclaimer /></View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#13131a' },
  center: { alignItems: 'center', justifyContent: 'center' },
  empty: { color: '#555', fontSize: 15 },
  scroll: { paddingBottom: 40 },
  header: { padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  sub: { color: '#555', fontSize: 12, marginTop: 4 },
  section: { padding: 16, paddingBottom: 0 },
  sectionTitle: { color: '#4f7eff', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20, color: '#ccc', fontSize: 12,
  },
  pillRed: { backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)', color: '#f87171' },
  pillGreen: { backgroundColor: 'rgba(52,211,153,0.08)', borderColor: 'rgba(52,211,153,0.2)', color: '#34d399' },
  medRow: {
    padding: 12, backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderRadius: 12, marginBottom: 8,
  },
  medName: { color: '#fff', fontSize: 14, fontWeight: '700' },
  medDetail: { color: '#666', fontSize: 12, marginTop: 2 },
  apptRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 12, backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderRadius: 12, marginBottom: 8,
  },
  apptType: { color: '#fff', fontSize: 14, fontWeight: '600' },
  apptTime: { color: '#4f7eff', fontSize: 12, fontWeight: '600' },
  disclaimerWrap: { margin: 20 },
});
