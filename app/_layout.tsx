import "expo-dev-client";
import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { hasMasterPassword } from '../services/cryptoService';
import ErrorBoundary from '../components/ErrorBoundary';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { setLoading, themeMode, loadPersistedSettings } = useAuthStore();

  useEffect(() => {
    const init = async () => {
      await Promise.all([
        hasMasterPassword(),
        loadPersistedSettings(),
      ]);
      setLoading(false);
    };
    init();
  }, []);

  const isDark =
    themeMode === 'dark' ||
    (themeMode === 'system' && colorScheme === 'dark');

  return (
    <ErrorBoundary>
      <View style={{ flex: 1, backgroundColor: '#121212' }}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Stack screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' },
          animation: 'slide_from_right',
          animationDuration: 300,
          gestureEnabled: true,
          gestureDirection: 'horizontal',
        }}>
          <Stack.Screen name="index" options={{ animation: 'fade' }} />
          <Stack.Screen name="setup" options={{ animation: 'fade' }} />
          <Stack.Screen name="dashboard" options={{ animation: 'none' }} />
          <Stack.Screen name="authenticator" options={{ animation: 'none' }} />
          <Stack.Screen name="add-totp" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="add" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="detail" options={{ animation: 'ios_from_right' }} />
          <Stack.Screen name="edit" options={{ animation: 'ios_from_right' }} />
          <Stack.Screen name="settings" options={{ animation: 'ios_from_right' }} />
        </Stack>
      </View>
    </ErrorBoundary>
  );
}
