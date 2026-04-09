import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Linking, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'RedFlagAlert'>;

export default function RedFlagAlertScreen({ navigation, route }: Props) {
  const { triggeredFlags, providerPhone } = route.params;

  function callProvider() {
    const number = providerPhone ?? '911';
    Linking.openURL(`tel:${number}`).catch(() =>
      Alert.alert('Could not open phone', `Please call ${number} manually.`)
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.icon}><Text style={styles.iconText}>⚠️</Text></View>
      <Text style={styles.title}>Contact your care team</Text>
      <Text style={styles.body}>
        Based on your check-in, you may be experiencing a warning sign your doctor wanted you to
        watch for.
      </Text>

      <View style={styles.symptoms}>
        {triggeredFlags.map((flag, i) => (
          <View key={i} style={styles.symptomRow}>
            <Text style={styles.symptomBullet}>!</Text>
            <Text style={styles.symptomText}>{flag}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.callBtn} onPress={callProvider}>
        <Text style={styles.callBtnText}>
          📞 {providerPhone ? `Call ${providerPhone}` : 'Call 911'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.dismissBtn} onPress={() => navigation.navigate('Tabs')}>
        <Text style={styles.dismissText}>I'll handle this later</Text>
      </TouchableOpacity>

      <Text style={styles.disclaimer}>
        This app does not provide medical advice. If you are experiencing a medical emergency,
        call 911 immediately.
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a0f0f', alignItems: 'center', justifyContent: 'center', padding: 24 },
  icon: {
    width: 80, height: 80, borderRadius: 28,
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 2, borderColor: 'rgba(239,68,68,0.3)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  iconText: { fontSize: 36 },
  title: { fontSize: 24, fontWeight: '800', color: '#ef4444', letterSpacing: -0.5, marginBottom: 10 },
  body: { fontSize: 15, color: '#999', lineHeight: 22, textAlign: 'center', marginBottom: 24 },
  symptoms: {
    width: '100%',
    backgroundColor: 'rgba(239,68,68,0.06)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.15)',
    borderRadius: 16, padding: 16, marginBottom: 24, gap: 10,
  },
  symptomRow: { flexDirection: 'row', gap: 8 },
  symptomBullet: { color: '#f87171', fontWeight: '800', fontSize: 13 },
  symptomText: { color: '#f87171', fontSize: 13, flex: 1 },
  callBtn: {
    width: '100%', padding: 18,
    backgroundColor: '#ef4444', borderRadius: 16,
    alignItems: 'center', marginBottom: 12,
  },
  callBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  dismissBtn: {
    width: '100%', padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16, alignItems: 'center',
  },
  dismissText: { color: '#666', fontSize: 14 },
  disclaimer: { fontSize: 11, color: '#44383a', marginTop: 16, lineHeight: 16, textAlign: 'center' },
});
