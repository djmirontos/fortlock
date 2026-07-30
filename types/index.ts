// FortLock — TypeScript Types

export type CredentialCategory =
  | 'general'
  | 'banking'
  | 'social'
  | 'email';

export type ThemeMode = 'light' | 'dark' | 'system';

// Decrypted credential data (what's encrypted)
export interface CredentialData {
  serviceName: string;
  username?: string;
  password?: string;
  notes?: string;
  cardHolder?: string;
  cardNumber?: string;
  expiryDate?: string;
  cvv?: string;
}

// Encrypted credential (what's stored)
export interface Credential {
  id: string;
  category: CredentialCategory;
  createdAt: number;
  updatedAt: number;
  isFavorite: boolean;
  encryptedData: string;  // AES-256-GCM encrypted JSON (base64)
}

// Decrypted credential for UI use
export interface DecryptedCredential extends Credential {
  data: CredentialData;
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

export interface TotpEntry {
  id: string;
  issuer: string;
  account: string;
  encryptedSecret: string; // AES-256-GCM encrypted TOTP secret
  color: string;
  createdAt: number;
}

export interface TotpEntryDecrypted extends TotpEntry {
  secret: string;
}