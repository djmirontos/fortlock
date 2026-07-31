import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ExpoRandom from 'expo-crypto';
import { Tag } from '../types';
import { TAGS_KEY, CREDENTIALS_KEY } from '../constants/storageKeys';

const TAG_COLORS = [
  '#4F6EF7', '#22C55E', '#EF4444', '#F59E0B',
  '#8B5CF6', '#EC4899', '#14B8A6', '#F97316',
  '#3B82F6', '#10B981', '#6366F1', '#84CC16',
];

const DEFAULT_TAGS: Tag[] = [
  { id: 'tag_general', label: 'General', color: '#8B5CF6', createdAt: 0 },
  { id: 'tag_banking', label: 'Banking', color: '#3B82F6', createdAt: 0 },
  { id: 'tag_social', label: 'Social', color: '#22C55E', createdAt: 0 },
  { id: 'tag_email', label: 'Email', color: '#F97316', createdAt: 0 },
  { id: 'tag_work', label: 'Work', color: '#4F6EF7', createdAt: 0 },
  { id: 'tag_personal', label: 'Personal', color: '#EC4899', createdAt: 0 },
  { id: 'tag_shopping', label: 'Shopping', color: '#14B8A6', createdAt: 0 },
  { id: 'tag_gaming', label: 'Gaming', color: '#EF4444', createdAt: 0 },
];

const generateId = async (): Promise<string> => {
  const random = await ExpoRandom.getRandomBytesAsync(8);
  return 'tag_' + Array.from(new Uint8Array(random))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

export const getTags = async (): Promise<Tag[]> => {
  try {
    const data = await AsyncStorage.getItem(TAGS_KEY);
    if (!data) {
      await AsyncStorage.setItem(TAGS_KEY, JSON.stringify(DEFAULT_TAGS));
      return DEFAULT_TAGS;
    }
    return JSON.parse(data) as Tag[];
  } catch {
    return DEFAULT_TAGS;
  }
};

export const addTag = async (label: string, color?: string): Promise<Tag> => {
  const all = await getTags();
  const trimmed = label.trim();
  const duplicate = all.find(
    (t) => t.label.toLowerCase() === trimmed.toLowerCase()
  );
  if (duplicate) {
    throw new Error(`A tag named "${trimmed}" already exists.`);
  }
  const id = await generateId();
  const newTag: Tag = {
    id,
    label: trimmed,
    color: color || TAG_COLORS[all.length % TAG_COLORS.length],
    createdAt: Date.now(),
  };
  await AsyncStorage.setItem(TAGS_KEY, JSON.stringify([...all, newTag]));
  return newTag;
};

export const updateTag = async (id: string, label: string): Promise<void> => {
  const all = await getTags();
  const trimmed = label.trim();
  const duplicate = all.find(
    (t) => t.id !== id && t.label.toLowerCase() === trimmed.toLowerCase()
  );
  if (duplicate) {
    throw new Error(`A tag named "${trimmed}" already exists.`);
  }
  const updated = all.map((t) =>
    t.id === id ? { ...t, label: trimmed } : t
  );
  await AsyncStorage.setItem(TAGS_KEY, JSON.stringify(updated));
};

export const deleteTag = async (id: string): Promise<void> => {
  const all = await getTags();
  const filtered = all.filter((t) => t.id !== id);
  await AsyncStorage.setItem(TAGS_KEY, JSON.stringify(filtered));

  // Remove orphaned tag ID from all credentials
  try {
    const credsRaw = await AsyncStorage.getItem(CREDENTIALS_KEY);
    if (credsRaw) {
      const creds = JSON.parse(credsRaw);
      const updated = creds.map((c: any) => ({
        ...c,
        tags: Array.isArray(c.tags) ? c.tags.filter((t: string) => t !== id) : [],
      }));
      await AsyncStorage.setItem(CREDENTIALS_KEY, JSON.stringify(updated));
    }
  } catch {
    // silent — credential sweep is best-effort
  }
};

export const getRandomTagColor = (): string => {
  return TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
};

export const CATEGORY_TO_TAG_ID: Record<string, string> = {
  general: 'tag_general',
  banking: 'tag_banking',
  social: 'tag_social',
  email: 'tag_email',
};
