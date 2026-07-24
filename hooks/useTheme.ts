import { useColorScheme } from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { LightTheme, DarkTheme, Theme } from '../constants/theme';

export const useTheme = (): Theme => {
  const systemScheme = useColorScheme();
  const themeMode = useAuthStore((state) => state.themeMode);

  // User explicitly chose light
  if (themeMode === 'light') return LightTheme;
  
  // User explicitly chose dark
  if (themeMode === 'dark') return DarkTheme;

  // System mode - follow system preference
  if (themeMode === 'system') {
    return systemScheme === 'dark' ? DarkTheme : LightTheme;
  }

  // Default is ALWAYS light until user changes it in settings
  return LightTheme;
};
