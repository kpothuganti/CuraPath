import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import * as Notifications from 'expo-notifications';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Permissions'>;

const BENEFITS = [
  { icon: '🩺', text: 'Daily check-in reminders so you never miss a symptom check' },
  { icon: '💊', text: 'Medication reminders at the times on your discharge paperwork' },
  { icon: '⚠️', text: 'Missed-dose alerts if you haven\'t logged a medication' },
];

export default function PermissionsScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(false);

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
          ReCharge uses notifications to keep your recovery on schedule. You can change this any
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#13131a' },
  content: { flex: 1, padding: 28, justifyContent: 'center' },
  iconWrap: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: 'rgba(79,126,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(79,126,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: 28,
  },
  icon: { fontSize: 34 },
  title: {
    fontSize: 24, fontWeight: '800', color: '#fff',
    textAlign: 'center', letterSpacing: -0.5, marginBottom: 12,
  },
  subtitle: {
    fontSize: 14, color: '#8a8a9a', textAlign: 'center',
    lineHeight: 21, marginBottom: 32,
  },
  benefits: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16, padding: 16, gap: 14, marginBottom: 24,
  },
  benefitRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  benefitIcon: { fontSize: 18, marginTop: 1 },
  benefitText: { color: '#ccc', fontSize: 14, lineHeight: 20, flex: 1 },
  disclaimer: {
    backgroundColor: 'rgba(79,126,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(79,126,255,0.15)',
    borderRadius: 12, padding: 12, marginBottom: 32,
  },
  disclaimerText: { color: '#6a8fd4', fontSize: 11, lineHeight: 16, textAlign: 'center' },
  buttons: { gap: 10 },
  btnPrimary: {
    backgroundColor: '#4f7eff', padding: 16,
    borderRadius: 16, alignItems: 'center',
  },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnSkip: {
    padding: 14, borderRadius: 16, alignItems: 'center',
  },
  btnSkipText: { color: '#555', fontSize: 15, fontWeight: '600' },
});
