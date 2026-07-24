import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const MASTER_KEY = 'fortlock_master_hash';
const SALT_KEY = 'fortlock_salt';

// Generate a random salt
const generateSalt = async (): Promise<string> => {
  const random = await Crypto.getRandomBytesAsync(16);
  return Array.from(random)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

// Hash password with salt using SHA-256
const hashPassword = async (
  password: string,
  salt: string
): Promise<string> => {
  const combined = `${password}:${salt}`;
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    combined
  );
  return hash;
};

// Set up master password for first time
export const setupMasterPassword = async (
  password: string
): Promise<void> => {
  const salt = await generateSalt();
  const hash = await hashPassword(password, salt);
  await SecureStore.setItemAsync(SALT_KEY, salt);
  await SecureStore.setItemAsync(MASTER_KEY, hash);
};

// Verify master password
export const verifyMasterPassword = async (
  password: string
): Promise<boolean> => {
  try {
    const salt = await SecureStore.getItemAsync(SALT_KEY);
    const storedHash = await SecureStore.getItemAsync(MASTER_KEY);
    if (!salt || !storedHash) return false;
    const hash = await hashPassword(password, salt);
    return hash === storedHash;
  } catch {
    return false;
  }
};

// Check if master password exists
export const hasMasterPassword = async (): Promise<boolean> => {
  try {
    const hash = await SecureStore.getItemAsync(MASTER_KEY);
    return hash !== null;
  } catch {
    return false;
  }
};

// Clear all secure data (panic wipe)
export const clearAllSecureData = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(MASTER_KEY);
  await SecureStore.deleteItemAsync(SALT_KEY);
};