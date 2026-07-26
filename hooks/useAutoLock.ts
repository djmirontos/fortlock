import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { router } from 'expo-router';

export const useAutoLock = () => {
  const autoLockTimer = useAuthStore((state) => state.autoLockTimer);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const updateLastActive = useAuthStore((state) => state.updateLastActive);
  const clearSecureMemory = useAuthStore((state) => state.clearSecureMemory);

  const appStateRef = useRef(AppState.currentState);
  const lastActiveRef = useRef(Date.now());
  const autoLockTimerRef = useRef(autoLockTimer);

  // Keep refs in sync with latest values — no stale closures
  useEffect(() => {
    autoLockTimerRef.current = autoLockTimer;
  }, [autoLockTimer]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appStateRef.current === 'active' &&
        nextAppState.match(/inactive|background/)
      ) {
        lastActiveRef.current = Date.now();
        updateLastActive();
      }

      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        if (autoLockTimerRef.current > 0) {
          const elapsed = (Date.now() - lastActiveRef.current) / 1000 / 60;
          if (elapsed >= autoLockTimerRef.current) {
            clearSecureMemory();
            router.replace('/');
          }
        }
      }

      appStateRef.current = nextAppState;
    });

    return () => subscription.remove();
  }, [isAuthenticated]);
};
