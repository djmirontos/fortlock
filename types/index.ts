// FortLock — TypeScript Types

export type CredentialCategory = 
  | 'general' 
  | 'banking' 
  | 'social' 
  | 'email';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface Credential {
  id: string;
  category: CredentialCategory;
  serviceName: string;
  username?: string;
  password?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  isFavorite?: boolean;
  // Banking specific
  cardHolder?: string;
  cardNumber?: string;
  expiryDate?: string;
  cvv?: string;
}

export interface AppSettings {
  themeMode: ThemeMode;
  biometricEnabled: boolean;
  autoLockTimer: number; // in minutes
  isFirstTime: boolean;
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  biometricAvailable: boolean;
  themeMode: ThemeMode;
}