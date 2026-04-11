import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, ActivityIndicator, Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { uploadPhoto, uploadPDF } from '../../api/discharge';
import { getMedications } from '../../api/medications';
import { dischargeStore } from '../../store/dischargeStore';
import { getCheckInNotifSettings, scheduleCheckInReminder, scheduleMedReminders } from '../../hooks/useNotifications';

type Props = NativeStackScreenProps<RootStackParamList, 'Review'>;

export default function ReviewScreen({ navigation, route }: Props) {
  const { parsedJson, uploadParams } = route.params;
  const { setDischarge, setMedications } = dischargeStore();
  const [saving, setSaving] = useState(false);

  async function handleConfirm() {
    setSaving(true);
    try {
      const res = uploadParams.type === 'photo'
        ? await uploadPhoto(uploadParams.base64!, 'image/jpeg')
        : await uploadPDF(uploadParams.text!);

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

  const { medications, activity_restrictions, red_flags, diet_restrictions, wound_care, follow_up_appointments } = parsedJson;

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
          <Section title="💊 Medications">
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
          <Section title="🚶 Activity restrictions">
            {activity_restrictions.map((r, i) => (
              <BulletRow key={i} text={r} />
            ))}
          </Section>
        )}

        {red_flags.length > 0 && (
          <Section title="⚠️ Warning signs to watch for">
            {red_flags.map((f, i) => (
              <BulletRow key={i} text={f} color="#f87171" />
            ))}
          </Section>
        )}

        {diet_restrictions.length > 0 && (
          <Section title="🥗 Diet restrictions">
            {diet_restrictions.map((d, i) => (
              <BulletRow key={i} text={d} />
            ))}
          </Section>
        )}

        {wound_care.length > 0 && (
          <Section title="🩹 Wound care">
            {wound_care.map((w, i) => (
              <BulletRow key={i} text={w} />
            ))}
          </Section>
        )}

        {follow_up_appointments.length > 0 && (
          <Section title="📅 Follow-up appointments">
            {follow_up_appointments.map((a, i) => (
              <BulletRow key={i} text={`${a.type} — ${a.timeframe}`} />
            ))}
          </Section>
        )}

        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            This was extracted from your discharge paperwork using AI. If anything looks incorrect,
            tap "Something's wrong" and retake the photo with better lighting.
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
            <Text style={styles.btnRetryText}>Something's wrong — retake photo</Text>
          </TouchableOpacity>
        </View>

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

function BulletRow({ text, color = '#ccc' }: { text: string; color?: string }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={[styles.bullet, { color }]}>·</Text>
      <Text style={[styles.bulletText, { color }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#13131a' },
  header: { padding: 20, paddingBottom: 8 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.5, marginBottom: 6 },
  subtitle: { color: '#666', fontSize: 13, lineHeight: 18 },
  scroll: { padding: 20, paddingTop: 8, paddingBottom: 48 },
  section: { marginBottom: 20 },
  sectionTitle: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 10 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12, padding: 12, marginBottom: 8,
  },
  cardTitle: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 2 },
  cardDetail: { color: '#aaa', fontSize: 13, marginBottom: 2 },
  cardMeta: { color: '#666', fontSize: 12, marginTop: 2 },
  bulletRow: { flexDirection: 'row', gap: 8, marginBottom: 6, paddingRight: 8 },
  bullet: { fontSize: 16, lineHeight: 20 },
  bulletText: { fontSize: 13, lineHeight: 20, flex: 1 },
  disclaimer: {
    backgroundColor: 'rgba(79,126,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(79,126,255,0.15)',
    borderRadius: 12, padding: 12, marginBottom: 20,
  },
  disclaimerText: { color: '#6a8fd4', fontSize: 11, lineHeight: 16 },
  actions: { gap: 10 },
  btnConfirm: {
    backgroundColor: '#4f7eff', padding: 16,
    borderRadius: 16, alignItems: 'center',
  },
  btnConfirmText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnRetry: {
    padding: 14, borderRadius: 16, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  btnRetryText: { color: '#aaa', fontSize: 14, fontWeight: '600' },
});
