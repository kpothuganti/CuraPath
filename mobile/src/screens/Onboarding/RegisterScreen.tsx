import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { register } from '../../api/auth';
import { authStore } from '../../store/authStore';
import { useTheme } from '../../hooks/useTheme';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterScreen({ navigation }: Props) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = authStore();
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  async function handleRegister() {
    if (!firstName.trim()) {
      Alert.alert('Missing field', 'Please enter your first name.');
      return;
    }
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Weak password', 'Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await register(email.trim(), password, timezone, firstName.trim(), lastName.trim());
      await setAuth(res.data.user, res.data.accessToken, res.data.refreshToken);
      navigation.navigate('Permissions');
    } catch (err: any) {
      const msg = err.message ?? '';
      if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already exists')) {
        Alert.alert('Email taken', 'An account with this email already exists. Try logging in instead.');
      } else {
        Alert.alert('Error', msg || 'Something went wrong. Please try again.');
      }
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
        <Text style={styles.title}>Create account</Text>

        <View style={styles.nameRow}>
          <TextInput
            style={[styles.input, styles.nameInput]}
            placeholder="First name"
            placeholderTextColor={C.placeholderText}
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
            autoComplete="given-name"
          />
          <TextInput
            style={[styles.input, styles.nameInput]}
            placeholder="Last name"
            placeholderTextColor={C.placeholderText}
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
            autoComplete="family-name"
          />
        </View>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={C.placeholderText}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <TextInput
          style={styles.input}
          placeholder="Password (min. 8 characters)"
          placeholderTextColor={C.placeholderText}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
        />

        <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Create account</Text>}
        </TouchableOpacity>
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
    title: { fontSize: 26, fontWeight: '800', color: C.textPrimary, marginBottom: 28, letterSpacing: -0.5 },
    nameRow: { flexDirection: 'row', gap: 10 },
    nameInput: { flex: 1 },
    input: {
      backgroundColor: C.surfaceStrong, borderWidth: 1,
      borderColor: C.borderMed, borderRadius: 14,
      padding: 16, color: C.textPrimary, fontSize: 15, marginBottom: 12,
    },
    btn: { backgroundColor: C.accent, padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 8 },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  });
}
