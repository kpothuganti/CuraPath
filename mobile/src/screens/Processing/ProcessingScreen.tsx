import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { uploadPhoto, uploadPDF } from '../../api/discharge';
import { getMedications } from '../../api/medications';
import { dischargeStore } from '../../store/dischargeStore';
import { getCheckInNotifSettings, scheduleCheckInReminder, scheduleMedReminders } from '../../hooks/useNotifications';

type Props = NativeStackScreenProps<RootStackParamList, 'Processing'>;

const STEPS = [
  'Document received',
  'Reading text from image',
  'Extracting medications & instructions',
  'Building your daily plan',
];

export default function ProcessingScreen({ navigation, route }: Props) {
  const [step, setStep] = useState(0);
  const { setDischarge, setMedications } = dischargeStore();

  useEffect(() => {
    const timer = setInterval(() => {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }, 1800);

    async function process() {
      try {
        const { type, base64, text } = route.params;
        const res =
          type === 'photo'
            ? await uploadPhoto(base64!, 'image/jpeg')
            : await uploadPDF(text!);

        setDischarge(res.data);

        const medsRes = await getMedications();
        setMedications(medsRes.data);

        // Schedule daily check-in reminder if enabled
        const notifSettings = await getCheckInNotifSettings();
        if (notifSettings.enabled) {
          await scheduleCheckInReminder(notifSettings.hour, notifSettings.minute);
        }

        // Schedule medication reminders + missed-dose nudges
        if (medsRes.data.length > 0) {
          await scheduleMedReminders(medsRes.data);
        }

        clearInterval(timer);
        setStep(STEPS.length - 1);

        // Small pause so user sees "done"
        setTimeout(() => navigation.replace('Tabs'), 600);
      } catch (err: any) {
        clearInterval(timer);
        Alert.alert(
          'Could not read instructions',
          err.message ?? 'Please try again with a clearer photo.',
          [{ text: 'Try again', onPress: () => navigation.goBack() }]
        );
      }
    }

    process();
    return () => clearInterval(timer);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ActivityIndicator size="large" color="#4f7eff" style={styles.spinner} />
      <Text style={styles.title}>Reading your instructions…</Text>
      <Text style={styles.sub}>
        We're using AI to turn your paperwork into a simple recovery plan.
      </Text>

      <View style={styles.steps}>
        {STEPS.map((label, i) => (
          <View
            key={i}
            style={[
              styles.stepRow,
              i < step && styles.stepDone,
              i === step && styles.stepActive,
            ]}
          >
            <View
              style={[
                styles.dot,
                i < step && styles.dotDone,
                i === step && styles.dotActive,
              ]}
            />
            <Text
              style={[
                styles.stepLabel,
                i < step && styles.labelDone,
                i === step && styles.labelActive,
              ]}
            >
              {i < step ? `✓ ${label}` : label}
            </Text>
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a22', alignItems: 'center', justifyContent: 'center', padding: 32 },
  spinner: { marginBottom: 24 },
  title: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.5, textAlign: 'center', marginBottom: 8 },
  sub: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 20, marginBottom: 32 },
  steps: { width: '100%', gap: 10 },
  stepRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)',
  },
  stepDone: {},
  stepActive: {},
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#333' },
  dotDone: { backgroundColor: '#34d399' },
  dotActive: { backgroundColor: '#4f7eff' },
  stepLabel: { fontSize: 13, color: '#555' },
  labelDone: { color: '#34d399' },
  labelActive: { color: '#fff', fontWeight: '600' },
});
