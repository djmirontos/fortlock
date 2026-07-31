const QuickCrypto = require('react-native-quick-crypto');
const { Buffer } = require('buffer');
import * as SecureStore from 'expo-secure-store';
import * as ExpoRandom from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CredentialData } from '../types';
import {
  CREDENTIALS_KEY,
  TOTP_KEY,
  MASTER_HASH_KEY,
  SALT_KEY,
  BIOMETRIC_KEY,
  BIOMETRIC_ENABLED_KEY,
} from '../constants/storageKeys';

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
  const combined = Buffer.concat([
    iv,
    authTag,
    Buffer.from(encrypted, 'base64'),
  ]);

  return combined.toString('base64');
};

// Decrypt a string using AES-256-GCM
export const decryptField = (
  encryptedBase64: string,
  masterKey: any
): string => {
  const combined = Buffer.from(encryptedBase64, 'base64');

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
  const salt = Buffer.from(saltBytes);

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

    const salt = Buffer.from(saltBase64, 'base64');
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

// Change master password — re-encrypts BOTH credentials and TOTP entries.
//
// Ordering is critical for crash safety: nothing that the old password can no
// longer read is committed until every re-encryption has succeeded. The new
// salt/hash are written LAST, so if any earlier step fails the old password
// still opens the vault. If a late step fails, the catch block restores all
// four values from the pre-change snapshot.
export const changeMasterPassword = async (
  currentPassword: string,
  newPassword: string,
  credentials: any[],
  onProgress?: (current: number, total: number) => void
): Promise<{ success: boolean; newMasterKey: any | null }> => {
  // Verify current password
  const currentKey = await verifyAndGetMasterKey(currentPassword);
  if (!currentKey) return { success: false, newMasterKey: null };


  // Snapshot everything we are about to touch, for rollback
  const prevSalt = await SecureStore.getItemAsync(SALT_KEY);
  const prevHash = await SecureStore.getItemAsync(MASTER_HASH_KEY);
  const prevCredentialsJson = await AsyncStorage.getItem(CREDENTIALS_KEY);
  const prevTotpJson = await AsyncStorage.getItem(TOTP_KEY);

  try {
    // 1. Derive the new key WITHOUT persisting salt/hash yet
    const saltBytes = await ExpoRandom.getRandomBytesAsync(32);
    const newSalt = Buffer.from(saltBytes);
    const newKey = await deriveMasterKey(newPassword, newSalt);
    const newHash = QuickCrypto
      .createHash('sha256')
      .update(newKey)
      .digest('base64');

    // Load TOTP entries so they are migrated alongside the credentials.
    // Without this, every 2FA secret becomes permanently undecryptable.
    let rawTotp: any[] = [];
    if (prevTotpJson) {
      try {
        const parsed = JSON.parse(prevTotpJson);
        if (Array.isArray(parsed)) rawTotp = parsed;
      } catch {
        rawTotp = [];
      }
    }

    const total = credentials.length + rawTotp.length;
    let done = 0;

    const yieldToUi = async () => {
      done++;
      onProgress?.(done, total);
      // Yield periodically so the progress bar can actually paint
      if (done % 5 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    };

    // 2a. Re-encrypt credentials into memory
    const reEncryptedCredentials: any[] = [];
    for (const cred of credentials) {
      const data = decryptCredentialData(cred.encryptedData, currentKey);
      reEncryptedCredentials.push({
        ...cred,
        encryptedData: encryptCredentialData(data, newKey),
      });
      await yieldToUi();
    }

    // 2b. Re-encrypt TOTP entries into memory
    const reEncryptedTotp: any[] = [];
    for (const entry of rawTotp) {
      const secret = decryptField(entry.encryptedSecret, currentKey);
      reEncryptedTotp.push({
        ...entry,
        encryptedSecret: encryptField(secret, newKey),
      });
      await yieldToUi();
    }

    // 3. Commit both data stores in a single native call to minimise the
    //    window in which the two could disagree
    await AsyncStorage.multiSet([
      [CREDENTIALS_KEY, JSON.stringify(reEncryptedCredentials)],
      [TOTP_KEY, JSON.stringify(reEncryptedTotp)],
    ]);

    // 4. Only now commit the new salt + verification hash
    await SecureStore.setItemAsync(SALT_KEY, newSalt.toString('base64'));
    await SecureStore.setItemAsync(MASTER_HASH_KEY, newHash);

    return { success: true, newMasterKey: newKey };
  } catch (error) {
    // Roll everything back to the pre-change state so the old password keeps working
    try {
      if (prevSalt !== null) await SecureStore.setItemAsync(SALT_KEY, prevSalt);
      if (prevHash !== null) await SecureStore.setItemAsync(MASTER_HASH_KEY, prevHash);

      if (prevCredentialsJson !== null) {
        await AsyncStorage.setItem(CREDENTIALS_KEY, prevCredentialsJson);
      }
      if (prevTotpJson !== null) {
        await AsyncStorage.setItem(TOTP_KEY, prevTotpJson);
      } else {
        await AsyncStorage.removeItem(TOTP_KEY);
      }
    } catch {
      // Rollback itself failed — nothing further we can safely do here
    }
    return { success: false, newMasterKey: null };
  }
};

// Clear all secure data
export const clearAllSecureData = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(MASTER_HASH_KEY);
  await SecureStore.deleteItemAsync(SALT_KEY);
  // The biometric key holds the raw master key — it must not survive a reset
  await SecureStore.deleteItemAsync(BIOMETRIC_KEY);
  await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
};