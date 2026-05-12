import { useColorScheme } from 'react-native';
import { dark, light } from '../theme';

export function useTheme() {
  const scheme = useColorScheme();
  return scheme === 'light' ? light : dark;
}
