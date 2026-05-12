import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useTheme } from '../../hooks/useTheme';

type Props = NativeStackScreenProps<RootStackParamList, 'Upload'>;

export default function UploadScreen({ navigation }: Props) {
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

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

  async function handleLibrary() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Photo library access is required to choose a photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
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
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      const uri = result.assets[0].uri;

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      navigation.replace('Processing', { type: 'pdf', base64 });
    } catch (err: any) {
      console.error('PDF upload error:', err);
      Alert.alert('Could not read PDF', err.message ?? 'Please try again.');
    }
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
        <View style={styles.photoRow}>
          <TouchableOpacity style={[styles.card, styles.cardPhoto]} onPress={handleCamera}>
            <View style={styles.icon}><Text style={styles.iconText}>📷</Text></View>
            <Text style={styles.cardTitle}>Take a photo</Text>
            <Text style={styles.cardSub}>Point your camera at the discharge papers</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.card, styles.cardPhoto]} onPress={handleLibrary}>
            <View style={styles.icon}><Text style={styles.iconText}>🖼️</Text></View>
            <Text style={styles.cardTitle}>From library</Text>
            <Text style={styles.cardSub}>Choose an existing photo</Text>
          </TouchableOpacity>
        </View>

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

function makeStyles(C: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bgAlt },
    header: { padding: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
    back: { color: C.textPrimary, fontSize: 20, width: 36, textAlign: 'center' },
    title: { color: C.textPrimary, fontSize: 17, fontWeight: '700' },
    body: { flex: 1, padding: 20, gap: 16 },
    photoRow: { flexDirection: 'row', gap: 12, flex: 1.2 },
    card: {
      flex: 1, borderRadius: 20, borderWidth: 2, borderStyle: 'dashed',
      borderColor: C.borderMed, alignItems: 'center', justifyContent: 'center',
      padding: 20, gap: 8, backgroundColor: C.surface,
    },
    cardPhoto: { flex: 1 },
    icon: {
      width: 52, height: 52, borderRadius: 16,
      backgroundColor: C.accentSurface,
      alignItems: 'center', justifyContent: 'center',
    },
    iconText: { fontSize: 24 },
    cardTitle: { color: C.textPrimary, fontSize: 14, fontWeight: '700', textAlign: 'center' },
    cardSub: { color: C.textTertiary, fontSize: 12, textAlign: 'center' },
    or: { color: C.textMuted, fontSize: 13, fontWeight: '600', textAlign: 'center' },
    tip: {
      backgroundColor: C.surfaceAccent,
      borderWidth: 1, borderColor: C.borderAccent,
      borderRadius: 12, padding: 14,
    },
    tipText: { color: C.accentSubtext, fontSize: 12, lineHeight: 18 },
  });
}
