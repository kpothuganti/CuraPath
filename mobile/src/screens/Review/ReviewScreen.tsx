import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { uploadPhoto, uploadPDF } from '../../api/discharge';
import { getPreferredLanguage } from '../../hooks/useLanguage';
import { getMedications } from '../../api/medications';
import { dischargeStore } from '../../store/dischargeStore';
import { getCheckInNotifSettings, scheduleCheckInReminder, scheduleMedReminders } from '../../hooks/useNotifications';
import { useTheme } from '../../hooks/useTheme';

type Props = NativeStackScreenProps<RootStackParamList, 'Review'>;

export default function ReviewScreen({ navigation, route }: Props) {
  const { parsedJson, uploadParams } = route.params;
  const { setDischarge, setMedications } = dischargeStore();
  const [saving, setSaving] = useState(false);
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  async function handleConfirm() {
    setSaving(true);
    try {
      const lang = await getPreferredLanguage();
      const res = uploadParams.type === 'photo'
        ? await uploadPhoto(uploadParams.base64!, 'image/jpeg', { language: lang.name })
        : await uploadPDF(uploadParams.base64!, { language: lang.name });

      setDischarge(res.data);

      const medsRes = await getMedications();
      setMedications(medsRes.data);

      const notifSettings = await getCheckInNotifSettings();
      if (notifSettings.enabled) {
        await scheduleCheckInReminder(notifSettings.hour, notifSettings.minute);
      }
      if (medsRes.data.length > 0) {
        await scheduleMedReminders(medsRes.data);
      }

      navigation.replace('Tabs');
    } catch (err: any) {
      Alert.alert(
        'Could not save instructions',
        err.message ?? 'Please try again.',
        [{ text: 'OK' }]
      );
      setSaving(false);
    }
  }

  function handleRetry() {
    navigation.replace('Upload');
  }

  const { medications, activity_restrictions, red_flags, diet_restrictions, wound_care, follow_up_appointments, sleeping_instructions, exercises } = parsedJson;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Review your instructions</Text>
        <Text style={styles.subtitle}>
          Make sure everything looks right before we save your recovery plan.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {medications.length > 0 && (
          <Section title="💊 Medications" styles={styles}>
            {medications.map((med, i) => (
              <View key={i} style={styles.card}>
                <Text style={styles.cardTitle}>{med.name} — {med.dose}</Text>
                <Text style={styles.cardDetail}>{med.frequency}</Text>
                {med.times.length > 0 && (
                  <Text style={styles.cardMeta}>Times: {med.times.join(', ')}</Text>
                )}
                {med.instructions ? (
                  <Text style={styles.cardMeta}>{med.instructions}</Text>
                ) : null}
              </View>
            ))}
          </Section>
        )}

        {activity_restrictions.length > 0 && (
          <Section title="🚶 Activity restrictions" styles={styles}>
            {activity_restrictions.map((r, i) => (
              <BulletRow key={i} text={r} color={C.textSecondary} />
            ))}
          </Section>
        )}

        {red_flags.length > 0 && (
          <Section title="⚠️ Warning signs to watch for" styles={styles}>
            {red_flags.map((f, i) => (
              <BulletRow key={i} text={f} color={C.dangerText} />
            ))}
          </Section>
        )}

        {diet_restrictions.length > 0 && (
          <Section title="🥗 Diet restrictions" styles={styles}>
            {diet_restrictions.map((d, i) => (
              <BulletRow key={i} text={d} color={C.textSecondary} />
            ))}
          </Section>
        )}

        {wound_care.length > 0 && (
          <Section title="🩹 Wound care" styles={styles}>
            {wound_care.map((w, i) => (
              <BulletRow key={i} text={w} color={C.textSecondary} />
            ))}
          </Section>
        )}

        {follow_up_appointments.length > 0 && (
          <Section title="📅 Follow-up appointments" styles={styles}>
            {follow_up_appointments.map((a, i) => (
              <BulletRow key={i} text={`${a.type} — ${a.timeframe}`} color={C.textSecondary} />
            ))}
          </Section>
        )}

        {sleeping_instructions && sleeping_instructions.length > 0 && (
          <Section title="😴 Sleeping" styles={styles}>
            {sleeping_instructions.map((s, i) => (
              <BulletRow key={i} text={s} color={C.textSecondary} />
            ))}
          </Section>
        )}

        {exercises && exercises.length > 0 && (
          <Section title="🏋️ Exercises" styles={styles}>
            {exercises.map((e, i) => (
              <BulletRow key={i} text={e} color={C.textSecondary} />
            ))}
          </Section>
        )}

        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            This was extracted from your discharge paperwork using AI. If anything looks incorrect,
            tap "Something's wrong" to go back and try again.
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.btnConfirm}
            onPress={handleConfirm}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnConfirmText}>Looks good — save my plan</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnRetry} onPress={handleRetry} disabled={saving}>
            <Text style={styles.btnRetryText}>Something's wrong — re-enter instructions</Text>
          </TouchableOpacity>
        </View>

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

function BulletRow({ text, color }: { text: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6, paddingRight: 8 }}>
      <Text style={{ color, fontSize: 16, lineHeight: 20 }}>·</Text>
      <Text style={{ color, fontSize: 13, lineHeight: 20, flex: 1 }}>{text}</Text>
    </View>
  );
}

function makeStyles(C: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    header: { padding: 20, paddingBottom: 8 },
    title: { color: C.textPrimary, fontSize: 22, fontWeight: '800', letterSpacing: -0.5, marginBottom: 6 },
    subtitle: { color: C.textTertiary, fontSize: 13, lineHeight: 18 },
    scroll: { padding: 20, paddingTop: 8, paddingBottom: 48 },
    section: { marginBottom: 20 },
    sectionTitle: { color: C.textPrimary, fontSize: 14, fontWeight: '700', marginBottom: 10 },
    card: {
      backgroundColor: C.surface,
      borderWidth: 1, borderColor: C.border,
      borderRadius: 12, padding: 12, marginBottom: 8,
    },
    cardTitle: { color: C.textPrimary, fontSize: 14, fontWeight: '700', marginBottom: 2 },
    cardDetail: { color: C.textTertiary, fontSize: 13, marginBottom: 2 },
    cardMeta: { color: C.textMuted, fontSize: 12, marginTop: 2 },
    disclaimer: {
      backgroundColor: C.surfaceAccent,
      borderWidth: 1, borderColor: C.borderAccent,
      borderRadius: 12, padding: 12, marginBottom: 20,
    },
    disclaimerText: { color: C.accentSubtext, fontSize: 11, lineHeight: 16 },
    actions: { gap: 10 },
    btnConfirm: { backgroundColor: C.accent, padding: 16, borderRadius: 16, alignItems: 'center' },
    btnConfirmText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    btnRetry: {
      padding: 14, borderRadius: 16, alignItems: 'center',
      borderWidth: 1, borderColor: C.borderMed,
    },
    btnRetryText: { color: C.textTertiary, fontSize: 14, fontWeight: '600' },
  });
}
