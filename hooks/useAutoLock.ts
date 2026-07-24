import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { router } from 'expo-router';

export const useAutoLock = () => {
  const {
    autoLockTimer,
    lastActiveAt,
    updateLastActive,
    clearSecureMemory,
    isAuthenticated,
  } = useAuthStore();

  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    if (!isAuthenticated) return;

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appStateRef.current === 'active' &&
        nextAppState.match(/inactive|background/)
      ) {
        updateLastActive();
      }

      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        if (autoLockTimer > 0) {
          const elapsed = (Date.now() - lastActiveAt) / 1000 / 60;
          if (elapsed >= autoLockTimer) {
            clearSecureMemory();
            router.replace('/');
          }
        }
      }

      appStateRef.current = nextAppState;
    });

    return () => subscription.remove();
  }, [isAuthenticated, autoLockTimer, lastActiveAt]);
};
