import { create } from 'zustand';
import { AuthState, ThemeMode } from '../types';

interface AuthStore extends AuthState {
  // Actions
  setAuthenticated: (value: boolean) => void;
  setLoading: (value: boolean) => void;
  setBiometricAvailable: (value: boolean) => void;
  setThemeMode: (mode: ThemeMode) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  // Initial state
  isAuthenticated: false,
  isLoading: true,
  biometricAvailable: false,
  themeMode: 'light',

  // Actions
  setAuthenticated: (value) => 
    set({ isAuthenticated: value }),
  
  setLoading: (value) => 
    set({ isLoading: value }),
  
  setBiometricAvailable: (value) => 
    set({ biometricAvailable: value }),
  
  setThemeMode: (mode) => 
    set({ themeMode: mode }),
  
  logout: () => 
    set({ isAuthenticated: false }),
}));
