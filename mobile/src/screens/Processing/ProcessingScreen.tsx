import React, { useMemo, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { parseDischarge } from '../../api/discharge';
import { getPreferredLanguage } from '../../hooks/useLanguage';
import { useTheme } from '../../hooks/useTheme';

type Props = NativeStackScreenProps<RootStackParamList, 'Processing'>;

const STEPS = [
  'Document received',
  'Reading text from image',
  'Extracting medications & instructions',
  'Building your daily plan',
];

export default function ProcessingScreen({ navigation, route }: Props) {
  const [step, setStep] = useState(0);
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  useEffect(() => {
    const timer = setInterval(() => {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }, 1800);

    async function process() {
      try {
        const { type, base64, text } = route.params;
        const lang = await getPreferredLanguage();
        const res = await parseDischarge(type, { base64, text, mediaType: 'image/jpeg', language: lang.name });

        clearInterval(timer);
        setStep(STEPS.length - 1);

        setTimeout(() => {
          navigation.replace('Review', {
            parsedJson: res.data,
            uploadParams: route.params,
          });
        }, 600);
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
      <ActivityIndicator size="large" color={C.accent} style={styles.spinner} />
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

function makeStyles(C: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bgAlt, alignItems: 'center', justifyContent: 'center', padding: 32 },
    spinner: { marginBottom: 24 },
    title: { fontSize: 22, fontWeight: '800', color: C.textPrimary, letterSpacing: -0.5, textAlign: 'center', marginBottom: 8 },
    sub: { fontSize: 14, color: C.textTertiary, textAlign: 'center', lineHeight: 20, marginBottom: 32 },
    steps: { width: '100%', gap: 10 },
    stepRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      padding: 12, borderRadius: 12, backgroundColor: C.surface,
    },
    stepDone: {},
    stepActive: {},
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.checkRing },
    dotDone: { backgroundColor: C.success },
    dotActive: { backgroundColor: C.accent },
    stepLabel: { fontSize: 13, color: C.textMuted },
    labelDone: { color: C.success },
    labelActive: { color: C.textPrimary, fontWeight: '600' },
  });
}
