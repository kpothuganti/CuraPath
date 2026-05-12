import React, { useMemo, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Switch, ScrollView, Modal, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authStore } from '../../store/authStore';
import { dischargeStore } from '../../store/dischargeStore';
import { deleteAccount } from '../../api/auth';
import { updateProviderPhone, translateDischarge } from '../../api/discharge';
import {
  getCheckInNotifSettings,
  saveCheckInNotifSettings,
  CheckInNotifSettings,
} from '../../hooks/useNotifications';
import {
  getPreferredLanguage,
  setPreferredLanguage,
  SUPPORTED_LANGUAGES,
  Language,
} from '../../hooks/useLanguage';
import { useTheme } from '../../hooks/useTheme';


export default function SettingsScreen() {
  const { user, logout } = authStore();
  const { discharge, clear, setDischarge } = dischargeStore();
  const [settings, setSettings] = useState<CheckInNotifSettings>({ enabled: true, hour: 8, minute: 0 });
  const [providerPhone, setProviderPhone] = useState(discharge?.provider_phone ?? '');
  const [language, setLanguage] = useState<Language>(SUPPORTED_LANGUAGES[0]);
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [translating, setTranslating] = useState(false);
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  useEffect(() => {
    getCheckInNotifSettings().then(setSettings);
    getPreferredLanguage().then(setLanguage);
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
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
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
              placeholderTextColor={C.placeholderText}
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
            trackColor={{ true: C.accent }}
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
        <Text style={styles.sectionLabel}>Language</Text>
        <TouchableOpacity style={styles.row} onPress={() => setLangModalVisible(true)}>
          <Text style={styles.rowLabel}>Instructions language</Text>
          <View style={styles.langValue}>
            {translating
              ? <ActivityIndicator size="small" color={C.accent} />
              : <Text style={styles.langValueText}>{language.nativeName}</Text>
            }
            <Text style={styles.langChevron}>›</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.fieldHint}>
          Your discharge instructions will be extracted and displayed in this language.
        </Text>
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
      </ScrollView>

      <Modal visible={langModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Language</Text>
              <TouchableOpacity onPress={() => setLangModalVisible(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={SUPPORTED_LANGUAGES}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.langOption, item.code === language.code && styles.langOptionSelected]}
                  onPress={async () => {
                    setLangModalVisible(false);
                    setLanguage(item);
                    await setPreferredLanguage(item);
                    if (discharge) {
                      setTranslating(true);
                      try {
                        const res = await translateDischarge(item.name);
                        setDischarge(res.data);
                      } catch {
                        Alert.alert('Translation failed', 'Could not translate your instructions. Please try again.');
                      } finally {
                        setTranslating(false);
                      }
                    }
                  }}
                >
                  <Text style={styles.langOptionNative}>{item.nativeName}</Text>
                  <Text style={styles.langOptionEnglish}>{item.name}</Text>
                  {item.code === language.code && (
                    <Text style={styles.langCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(C: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    header: { padding: 20 },
    title: { color: C.textPrimary, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
    section: { marginTop: 8, paddingHorizontal: 20 },
    sectionLabel: { color: C.accent, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
    row: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border,
    },
    rowLabel: { color: C.textSecondary, fontSize: 15 },
    rowValue: { color: C.textMuted, fontSize: 14 },
    phoneInput: { color: C.textPrimary, fontSize: 14, textAlign: 'right', flex: 1, paddingLeft: 12 },
    fieldHint: { color: C.textMuted, fontSize: 11, lineHeight: 16, paddingBottom: 8 },
    disclaimer: { color: C.textMuted, fontSize: 11, lineHeight: 16 },
    timePicker: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    timeUnit: { alignItems: 'center', gap: 4 },
    timeSep: { color: C.textPrimary, fontSize: 22, fontWeight: '700', marginBottom: 2, paddingHorizontal: 2 },
    timeBtn: {
      width: 36, height: 28, borderRadius: 8,
      backgroundColor: C.surfaceStrong,
      alignItems: 'center', justifyContent: 'center',
    },
    timeBtnText: { color: C.textTertiary, fontSize: 11, lineHeight: 14 },
    timeValue: { color: C.textPrimary, fontSize: 20, fontWeight: '700', minWidth: 36, textAlign: 'center' },
    scroll: { paddingBottom: 40 },
    actions: { padding: 20, gap: 12, marginTop: 24 },
    logoutBtn: {
      padding: 16, borderRadius: 16,
      backgroundColor: C.surfaceStrong,
      borderWidth: 1, borderColor: C.borderMed,
      alignItems: 'center',
    },
    logoutText: { color: C.textSecondary, fontSize: 15, fontWeight: '600' },
    deleteBtn: {
      padding: 16, borderRadius: 16,
      borderWidth: 1, borderColor: C.dangerBorder,
      alignItems: 'center',
    },
    deleteText: { color: C.danger, fontSize: 15, fontWeight: '600' },
    langValue: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    langValueText: { color: C.accent, fontSize: 14, fontWeight: '600' },
    langChevron: { color: C.textMuted, fontSize: 16 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalSheet: {
      backgroundColor: C.bgSheet, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      maxHeight: '70%', paddingBottom: 40,
    },
    modalHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      padding: 20, borderBottomWidth: 1, borderBottomColor: C.border,
    },
    modalTitle: { color: C.textPrimary, fontSize: 17, fontWeight: '700' },
    modalClose: { color: C.textMuted, fontSize: 18, paddingHorizontal: 4 },
    langOption: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 20, paddingVertical: 14,
      borderBottomWidth: 1, borderBottomColor: C.border,
    },
    langOptionSelected: { backgroundColor: C.surfaceAccent },
    langOptionNative: { color: C.textPrimary, fontSize: 15, fontWeight: '600', flex: 1 },
    langOptionEnglish: { color: C.textMuted, fontSize: 13 },
    langCheck: { color: C.accent, fontSize: 16, fontWeight: '700' },
  });
}
