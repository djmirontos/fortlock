const QuickCrypto = require('react-native-quick-crypto');
const { Buffer } = require('buffer');
import * as SecureStore from 'expo-secure-store';
import * as ExpoRandom from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CredentialData } from '../types';

const MASTER_HASH_KEY = 'fortlock_master_hash';
const SALT_KEY = 'fortlock_salt';
const PBKDF2_ITERATIONS = 310000;  // OWASP 2023 recommendation
const KEY_LENGTH = 32;  // 256 bits
const IV_LENGTH = 12;   // 96 bits for GCM
const AUTH_TAG_LENGTH = 16;  // 128 bits

// Derive master key from password using PBKDF2
export const deriveMasterKey = async (
  password: string,
  salt: any
): Promise<any> => {
  return new Promise((resolve, reject) => {
    QuickCrypto.pbkdf2(
      password,
      salt,
      PBKDF2_ITERATIONS,
      KEY_LENGTH,
      'sha256',
      (err: any, key: any) => {
        if (err) reject(err);
        else resolve(key);
      }
    );
  });
};

// Encrypt a string using AES-256-GCM
export const encryptField = (
  plaintext: string,
  masterKey: any
): string => {
  const iv = QuickCrypto.randomBytes(IV_LENGTH);
  const cipher = QuickCrypto.createCipheriv('aes-256-gcm', masterKey, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();

  // Combine IV + AuthTag + Ciphertext as base64
  const { Buffer: BufferClass } = require('buffer');
  const combined = BufferClass.concat([
    iv,
    authTag,
    BufferClass.from(encrypted, 'base64'),
  ]);

  return combined.toString('base64');
};

// Decrypt a string using AES-256-GCM
export const decryptField = (
  encryptedBase64: string,
  masterKey: any
): string => {
  const { Buffer: BufferClass } = require('buffer');
  const combined = BufferClass.from(encryptedBase64, 'base64');

  const iv = combined.slice(0, IV_LENGTH);
  const authTag = combined.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = QuickCrypto.createDecipheriv('aes-256-gcm', masterKey, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, undefined, 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
};

// Encrypt entire credential data object
export const encryptCredentialData = (
  data: CredentialData,
  masterKey: any
): string => {
  const jsonString = JSON.stringify(data);
  return encryptField(jsonString, masterKey);
};

// Decrypt entire credential data object
export const decryptCredentialData = (
  encryptedData: string,
  masterKey: any
): CredentialData => {
  const jsonString = decryptField(encryptedData, masterKey);
  return JSON.parse(jsonString) as CredentialData;
};

// Setup master password (first time)
export const setupMasterPassword = async (
  password: string
): Promise<any> => {
  // Generate random salt
  const saltBytes = await ExpoRandom.getRandomBytesAsync(32);
  const { Buffer: BufferClass } = require('buffer');
  const salt = BufferClass.from(saltBytes);

  // Derive master key
  const masterKey = await deriveMasterKey(password, salt);

  // Create verification hash (hash of master key, not password)
  const verificationHash = QuickCrypto
    .createHash('sha256')
    .update(masterKey)
    .digest('base64');

  // Store salt and verification hash in secure storage
  await SecureStore.setItemAsync(SALT_KEY, salt.toString('base64'));
  await SecureStore.setItemAsync(MASTER_HASH_KEY, verificationHash);

  return masterKey;
};

// Verify master password and return master key if correct
export const verifyAndGetMasterKey = async (
  password: string
): Promise<any | null> => {
  try {
    const saltBase64 = await SecureStore.getItemAsync(SALT_KEY);
    const storedHash = await SecureStore.getItemAsync(MASTER_HASH_KEY);

    if (!saltBase64 || !storedHash) return null;

    const { Buffer: BufferClass } = require('buffer');
    const salt = BufferClass.from(saltBase64, 'base64');
    const masterKey = await deriveMasterKey(password, salt);

    const verificationHash = QuickCrypto
      .createHash('sha256')
      .update(masterKey)
      .digest('base64');

    if (verificationHash !== storedHash) return null;

    return masterKey;
  } catch {
    return null;
  }
};

// Check if master password exists
export const hasMasterPassword = async (): Promise<boolean> => {
  try {
    const hash = await SecureStore.getItemAsync(MASTER_HASH_KEY);
    return hash !== null;
  } catch {
    return false;
  }
};

// Change master password - re-encrypt all credentials
export const changeMasterPassword = async (
  currentPassword: string,
  newPassword: string,
  credentials: any[],
  onProgress?: (current: number, total: number) => void
): Promise<{ success: boolean; newMasterKey: any | null }> => {
  // Verify current password
  const currentKey = await verifyAndGetMasterKey(currentPassword);
  if (!currentKey) return { success: false, newMasterKey: null };

  // Generate new master key
  const newKey = await setupMasterPassword(newPassword);

  // Re-encrypt all credentials with new key
  const reEncrypted: any[] = [];
  for (let index = 0; index < credentials.length; index++) {
    const cred = credentials[index];
    const data = decryptCredentialData(cred.encryptedData, currentKey);
    const newEncryptedData = encryptCredentialData(data, newKey);
    reEncrypted.push({ ...cred, encryptedData: newEncryptedData });
    onProgress?.(index + 1, credentials.length);
    // Yield to JS thread every 5 credentials so UI can update
    if (index % 5 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  // Save re-encrypted credentials
  await AsyncStorage.setItem(
    'fortlock_credentials',
    JSON.stringify(reEncrypted)
  );

  return { success: true, newMasterKey: newKey };
};

// Clear all secure data
export const clearAllSecureData = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(MASTER_HASH_KEY);
  await SecureStore.deleteItemAsync(SALT_KEY);
};