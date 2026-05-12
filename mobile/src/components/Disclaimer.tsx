import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useTheme } from '../hooks/useTheme';

export default function Disclaimer() {
  const C = useTheme();
  return (
    <Text style={[styles.text, { color: C.textMuted }]}>
      ReCharge helps you track instructions from your healthcare provider. It does not provide
      medical advice, diagnosis, or treatment recommendations. AI-extracted content may contain
      errors — always refer to your original discharge paperwork and contact your care team with
      any health concerns. In an emergency, call 911.
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 4,
  },
});
