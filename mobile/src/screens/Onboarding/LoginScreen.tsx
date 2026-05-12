import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { login } from '../../api/auth';
import { authStore } from '../../store/authStore';
import { useTheme } from '../../hooks/useTheme';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = authStore();
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      const res = await login(email.trim(), password);
      await setAuth(res.data.user, res.data.accessToken, res.data.refreshToken);
    } catch (err: any) {
      const msg = err.message ?? '';
      if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('credentials')) {
        Alert.alert('Login failed', 'Incorrect email or password. Please try again.');
      } else {
        Alert.alert('Login failed', msg || 'Something went wrong. Please try again.');
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
        <Text style={styles.title}>Welcome back</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={C.placeholderText}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={C.placeholderText}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Log in</Text>}
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
    input: {
      backgroundColor: C.surfaceStrong, borderWidth: 1,
      borderColor: C.borderMed, borderRadius: 14,
      padding: 16, color: C.textPrimary, fontSize: 15, marginBottom: 12,
    },
    btn: { backgroundColor: C.accent, padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 8 },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  });
}
