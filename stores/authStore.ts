import { create } from 'zustand';
import { AuthState, ThemeMode, DecryptedCredential } from '../types';

interface AuthStore extends AuthState {
  // Security state (in-memory only, never persisted)
  masterKey: any;
  decryptedCredentials: DecryptedCredential[];
  autoLockTimer: number;
  lastActiveAt: number;

  // Actions
  setAuthenticated: (value: boolean) => void;
  setLoading: (value: boolean) => void;
  setBiometricAvailable: (value: boolean) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setMasterKey: (key: any) => void;
  setDecryptedCredentials: (creds: DecryptedCredential[]) => void;
  setAutoLockTimer: (minutes: number) => void;
  updateLastActive: () => void;
  clearSecureMemory: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  // Initial state
  isAuthenticated: false,
  isLoading: true,
  biometricAvailable: false,
  themeMode: 'light',
  masterKey: null,
  decryptedCredentials: [],
  autoLockTimer: 1,
  lastActiveAt: Date.now(),

  // Actions
  setAuthenticated: (value) =>
    set({ isAuthenticated: value }),

  setLoading: (value) =>
    set({ isLoading: value }),

  setBiometricAvailable: (value) =>
    set({ biometricAvailable: value }),

  setThemeMode: (mode) =>
    set({ themeMode: mode }),

  setMasterKey: (key) =>
    set({ masterKey: key }),

  setDecryptedCredentials: (creds) =>
    set({ decryptedCredentials: creds }),

  setAutoLockTimer: (minutes) =>
    set({ autoLockTimer: minutes }),

  updateLastActive: () =>
    set({ lastActiveAt: Date.now() }),

  clearSecureMemory: () =>
    set({
      masterKey: null,
      decryptedCredentials: [],
      isAuthenticated: false,
    }),

  logout: () =>
    set({
      isAuthenticated: false,
      masterKey: null,
      decryptedCredentials: [],
    }),
}));
