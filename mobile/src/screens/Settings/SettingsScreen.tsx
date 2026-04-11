import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, Alert, Switch,
} from 'react-native';
import { authStore } from '../../store/authStore';
import { dischargeStore } from '../../store/dischargeStore';
import { deleteAccount } from '../../api/auth';
import { updateProviderPhone } from '../../api/discharge';
import {
  getCheckInNotifSettings,
  saveCheckInNotifSettings,
  CheckInNotifSettings,
} from '../../hooks/useNotifications';


export default function SettingsScreen() {
  const { user, logout } = authStore();
  const { discharge, clear, setDischarge } = dischargeStore();
  const [settings, setSettings] = useState<CheckInNotifSettings>({ enabled: true, hour: 8, minute: 0 });
  const [providerPhone, setProviderPhone] = useState(discharge?.provider_phone ?? '');

  useEffect(() => {
    getCheckInNotifSettings().then(setSettings);
  }, []);

  async function updateSettings(patch: Partial<CheckInNotifSettings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    await saveCheckInNotifSettings(next);
  }

  async function handleProviderPhoneBlur() {
    if (!discharge) return;
    const cleaned = providerPhone.trim() || null;
    try {
      const res = await updateProviderPhone(cleaned);
      setDischarge(res.data);
    } catch {
      Alert.alert('Error', 'Could not save provider phone number.');
    }
  }

  function adjustHour(delta: number) {
    updateSettings({ hour: (settings.hour + delta + 24) % 24 });
  }

  function adjustMinute(delta: number) {
    const next = (settings.minute + delta + 60) % 60;
    updateSettings({ minute: next });
  }

  async function handleLogout() {
    await logout();
    clear();
  }

  async function handleDeleteAccount() {
    Alert.alert(
      'Delete account',
      'This will permanently delete your account and all health data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount();
              await logout();
              clear();
            } catch (err: any) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Email</Text>
          <Text style={styles.rowValue}>{user?.email}</Text>
        </View>
      </View>

      {discharge && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Care team</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Provider phone</Text>
            <TextInput
              style={styles.phoneInput}
              value={providerPhone}
              onChangeText={setProviderPhone}
              onBlur={handleProviderPhoneBlur}
              placeholder="e.g. 555-867-5309"
              placeholderTextColor="#444"
              keyboardType="phone-pad"
              returnKeyType="done"
            />
          </View>
          <Text style={styles.fieldHint}>
            Used for the tap-to-call button when a red flag is triggered.
          </Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Notifications</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Daily check-in reminder</Text>
          <Switch
            value={settings.enabled}
            onValueChange={(val) => updateSettings({ enabled: val })}
            trackColor={{ true: '#4f7eff' }}
            thumbColor="#fff"
          />
        </View>
        {settings.enabled && (
          <View style={[styles.row, { flexDirection: 'column', alignItems: 'flex-start', gap: 10 }]}>
            <Text style={styles.rowLabel}>Reminder time</Text>
            <View style={styles.timePicker}>
              <View style={styles.timeUnit}>
                <TouchableOpacity style={styles.timeBtn} onPress={() => adjustHour(1)}>
                  <Text style={styles.timeBtnText}>▲</Text>
                </TouchableOpacity>
                <Text style={styles.timeValue}>{(settings.hour % 12 || 12).toString().padStart(2, '0')}</Text>
                <TouchableOpacity style={styles.timeBtn} onPress={() => adjustHour(-1)}>
                  <Text style={styles.timeBtnText}>▼</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.timeSep}>:</Text>
              <View style={styles.timeUnit}>
                <TouchableOpacity style={styles.timeBtn} onPress={() => adjustMinute(5)}>
                  <Text style={styles.timeBtnText}>▲</Text>
                </TouchableOpacity>
                <Text style={styles.timeValue}>{settings.minute.toString().padStart(2, '0')}</Text>
                <TouchableOpacity style={styles.timeBtn} onPress={() => adjustMinute(-5)}>
                  <Text style={styles.timeBtnText}>▼</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.timeUnit}>
                <TouchableOpacity style={styles.timeBtn} onPress={() => updateSettings({ hour: (settings.hour + 12) % 24 })}>
                  <Text style={styles.timeBtnText}>▲</Text>
                </TouchableOpacity>
                <Text style={styles.timeValue}>{settings.hour >= 12 ? 'PM' : 'AM'}</Text>
                <TouchableOpacity style={styles.timeBtn} onPress={() => updateSettings({ hour: (settings.hour + 12) % 24 })}>
                  <Text style={styles.timeBtnText}>▼</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Legal</Text>
        <View style={styles.row}>
          <Text style={styles.disclaimer}>
            This app helps you follow instructions from your doctor. It does not provide medical
            advice or diagnosis. Always contact your care team with health concerns.
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount}>
          <Text style={styles.deleteText}>Delete my account & data</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#13131a' },
  header: { padding: 20 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  section: { marginTop: 8, paddingHorizontal: 20 },
  sectionLabel: { color: '#4f7eff', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  rowLabel: { color: '#ccc', fontSize: 15 },
  rowValue: { color: '#555', fontSize: 14 },
  phoneInput: { color: '#fff', fontSize: 14, textAlign: 'right', flex: 1, paddingLeft: 12 },
  fieldHint: { color: '#444', fontSize: 11, lineHeight: 16, paddingBottom: 8 },
  disclaimer: { color: '#555', fontSize: 11, lineHeight: 16 },
  timePicker: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeUnit: { alignItems: 'center', gap: 4 },
  timeSep: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 2, paddingHorizontal: 2 },
  timeBtn: {
    width: 36, height: 28, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  timeBtnText: { color: '#aaa', fontSize: 11, lineHeight: 14 },
  timeValue: { color: '#fff', fontSize: 20, fontWeight: '700', minWidth: 36, textAlign: 'center' },
  actions: { padding: 20, gap: 12, marginTop: 'auto' },
  logoutBtn: {
    padding: 16, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  logoutText: { color: '#ccc', fontSize: 15, fontWeight: '600' },
  deleteBtn: {
    padding: 16, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    alignItems: 'center',
  },
  deleteText: { color: '#ef4444', fontSize: 15, fontWeight: '600' },
});
