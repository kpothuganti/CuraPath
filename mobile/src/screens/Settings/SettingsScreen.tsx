import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, Alert, Switch,
} from 'react-native';
import { authStore } from '../../store/authStore';
import { dischargeStore } from '../../store/dischargeStore';
import { deleteAccount } from '../../api/auth';

export default function SettingsScreen() {
  const { user, logout } = authStore();
  const { clear } = dischargeStore();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

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

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Notifications</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Daily check-in reminder</Text>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ true: '#4f7eff' }}
            thumbColor="#fff"
          />
        </View>
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
  disclaimer: { color: '#555', fontSize: 11, lineHeight: 16 },
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
