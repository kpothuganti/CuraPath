import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { dischargeStore } from '../../store/dischargeStore';
import Disclaimer from '../../components/Disclaimer';
import { useTheme } from '../../hooks/useTheme';
import { RootStackParamList } from '../../navigation/AppNavigator';

export default function InstructionsScreen() {
  const { discharge } = dischargeStore();
  const p = discharge?.parsed_json;
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

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
          <Section title="⚠️ Warning signs — call your doctor if you notice:" styles={styles}>
            <View style={styles.pills}>
              {p.red_flags.map((f, i) => (
                <Text key={i} style={[styles.pill, styles.pillRed]}>{f}</Text>
              ))}
            </View>
          </Section>
        )}

        {p.medications.length > 0 && (
          <Section title="💊 Medications" styles={styles}>
            {p.medications.map((m, i) => (
              <View key={i} style={styles.medRow}>
                <Text style={styles.medName}>{m.name} {m.dose}</Text>
                <Text style={styles.medDetail}>{m.frequency} · {m.times.join(', ')} · {m.instructions}</Text>
              </View>
            ))}
          </Section>
        )}

        {p.activity_restrictions.length > 0 && (
          <Section title="🚶 Activity restrictions" styles={styles}>
            <View style={styles.pills}>
              {p.activity_restrictions.map((r, i) => (
                <Text key={i} style={styles.pill}>{r}</Text>
              ))}
            </View>
          </Section>
        )}

        {p.follow_up_appointments.length > 0 && (
          <Section title="📅 Follow-up appointments" styles={styles}>
            {p.follow_up_appointments.map((a, i) => (
              <View key={i} style={styles.apptRow}>
                <Text style={styles.apptType}>{a.type}</Text>
                <Text style={styles.apptTime}>{a.timeframe}</Text>
              </View>
            ))}
          </Section>
        )}

        {p.diet_restrictions.length > 0 && (
          <Section title="🍽️ Diet" styles={styles}>
            <View style={styles.pills}>
              {p.diet_restrictions.map((d, i) => (
                <Text key={i} style={[styles.pill, styles.pillGreen]}>{d}</Text>
              ))}
            </View>
          </Section>
        )}

        {p.wound_care.length > 0 && (
          <Section title="🩹 Wound Care" styles={styles}>
            <View style={styles.pills}>
              {p.wound_care.map((w, i) => (
                <Text key={i} style={styles.pill}>{w}</Text>
              ))}
            </View>
          </Section>
        )}

        {p.sleeping_instructions && p.sleeping_instructions.length > 0 && (
          <Section title="😴 Sleeping" styles={styles}>
            <View style={styles.pills}>
              {p.sleeping_instructions.map((s, i) => (
                <Text key={i} style={styles.pill}>{s}</Text>
              ))}
            </View>
          </Section>
        )}

        {p.exercises && p.exercises.length > 0 && (
          <Section title="🏋️ Exercises" styles={styles}>
            {p.exercises.map((e, i) => (
              <View key={i} style={styles.exerciseRow}>
                <Text style={styles.exerciseText}>{e}</Text>
              </View>
            ))}
          </Section>
        )}

        <TouchableOpacity style={styles.updateBtn} onPress={() => navigation.navigate('Upload')}>
          <Text style={styles.updateBtnText}>Update instructions</Text>
        </TouchableOpacity>

        <View style={styles.disclaimerWrap}><Disclaimer /></View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children, styles }: { title: string; children: React.ReactNode; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function makeStyles(C: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    center: { alignItems: 'center', justifyContent: 'center' },
    empty: { color: C.textMuted, fontSize: 15 },
    scroll: { paddingBottom: 40 },
    header: { padding: 20, borderBottomWidth: 1, borderBottomColor: C.border },
    title: { color: C.textPrimary, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
    sub: { color: C.textMuted, fontSize: 12, marginTop: 4 },
    section: { padding: 16, paddingBottom: 0 },
    sectionTitle: { color: C.accent, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
    pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    pill: {
      paddingHorizontal: 12, paddingVertical: 6,
      backgroundColor: C.surface,
      borderWidth: 1, borderColor: C.border,
      borderRadius: 20, color: C.textSecondary, fontSize: 12,
    },
    pillRed: { backgroundColor: C.dangerSurface, borderColor: C.dangerBorder, color: C.dangerText },
    pillGreen: { backgroundColor: C.successSurface, borderColor: C.successBorder, color: C.success },
    medRow: {
      padding: 12, backgroundColor: C.surface,
      borderWidth: 1, borderColor: C.border, borderRadius: 12, marginBottom: 8,
    },
    medName: { color: C.textPrimary, fontSize: 14, fontWeight: '700' },
    medDetail: { color: C.textTertiary, fontSize: 12, marginTop: 2 },
    apptRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      padding: 12, backgroundColor: C.surface,
      borderWidth: 1, borderColor: C.border, borderRadius: 12, marginBottom: 8,
    },
    apptType: { color: C.textPrimary, fontSize: 14, fontWeight: '600' },
    apptTime: { color: C.accent, fontSize: 12, fontWeight: '600' },
    exerciseRow: {
      padding: 12, backgroundColor: C.surface,
      borderWidth: 1, borderColor: C.border, borderRadius: 12, marginBottom: 8,
    },
    exerciseText: { color: C.textSecondary, fontSize: 13, lineHeight: 18 },
    updateBtn: { marginHorizontal: 20, marginTop: 24, backgroundColor: C.surfaceStrong, borderWidth: 1, borderColor: C.borderMed, borderRadius: 16, padding: 16, alignItems: 'center' },
    updateBtnText: { color: C.textSecondary, fontSize: 15, fontWeight: '600' },
    disclaimerWrap: { margin: 20, marginTop: 12 },
  });
}
