// FortLock Theme — Light & Dark
export const LightTheme = {
  background: '#F2F2F7',
  surface: '#FFFFFF',
  surfaceSecondary: '#E5E5EA',
  textPrimary: '#1C1C1E',
  textSecondary: '#8E8E93',
  primary: '#4F6FFF',
  danger: '#FF3B30',
  success: '#4CD964',
  stroke: '#D1D1D6',
  tabBar: '#FFFFFF',
  header: '#FFFFFF',
  cardIcon: '#F2F2F7',
  toggleTrack: '#E5E5EA',
};

export const DarkTheme = {
  background: '#1C1C1E',
  surface: '#2C2C2E',
  surfaceSecondary: '#3A3A3C',
  textPrimary: '#FFFFFF',
  textSecondary: '#8E8E93',
  primary: '#4F6FFF',
  danger: '#FF3B30',
  success: '#4CD964',
  stroke: '#3A3A3C',
  tabBar: '#1C1C1E',
  header: '#2C2C2E',
  cardIcon: '#3A3A3C',
  toggleTrack: '#3A3A3C',
};

// `isDark` is supplied by useTheme() rather than living on the palettes
// themselves, so screens can branch on it directly.
export type Theme = typeof LightTheme & { isDark: boolean };

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
};

export const FontSize = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 17,
  xxl: 20,
  xxxl: 32,
};

export const CardColors = {
  facebook: '#1877F2',
  google: '#EA4335',
  netflix: '#E50914',
  banking: '#1A1F71',
  default: '#4F6FFF',
};