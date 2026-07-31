import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthState, ThemeMode, DecryptedCredential } from '../types';
import { THEME_KEY, AUTO_LOCK_KEY } from '../constants/storageKeys';

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
  loadPersistedSettings: () => Promise<void>;
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

  setThemeMode: (mode) => {
    AsyncStorage.setItem(THEME_KEY, mode).catch(() => {});
    set({ themeMode: mode });
  },

  setMasterKey: (key) =>
    set({ masterKey: key }),

  setDecryptedCredentials: (creds) =>
    set({ decryptedCredentials: creds }),

  setAutoLockTimer: (minutes) => {
    AsyncStorage.setItem(AUTO_LOCK_KEY, String(minutes)).catch(() => {});
    set({ autoLockTimer: minutes });
  },

  loadPersistedSettings: async () => {
    try {
      const [theme, timer] = await Promise.all([
        AsyncStorage.getItem(THEME_KEY),
        AsyncStorage.getItem(AUTO_LOCK_KEY),
      ]);
      const updates: Partial<AuthStore> = {};
      if (theme === 'light' || theme === 'dark' || theme === 'system') {
        updates.themeMode = theme;
      }
      if (timer !== null && !isNaN(Number(timer))) {
        updates.autoLockTimer = Number(timer);
      }
      if (Object.keys(updates).length > 0) set(updates);
    } catch {}
  },

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
