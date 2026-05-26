import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useTheme } from '../../hooks/useTheme';

type Props = NativeStackScreenProps<RootStackParamList, 'Permissions'>;

const BENEFITS = [
  { icon: '🩺', text: 'Daily check-in reminders so you never miss a symptom check' },
  { icon: '💊', text: 'Medication reminders at the times on your discharge paperwork' },
  { icon: '⚠️', text: 'Missed-dose alerts if you haven\'t logged a medication' },
];

export default function PermissionsScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(false);
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  async function handleEnable() {
    setLoading(true);
    await Notifications.requestPermissionsAsync();
    setLoading(false);
    navigation.replace('Tabs');
  }

  function handleSkip() {
    navigation.replace('Tabs');
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>🔔</Text>
        </View>

        <Text style={styles.title}>Stay on track with notifications</Text>
        <Text style={styles.subtitle}>
          CuraPath uses notifications to keep your recovery on schedule. You can change this any
          time in Settings.
        </Text>

        <View style={styles.benefits}>
          {BENEFITS.map((b, i) => (
            <View key={i} style={styles.benefitRow}>
              <Text style={styles.benefitIcon}>{b.icon}</Text>
              <Text style={styles.benefitText}>{b.text}</Text>
            </View>
          ))}
        </View>

        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            This app does not provide medical advice. Always follow your doctor's instructions.
          </Text>
        </View>

        <View style={styles.buttons}>
          <TouchableOpacity style={styles.btnPrimary} onPress={handleEnable} disabled={loading}>
            <Text style={styles.btnPrimaryText}>Enable notifications</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnSkip} onPress={handleSkip}>
            <Text style={styles.btnSkipText}>Not now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(C: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    content: { flex: 1, padding: 28, justifyContent: 'center' },
    iconWrap: {
      width: 72, height: 72, borderRadius: 22,
      backgroundColor: C.accentSurface,
      borderWidth: 1, borderColor: C.accentBorder,
      alignItems: 'center', justifyContent: 'center',
      alignSelf: 'center', marginBottom: 28,
    },
    icon: { fontSize: 34 },
    title: { fontSize: 24, fontWeight: '800', color: C.textPrimary, textAlign: 'center', letterSpacing: -0.5, marginBottom: 12 },
    subtitle: { fontSize: 14, color: C.textTertiary, textAlign: 'center', lineHeight: 21, marginBottom: 32 },
    benefits: {
      backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
      borderRadius: 16, padding: 16, gap: 14, marginBottom: 24,
    },
    benefitRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
    benefitIcon: { fontSize: 18, marginTop: 1 },
    benefitText: { color: C.textSecondary, fontSize: 14, lineHeight: 20, flex: 1 },
    disclaimer: {
      backgroundColor: C.surfaceAccent, borderWidth: 1, borderColor: C.borderAccent,
      borderRadius: 12, padding: 12, marginBottom: 32,
    },
    disclaimerText: { color: C.accentSubtext, fontSize: 11, lineHeight: 16, textAlign: 'center' },
    buttons: { gap: 10 },
    btnPrimary: { backgroundColor: C.accent, padding: 16, borderRadius: 16, alignItems: 'center' },
    btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    btnSkip: { padding: 14, borderRadius: 16, alignItems: 'center' },
    btnSkipText: { color: C.textMuted, fontSize: 15, fontWeight: '600' },
  });
}
