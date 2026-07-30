import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateSync } from 'otplib';
import { encryptField, decryptField } from './cryptoService';
import { TotpEntry, TotpEntryDecrypted } from '../types';
import * as ExpoRandom from 'expo-crypto';

const TOTP_KEY = 'fortlock_totp_entries';

const generateId = async (): Promise<string> => {
  const random = await ExpoRandom.getRandomBytesAsync(8);
  return Array.from(new Uint8Array(random))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

const TOTP_COLORS = [
  '#4F6EF7', '#22C55E', '#EF4444', '#F59E0B',
  '#8B5CF6', '#EC4899', '#14B8A6', '#F97316',
];

export const getRandomColor = (): string => {
  return TOTP_COLORS[Math.floor(Math.random() * TOTP_COLORS.length)];
};

export const getRawTotpEntries = async (): Promise<TotpEntry[]> => {
  try {
    const data = await AsyncStorage.getItem(TOTP_KEY);
    if (!data) return [];
    return JSON.parse(data) as TotpEntry[];
  } catch {
    return [];
  }
};

export const getDecryptedTotpEntries = async (
  masterKey: any
): Promise<TotpEntryDecrypted[]> => {
  const raw = await getRawTotpEntries();
  return raw.map((entry) => ({
    ...entry,
    secret: decryptField(entry.encryptedSecret, masterKey),
  }));
};

export const addTotpEntry = async (
  issuer: string,
  account: string,
  secret: string,
  masterKey: any,
  color?: string
): Promise<TotpEntryDecrypted> => {
  const all = await getRawTotpEntries();
  const id = await generateId();
  const now = Date.now();

  // Normalize secret — remove spaces, uppercase
  const normalizedSecret = secret.replace(/\s/g, '').toUpperCase();

  // Validate secret before saving
  try {
    generateSync({ secret: normalizedSecret });
  } catch {
    throw new Error('Invalid TOTP secret key. Please check and try again.');
  }

  const newEntry: TotpEntry = {
    id,
    issuer: issuer.trim(),
    account: account.trim(),
    encryptedSecret: encryptField(normalizedSecret, masterKey),
    color: color || getRandomColor(),
    createdAt: now,
  };

  await AsyncStorage.setItem(TOTP_KEY, JSON.stringify([...all, newEntry]));

  return { ...newEntry, secret: normalizedSecret };
};

export const deleteTotpEntry = async (id: string): Promise<void> => {
  const all = await getRawTotpEntries();
  const filtered = all.filter((e) => e.id !== id);
  await AsyncStorage.setItem(TOTP_KEY, JSON.stringify(filtered));
};

export const generateTotpCode = (secret: string): string => {
  try {
    return generateSync({ secret });
  } catch {
    return '------';
  }
};

export const getRemainingSeconds = (): number => {
  return 30 - (Math.floor(Date.now() / 1000) % 30);
};

export const parseOtpAuthUri = (
  uri: string
): { issuer: string; account: string; secret: string } | null => {
  try {
    // otpauth://totp/issuer:account?secret=XXX&issuer=XXX
    const url = new URL(uri);
    if (url.protocol !== 'otpauth:') return null;
    if (url.hostname !== 'totp') return null;

    const secret = url.searchParams.get('secret') || '';
    const issuerParam = url.searchParams.get('issuer') || '';

    // Label is the pathname without leading slash
    const label = decodeURIComponent(url.pathname.replace(/^\//, ''));
    let issuer = issuerParam;
    let account = label;

    // If label contains colon, split into issuer:account
    if (label.includes(':')) {
      const parts = label.split(':');
      issuer = issuer || parts[0].trim();
      account = parts[1].trim();
    }

    if (!secret) return null;

    return {
      issuer: issuer || account,
      account,
      secret: secret.replace(/\s/g, '').toUpperCase(),
    };
  } catch {
    return null;
  }
};
