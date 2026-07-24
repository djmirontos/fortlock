import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ExpoRandom from 'expo-crypto';
import {
  encryptCredentialData,
  decryptCredentialData,
} from './cryptoService';
import {
  Credential,
  CredentialData,
  DecryptedCredential,
  CredentialCategory,
} from '../types';

const CREDENTIALS_KEY = 'fortlock_credentials';

// Generate unique ID
const generateId = async (): Promise<string> => {
  const random = await ExpoRandom.getRandomBytesAsync(8);
  return Array.from(new Uint8Array(random))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

// Get raw encrypted credentials from storage
export const getRawCredentials = async (): Promise<Credential[]> => {
  try {
    const data = await AsyncStorage.getItem(CREDENTIALS_KEY);
    if (!data) return [];
    return JSON.parse(data) as Credential[];
  } catch {
    return [];
  }
};

// Get all credentials decrypted (requires masterKey)
export const getDecryptedCredentials = async (
  masterKey: any
): Promise<DecryptedCredential[]> => {
  const raw = await getRawCredentials();
  return raw.map((cred) => ({
    ...cred,
    data: decryptCredentialData(cred.encryptedData, masterKey),
  }));
};

// Get credentials by category (decrypted)
export const getDecryptedCredentialsByCategory = async (
  category: CredentialCategory,
  masterKey: any
): Promise<DecryptedCredential[]> => {
  const all = await getDecryptedCredentials(masterKey);
  return all.filter((c) => c.category === category);
};

// Add new credential (encrypts before storing)
export const addCredential = async (
  data: CredentialData,
  category: CredentialCategory,
  masterKey: any
): Promise<DecryptedCredential> => {
  const all = await getRawCredentials();
  const id = await generateId();
  const now = Date.now();

  const newCredential: Credential = {
    id,
    category,
    createdAt: now,
    updatedAt: now,
    isFavorite: false,
    encryptedData: encryptCredentialData(data, masterKey),
  };

  await AsyncStorage.setItem(
    CREDENTIALS_KEY,
    JSON.stringify([...all, newCredential])
  );

  return { ...newCredential, data };
};

// Update credential (re-encrypts)
export const updateCredential = async (
  id: string,
  data: CredentialData,
  masterKey: any
): Promise<void> => {
  const all = await getRawCredentials();
  const updated = all.map((c) =>
    c.id === id
      ? {
          ...c,
          updatedAt: Date.now(),
          encryptedData: encryptCredentialData(data, masterKey),
        }
      : c
  );
  await AsyncStorage.setItem(CREDENTIALS_KEY, JSON.stringify(updated));
};

// Delete credential
export const deleteCredential = async (id: string): Promise<void> => {
  const all = await getRawCredentials();
  const filtered = all.filter((c) => c.id !== id);
  await AsyncStorage.setItem(CREDENTIALS_KEY, JSON.stringify(filtered));
};

// Search credentials (searches decrypted data in memory)
export const searchDecryptedCredentials = (
  credentials: DecryptedCredential[],
  query: string
): DecryptedCredential[] => {
  const lower = query.toLowerCase();
  return credentials.filter(
    (c) =>
      c.data.serviceName?.toLowerCase().includes(lower) ||
      c.data.username?.toLowerCase().includes(lower) ||
      c.data.notes?.toLowerCase().includes(lower)
  );
};

// Clear all credentials
export const clearAllCredentials = async (): Promise<void> => {
  await AsyncStorage.removeItem(CREDENTIALS_KEY);
};

// Toggle favorite status
export const toggleFavorite = async (id: string): Promise<void> => {
  const all = await getRawCredentials();
  const updated = all.map((c) =>
    c.id === id ? { ...c, isFavorite: !c.isFavorite } : c
  );
  await AsyncStorage.setItem(CREDENTIALS_KEY, JSON.stringify(updated));
};