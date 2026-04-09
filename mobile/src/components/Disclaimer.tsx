import React from 'react';
import { Text, StyleSheet } from 'react-native';

export default function Disclaimer() {
  return (
    <Text style={styles.text}>
      This app helps you follow instructions from your doctor. It does not provide medical advice or
      diagnosis. Always contact your care team with health concerns.
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 11,
    color: '#555',
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 4,
  },
});
