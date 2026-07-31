import { useColorScheme } from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { LightTheme, DarkTheme, Theme } from '../constants/theme';

export const useTheme = (): Theme => {
  const systemScheme = useColorScheme();
  const themeMode = useAuthStore((state) => state.themeMode);

  // Derived once here so screens never have to infer dark mode by comparing
  // hex strings (which silently breaks if a palette colour changes).
  const isDark =
    themeMode === 'dark' || (themeMode === 'system' && systemScheme === 'dark');

  return { ...(isDark ? DarkTheme : LightTheme), isDark };
};
