import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import Disclaimer from '../../components/Disclaimer';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

export default function WelcomeScreen({ navigation }: Props) {
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1b4b' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  logoMark: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: 'rgba(79,126,255,0.2)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 28,
  },
  logoEmoji: { fontSize: 36 },
  title: { fontSize: 30, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 12, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: '#8a8a9a', textAlign: 'center', lineHeight: 22, marginBottom: 48 },
  buttons: { width: '100%', gap: 12, marginBottom: 24 },
  btnPrimary: {
    backgroundColor: '#4f7eff', padding: 16, borderRadius: 16, alignItems: 'center',
  },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnSecondary: {
    backgroundColor: 'rgba(255,255,255,0.07)', padding: 16, borderRadius: 16, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  btnSecondaryText: { color: '#ccc', fontSize: 16, fontWeight: '600' },
});
