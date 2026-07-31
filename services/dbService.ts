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
import { CATEGORY_TO_TAG_ID } from './tagService';
import { CREDENTIALS_KEY, TOTP_KEY } from '../constants/storageKeys';

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

  const defaultTag = CATEGORY_TO_TAG_ID[category] || 'tag_general';
  const newCredential: Credential = {
    id,
    category,
    tags: [defaultTag],
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

// Clear all credentials AND TOTP entries.
// TOTP entries are encrypted with the same master key, so leaving them behind
// both retains 2FA seeds the user asked to erase and guarantees they are
// undecryptable garbage once a new master password is set.
export const clearAllCredentials = async (): Promise<void> => {
  await AsyncStorage.multiRemove([CREDENTIALS_KEY, TOTP_KEY]);
};

// Toggle favorite status
export const toggleFavorite = async (id: string): Promise<void> => {
  const all = await getRawCredentials();
  const updated = all.map((c) =>
    c.id === id ? { ...c, isFavorite: !c.isFavorite } : c
  );
  await AsyncStorage.setItem(CREDENTIALS_KEY, JSON.stringify(updated));
};

// Replace the tag set on a single credential
export const updateCredentialTags = async (
  id: string,
  tags: string[]
): Promise<void> => {
  const all = await getRawCredentials();
  const updated = all.map((c) =>
    c.id === id ? { ...c, tags, updatedAt: Date.now() } : c
  );
  await AsyncStorage.setItem(CREDENTIALS_KEY, JSON.stringify(updated));
};

// Backfill `tags` on credentials saved before tags existed, deriving the
// initial tag from the legacy category. Idempotent — no write if nothing needs it.
export const migrateCredentialTags = async (): Promise<void> => {
  try {
    const all = await getRawCredentials();
    const needsMigration = all.some((c) => !c.tags || !Array.isArray(c.tags));
    if (!needsMigration) return;
    const migrated = all.map((c) => ({
      ...c,
      tags: c.tags && Array.isArray(c.tags)
        ? c.tags
        : [CATEGORY_TO_TAG_ID[c.category] || 'tag_general'],
    }));
    await AsyncStorage.setItem(CREDENTIALS_KEY, JSON.stringify(migrated));
  } catch {
    // silent — migration is best-effort
  }
};