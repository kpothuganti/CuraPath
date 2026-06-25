import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { forgotPassword, resetPassword } from '../../api/auth';
import { useTheme } from '../../hooks/useTheme';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;
type Step = 'email' | 'code' | 'done';

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  async function handleSendCode() {
    if (!email.trim()) { Alert.alert('Missing email', 'Please enter your email address.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { Alert.alert('Invalid email', 'Please enter a valid email address.'); return; }
    setLoading(true);
    try {
      await forgotPassword(email.trim());
      setStep('code');
    } catch {
      setStep('code'); // Always proceed to avoid enumeration
    } finally {
      setLoading(false);
    }
  }

  async function handleReset() {
    if (!code.trim() || code.length !== 6) { Alert.alert('Invalid code', 'Please enter the 6-digit code from your email.'); return; }
    if (newPassword.length < 8) { Alert.alert('Weak password', 'Password must be at least 8 characters.'); return; }
    if (newPassword !== confirmPassword) { Alert.alert('Mismatch', 'Passwords do not match.'); return; }
    setLoading(true);
    try {
      await resetPassword(email.trim(), code.trim(), newPassword);
      setStep('done');
    } catch (err: any) {
      Alert.alert('Failed', err.message ?? 'Invalid or expired code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        {step === 'email' && (
          <>
            <Text style={styles.title}>Reset password</Text>
            <Text style={styles.sub}>Enter your email and we'll send you a 6-digit code.</Text>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={C.placeholderText}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoFocus
            />
            <TouchableOpacity style={styles.btn} onPress={handleSendCode} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Send code</Text>}
            </TouchableOpacity>
          </>
        )}

        {step === 'code' && (
          <>
            <Text style={styles.title}>Check your email</Text>
            <Text style={styles.sub}>We sent a 6-digit code to {email}. Enter it below along with your new password.</Text>
            <TextInput
              style={styles.input}
              placeholder="6-digit code"
              placeholderTextColor={C.placeholderText}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />
            <TextInput
              style={styles.input}
              placeholder="New password"
              placeholderTextColor={C.placeholderText}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />
            <TextInput
              style={styles.input}
              placeholder="Confirm new password"
              placeholderTextColor={C.placeholderText}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
            <TouchableOpacity style={styles.btn} onPress={handleReset} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Reset password</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.resendBtn} onPress={handleSendCode} disabled={loading}>
              <Text style={styles.resendText}>Resend code</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 'done' && (
          <View style={styles.doneWrap}>
            <Text style={styles.doneIcon}>✅</Text>
            <Text style={styles.title}>Password reset!</Text>
            <Text style={styles.sub}>Your password has been updated. You can now log in with your new password.</Text>
            <TouchableOpacity style={styles.btn} onPress={() => navigation.navigate('Login')}>
              <Text style={styles.btnText}>Log in</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function makeStyles(C: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bgAlt },
    content: { flex: 1, padding: 24, justifyContent: 'center' },
    back: { marginBottom: 32 },
    backText: { color: C.accent, fontSize: 14 },
    title: { fontSize: 26, fontWeight: '800', color: C.textPrimary, marginBottom: 12, letterSpacing: -0.5 },
    sub: { fontSize: 15, color: C.textSecondary, lineHeight: 22, marginBottom: 28 },
    input: {
      backgroundColor: C.surfaceStrong, borderWidth: 1,
      borderColor: C.borderMed, borderRadius: 14,
      padding: 16, color: C.textPrimary, fontSize: 15, marginBottom: 12,
    },
    btn: { backgroundColor: C.accent, padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 4 },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    resendBtn: { alignItems: 'center', marginTop: 16 },
    resendText: { color: C.accent, fontSize: 14, fontWeight: '500' },
    doneWrap: { alignItems: 'center', gap: 12 },
    doneIcon: { fontSize: 48, marginBottom: 8 },
  });
}
