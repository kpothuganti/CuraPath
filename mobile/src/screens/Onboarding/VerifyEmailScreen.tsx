import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { verifyEmail, resendVerification } from '../../api/auth';
import { authStore } from '../../store/authStore';
import { useTheme } from '../../hooks/useTheme';

type Props = NativeStackScreenProps<RootStackParamList, 'VerifyEmail'>;

export default function VerifyEmailScreen({ navigation }: Props) {
  const { user, updateUser, logout } = authStore();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  async function handleVerify() {
    if (!code.trim() || code.length !== 6) {
      Alert.alert('Invalid code', 'Please enter the 6-digit code from your email.');
      return;
    }
    setLoading(true);
    try {
      const res = await verifyEmail(code.trim());
      await updateUser(res.data.user);
      navigation.navigate('Permissions');
    } catch (err: any) {
      Alert.alert('Verification failed', err.message ?? 'Invalid or expired code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    try {
      await resendVerification();
      Alert.alert('Code sent', 'A new verification code has been sent to your email.');
    } catch {
      Alert.alert('Failed to resend', 'Please try again in a moment.');
    } finally {
      setResending(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Verify your email</Text>
          <Text style={styles.sub}>
            We sent a 6-digit code to {user?.email}. Enter it below to finish setting up your account.
          </Text>
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
          <TouchableOpacity style={styles.btn} onPress={handleVerify} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Verify</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.resendBtn} onPress={handleResend} disabled={resending}>
            <Text style={styles.resendText}>{resending ? 'Sending…' : "Didn't get a code? Resend"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutBtn} onPress={() => logout()}>
            <Text style={styles.logoutText}>Log out</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(C: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bgAlt },
    flex: { flex: 1 },
    content: { flexGrow: 1, padding: 24, justifyContent: 'center' },
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
    logoutBtn: { alignItems: 'center', marginTop: 24 },
    logoutText: { color: C.textMuted, fontSize: 13 },
  });
}
