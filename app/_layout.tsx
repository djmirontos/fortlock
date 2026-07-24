import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { hasMasterPassword } from '../services/cryptoService';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { setLoading, themeMode } = useAuthStore();

  useEffect(() => {
    const init = async () => {
      await hasMasterPassword();
      setLoading(false);
    };
    init();
  }, []);

  const isDark =
    themeMode === 'dark' ||
    (themeMode === 'system' && colorScheme === 'dark');

  return (
    <View style={{ flex: 1, backgroundColor: '#121212' }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#121212' },
        animation: 'fade',
      }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="setup" />
        <Stack.Screen name="dashboard" />
        <Stack.Screen name="add" />
        <Stack.Screen name="detail" />
        <Stack.Screen name="edit" />
        <Stack.Screen name="settings" />
      </Stack>
    </View>
  );
}
