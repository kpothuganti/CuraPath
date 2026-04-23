import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Upload'>;

export default function UploadScreen({ navigation }: Props) {
  async function handleCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required to scan your documents.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      navigation.replace('Processing', {
        type: 'photo',
        base64: result.assets[0].base64,
      });
    }
  }

  async function handlePDF() {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;

    const uri = result.assets[0].uri;
    const fileInfo = await FileSystem.getInfoAsync(uri);

    // Warn if file is over 20MB — Claude vision has limits
    if (fileInfo.exists && 'size' in fileInfo && fileInfo.size > 20 * 1024 * 1024) {
      Alert.alert('File too large', 'Please use a PDF under 20MB.');
      return;
    }

    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    navigation.replace('Processing', { type: 'pdf', base64 });
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Upload your instructions</Text>
      </View>

      <View style={styles.body}>
        <TouchableOpacity style={[styles.card, styles.cardPrimary]} onPress={handleCamera}>
          <View style={styles.icon}><Text style={styles.iconText}>📷</Text></View>
          <Text style={styles.cardTitle}>Take a photo</Text>
          <Text style={styles.cardSub}>
            Point your camera at the discharge papers. We'll scan and read them for you.
          </Text>
        </TouchableOpacity>

        <Text style={styles.or}>— or —</Text>

        <TouchableOpacity style={styles.card} onPress={handlePDF}>
          <View style={styles.icon}><Text style={styles.iconText}>📄</Text></View>
          <Text style={styles.cardTitle}>Upload a PDF</Text>
          <Text style={styles.cardSub}>
            Got a digital copy from the hospital portal? Upload it directly.
          </Text>
        </TouchableOpacity>

        <View style={styles.tip}>
          <Text style={styles.tipText}>
            💡 Make sure the text is clear and well-lit. Multiple pages? You can add more photos
            after the first one.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a22' },
  header: { padding: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { color: '#fff', fontSize: 20, width: 36, textAlign: 'center' },
  title: { color: '#fff', fontSize: 17, fontWeight: '700' },
  body: { flex: 1, padding: 20, gap: 16 },
  card: {
    flex: 1, borderRadius: 20, borderWidth: 2, borderStyle: 'dashed',
    borderColor: '#333', alignItems: 'center', justifyContent: 'center',
    padding: 24, gap: 10, backgroundColor: 'rgba(255,255,255,0.02)',
  },
  cardPrimary: { flex: 1.2 },
  icon: {
    width: 60, height: 60, borderRadius: 18,
    backgroundColor: 'rgba(79,126,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  iconText: { fontSize: 28 },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cardSub: { color: '#666', fontSize: 13, textAlign: 'center' },
  or: { color: '#444', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  tip: {
    backgroundColor: 'rgba(79,126,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(79,126,255,0.2)',
    borderRadius: 12, padding: 14,
  },
  tipText: { color: '#8a9fd4', fontSize: 12, lineHeight: 18 },
});
