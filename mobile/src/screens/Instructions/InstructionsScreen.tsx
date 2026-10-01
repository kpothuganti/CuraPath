import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { dischargeStore } from '../../store/dischargeStore';
import Disclaimer from '../../components/Disclaimer';
import { useTheme } from '../../hooks/useTheme';
import { useUITranslations } from '../../hooks/useUITranslations';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../../navigation/AppNavigator';

function cap(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function InstructionsScreen() {
  const { discharge } = dischargeStore();
  const p = discharge?.parsed_json;
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { t } = useUITranslations();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  if (!p) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <Text style={styles.empty}>No instructions uploaded yet.</Text>
      </SafeAreaView>
    );
  }

  // Bedrock's parsing is non-deterministic — the system prompt asks it to
  // always return an array for these fields, but that's not a runtime
  // guarantee. It's returned a bare string instead of string[] before
  // (e.g. sleeping_instructions as one paragraph), which crashed this
  // screen outright since a string has .length but not .map(). Checking
  // actual array-ness (not just null) guards against any field shape.
  const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  // Plain string-list fields: if Bedrock returns one prose string instead of
  // string[], keep it as a single item rather than silently dropping real
  // medical content (medications/appointments are object arrays, so a
  // wayward string there can't be salvaged the same way — falls back to []).
  const asStringArray = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : typeof v === 'string' && v.trim() ? [v] : [];
  const redFlags = asStringArray(p.red_flags);
  const medications = asArray<typeof p.medications[number]>(p.medications);
  const activityRestrictions = asStringArray(p.activity_restrictions);
  const followUpAppointments = asArray<typeof p.follow_up_appointments[number]>(p.follow_up_appointments);
  const dietRestrictions = asStringArray(p.diet_restrictions);
  const woundCare = asStringArray(p.wound_care);
  const sleepingInstructions = asStringArray(p.sleeping_instructions);
  const exercises = asStringArray(p.exercises);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('yourInstructions')}</Text>
          <Text style={styles.sub}>
            {t('uploaded')} {new Date(discharge!.created_at).toLocaleDateString()}
          </Text>
        </View>

        {redFlags.length > 0 && (
          <Section title={t('warningSigns')} icon="warning-outline" styles={styles}>
            <View style={styles.pills}>
              {redFlags.map((f, i) => (
                <Text key={i} style={[styles.pill, styles.pillRed]}>{f}</Text>
              ))}
            </View>
          </Section>
        )}

        {medications.length > 0 && (
          <Section title={t('medicationsSection')} icon="medical-outline" styles={styles}>
            {medications.map((m, i) => (
              <View key={i} style={styles.medRow}>
                <Text style={styles.medName}>{m.name} {m.dose}</Text>
                <Text style={styles.medDetail}>{cap(m.frequency)} - {asArray<string>(m.times).map(t => { const [h, min] = t.split(':').map(Number); return `${h % 12 || 12}:${String(min).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; }).join(', ')} - {m.instructions}</Text>
              </View>
            ))}
          </Section>
        )}

        {activityRestrictions.length > 0 && (
          <Section title={t('activityRestrictionsSection')} icon="walk-outline" styles={styles}>
            <View style={styles.pills}>
              {activityRestrictions.map((r, i) => (
                <Text key={i} style={styles.pill}>{r}</Text>
              ))}
            </View>
          </Section>
        )}

        {followUpAppointments.length > 0 && (
          <Section title={t('followUpSection')} icon="calendar-outline" styles={styles}>
            {followUpAppointments.map((a, i) => (
              <View key={i} style={styles.apptRow}>
                <Text style={styles.apptType}>{a.type}:</Text>
                <Text style={styles.apptTime}>{cap(a.timeframe)}</Text>
              </View>
            ))}
          </Section>
        )}

        {dietRestrictions.length > 0 && (
          <Section title={t('dietSection')} icon="restaurant-outline" styles={styles}>
            <View style={styles.pills}>
              {dietRestrictions.map((d, i) => (
                <Text key={i} style={[styles.pill, styles.pillGreen]}>{d}</Text>
              ))}
            </View>
          </Section>
        )}

        {woundCare.length > 0 && (
          <Section title={t('woundCareSection')} icon="bandage-outline" styles={styles}>
            <View style={styles.pills}>
              {woundCare.map((w, i) => (
                <Text key={i} style={styles.pill}>{w}</Text>
              ))}
            </View>
          </Section>
        )}

        {sleepingInstructions.length > 0 && (
          <Section title={t('sleepingSection')} icon="moon-outline" styles={styles}>
            <View style={styles.pills}>
              {sleepingInstructions.map((s, i) => (
                <Text key={i} style={styles.pill}>{s}</Text>
              ))}
            </View>
          </Section>
        )}

        {exercises.length > 0 && (
          <Section title={t('exercisesSection')} icon="barbell-outline" styles={styles}>
            {exercises.map((e, i) => {
              const colonIdx = e.indexOf(':');
              const label = colonIdx === -1 ? e : e.slice(0, colonIdx);
              const rest = colonIdx === -1 ? '' : e.slice(colonIdx);
              const titleLabel = cap(label);
              return (
                <View key={i} style={styles.exerciseRow}>
                  <Text style={styles.exerciseText}>
                    <Text style={{ fontWeight: '700' }}>{titleLabel}</Text>{rest}
                  </Text>
                </View>
              );
            })}
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

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
function Section({ title, icon, children, styles }: { title: string; icon: IoniconName; children: React.ReactNode; styles: ReturnType<typeof makeStyles> }) {
  const C = useTheme();
  return (
    <View style={styles.section}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <Ionicons name={icon} size={13} color={C.accent} />
        <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function makeStyles(C: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    center: { alignItems: 'center', justifyContent: 'center' },
    empty: { color: C.textMuted, fontSize: 15 },
    scroll: { paddingBottom: 16 },
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
      flexDirection: 'column', alignItems: 'flex-start',
      padding: 12, backgroundColor: C.surface,
      borderWidth: 1, borderColor: C.border, borderRadius: 12, marginBottom: 8, gap: 4,
    },
    apptType: { color: C.textPrimary, fontSize: 14, fontWeight: '600', flexShrink: 1 },
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
