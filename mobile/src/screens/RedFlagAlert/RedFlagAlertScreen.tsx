import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useTheme } from '../../hooks/useTheme';

type Props = NativeStackScreenProps<RootStackParamList, 'RedFlagAlert'>;

export default function RedFlagAlertScreen({ navigation, route }: Props) {
  const { triggeredFlags, providerPhone } = route.params;
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  function callProvider() {
    Linking.openURL(`tel:${providerPhone}`).catch(() =>
      Alert.alert('Could not open phone', `Please call ${providerPhone} manually.`)
    );
  }

  function goToSettings() {
    navigation.navigate('Tabs', { screen: 'Settings' });
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.icon}><Text style={styles.iconText}>⚠️</Text></View>
      <Text style={styles.title}>Contact Your Care Team</Text>
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

      {providerPhone ? (
        <TouchableOpacity style={styles.callBtn} onPress={callProvider}>
          <Text style={styles.callBtnText}>📞 Call {providerPhone}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.callBtn} onPress={goToSettings}>
          <Text style={styles.callBtnText}>📞 Add Your Doctor's Number</Text>
        </TouchableOpacity>
      )}

      {!providerPhone && (
        <Text style={styles.settingsHint}>
          Go to Settings to add your provider's phone number so you can call them directly.
        </Text>
      )}

      <TouchableOpacity style={styles.dismissBtn} onPress={() => navigation.popToTop()}>
        <Text style={styles.dismissText}>I'll handle this later</Text>
      </TouchableOpacity>

      <Text style={styles.disclaimer}>
        This app does not provide medical advice. If you are experiencing a medical emergency,
        call 911 immediately.
      </Text>
    </SafeAreaView>
  );
}

function makeStyles(C: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bgAlert, alignItems: 'center', justifyContent: 'center', padding: 24 },
    icon: {
      width: 80, height: 80, borderRadius: 28,
      backgroundColor: C.dangerSurface,
      borderWidth: 2, borderColor: C.dangerBorder,
      alignItems: 'center', justifyContent: 'center', marginBottom: 20,
    },
    iconText: { fontSize: 36 },
    title: { fontSize: 24, fontWeight: '800', color: C.danger, letterSpacing: -0.5, marginBottom: 10 },
    body: { fontSize: 15, color: C.textTertiary, lineHeight: 22, textAlign: 'center', marginBottom: 24 },
    symptoms: {
      width: '100%',
      backgroundColor: C.surfaceDanger,
      borderWidth: 1, borderColor: C.dangerBorder,
      borderRadius: 16, padding: 16, marginBottom: 24, gap: 10,
    },
    symptomRow: { flexDirection: 'row', gap: 8 },
    symptomBullet: { color: C.dangerText, fontWeight: '800', fontSize: 13 },
    symptomText: { color: C.dangerText, fontSize: 13, flex: 1 },
    callBtn: {
      width: '100%', padding: 18,
      backgroundColor: C.danger, borderRadius: 16,
      alignItems: 'center', marginBottom: 8,
    },
    callBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
    settingsHint: { color: C.textTertiary, fontSize: 12, textAlign: 'center', marginBottom: 12, lineHeight: 18 },
    dismissBtn: {
      width: '100%', padding: 14,
      borderWidth: 1, borderColor: C.borderMed,
      borderRadius: 16, alignItems: 'center', marginTop: 4,
    },
    dismissText: { color: C.textTertiary, fontSize: 14 },
    disclaimer: { fontSize: 11, color: C.textMuted, marginTop: 16, lineHeight: 16, textAlign: 'center' },
  });
}
