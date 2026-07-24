import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { Credential, CredentialCategory } from '../types';

const CREDENTIALS_KEY = 'fortlock_credentials';

// Generate unique ID
const generateId = async (): Promise<string> => {
  const random = await Crypto.getRandomBytesAsync(8);
  return Array.from(random)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

// Get all credentials
export const getCredentials = async (): Promise<Credential[]> => {
  try {
    const data = await AsyncStorage.getItem(CREDENTIALS_KEY);
    if (!data) return [];
    return JSON.parse(data) as Credential[];
  } catch {
    return [];
  }
};

// Get credentials by category
export const getCredentialsByCategory = async (
  category: CredentialCategory
): Promise<Credential[]> => {
  const all = await getCredentials();
  return all.filter((c) => c.category === category);
};

// Add new credential
export const addCredential = async (
  credential: Omit<Credential, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Credential> => {
  const all = await getCredentials();
  const newCredential: Credential = {
    ...credential,
    id: await generateId(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await AsyncStorage.setItem(
    CREDENTIALS_KEY,
    JSON.stringify([...all, newCredential])
  );
  return newCredential;
};

// Update credential
export const updateCredential = async (
  id: string,
  updates: Partial<Credential>
): Promise<void> => {
  const all = await getCredentials();
  const updated = all.map((c) =>
    c.id === id
      ? { ...c, ...updates, updatedAt: Date.now() }
      : c
  );
  await AsyncStorage.setItem(CREDENTIALS_KEY, JSON.stringify(updated));
};

// Delete credential
export const deleteCredential = async (id: string): Promise<void> => {
  const all = await getCredentials();
  const filtered = all.filter((c) => c.id !== id);
  await AsyncStorage.setItem(CREDENTIALS_KEY, JSON.stringify(filtered));
};

// Search credentials
export const searchCredentials = async (
  query: string
): Promise<Credential[]> => {
  const all = await getCredentials();
  const lower = query.toLowerCase();
  return all.filter(
    (c) =>
      c.serviceName.toLowerCase().includes(lower) ||
      c.username?.toLowerCase().includes(lower) ||
      c.notes?.toLowerCase().includes(lower)
  );
};

// Clear all credentials
export const clearAllCredentials = async (): Promise<void> => {
  await AsyncStorage.removeItem(CREDENTIALS_KEY);
};

// Toggle favorite status
export const toggleFavorite = async (id: string): Promise<void> => {
  const all = await getCredentials();
  const updated = all.map((c) =>
    c.id === id ? { ...c, isFavorite: !c.isFavorite } : c
  );
  await AsyncStorage.setItem(CREDENTIALS_KEY, JSON.stringify(updated));
};