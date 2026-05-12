import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import Disclaimer from '../../components/Disclaimer';
import { useTheme } from '../../hooks/useTheme';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

export default function WelcomeScreen({ navigation }: Props) {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoMark}>
          <Text style={styles.logoEmoji}>🏥</Text>
        </View>
        <Text style={styles.title}>ReCharge</Text>
        <Text style={[styles.title, { fontSize: 18, fontWeight: '500', marginTop: 4 }]}>Your recovery, made simple.</Text>
        <Text style={styles.subtitle}>
          Discharge turns your hospital paperwork into plain-English daily tasks, reminders, and
          check-ins.
        </Text>

        <View style={styles.buttons}>
          <TouchableOpacity style={styles.btnPrimary} onPress={() => navigation.navigate('Register')}>
            <Text style={styles.btnPrimaryText}>Get started</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnSecondary} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.btnSecondaryText}>I already have an account</Text>
          </TouchableOpacity>
        </View>

        <Disclaimer />
      </View>
    </SafeAreaView>
  );
}

function makeStyles(C: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bgWelcome },
    content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    logoMark: {
      width: 80, height: 80, borderRadius: 24,
      backgroundColor: C.accentSurface,
      alignItems: 'center', justifyContent: 'center', marginBottom: 28,
    },
    logoEmoji: { fontSize: 36 },
    title: { fontSize: 30, fontWeight: '800', color: C.textPrimary, textAlign: 'center', marginBottom: 12, letterSpacing: -0.5 },
    subtitle: { fontSize: 15, color: C.textTertiary, textAlign: 'center', lineHeight: 22, marginBottom: 48 },
    buttons: { width: '100%', gap: 12, marginBottom: 24 },
    btnPrimary: { backgroundColor: C.accent, padding: 16, borderRadius: 16, alignItems: 'center' },
    btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    btnSecondary: {
      backgroundColor: C.surfaceStrong, padding: 16, borderRadius: 16, alignItems: 'center',
      borderWidth: 1, borderColor: C.borderMed,
    },
    btnSecondaryText: { color: C.textSecondary, fontSize: 16, fontWeight: '600' },
  });
}
