import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { useUITranslations } from '../hooks/useUITranslations';

export default function Disclaimer() {
  const C = useTheme();
  const { t } = useUITranslations();
  return (
    <Text style={[styles.text, { color: C.textMuted }]}>
      {t('disclaimer')}
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
