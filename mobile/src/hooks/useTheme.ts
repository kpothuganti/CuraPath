import { useColorScheme } from 'react-native';
import { dark, light } from '../theme';
import { themeStore } from '../store/themeStore';

export function useTheme() {
  const preference = themeStore((s) => s.preference);
  const system = useColorScheme();

  if (preference === 'light') return light;
  if (preference === 'dark') return dark;
  return system === 'light' ? light : dark;
}
