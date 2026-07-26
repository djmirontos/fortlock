import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { Credential } from "../types";

const CREDENTIALS_KEY = "fortlock_credentials";
const BACKUP_VERSION = "1.0";

interface BackupFile {
  version: string;
  appName: string;
  exportedAt: string;
  totalCredentials: number;
  credentials: Credential[];
}

export const exportBackup = async (): Promise<void> => {
  const data = await AsyncStorage.getItem(CREDENTIALS_KEY);
  const credentials: Credential[] = data ? JSON.parse(data) : [];

  const backup: BackupFile = {
    version: BACKUP_VERSION,
    appName: "FortLock",
    exportedAt: new Date().toISOString(),
    totalCredentials: credentials.length,
    credentials,
  };

  const jsonString = JSON.stringify(backup, null, 2);

  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const filename = `fortlock_backup_${dateStr}.flbx`;
  const filePath = FileSystem.cacheDirectory + filename;

  await FileSystem.writeAsStringAsync(filePath, jsonString, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error("Sharing is not available on this device");
  }

  await Sharing.shareAsync(filePath, {
    mimeType: "application/octet-stream",
    dialogTitle: "Export FortLock Backup",
    UTI: "public.data",
  });
};

export const importBackup = async (): Promise<number> => {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/octet-stream", "text/plain", "*/*"],
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return 0;
  }

  const file = result.assets[0];

  if (!file.name?.endsWith('.flbx') && !file.name?.endsWith('.json')) {
    throw new Error("Please select a valid FortLock backup file (.flbx)");
  }

  const content = await FileSystem.readAsStringAsync(file.uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  let backup: BackupFile;
  try {
    backup = JSON.parse(content);
  } catch {
    throw new Error("Invalid backup file format");
  }

  if (!backup.version || !backup.credentials || !Array.isArray(backup.credentials)) {
    throw new Error("Invalid FortLock backup file");
  }

  if (backup.appName !== "FortLock") {
    throw new Error("This backup is not from FortLock");
  }

  const existingData = await AsyncStorage.getItem(CREDENTIALS_KEY);
  const existing: Credential[] = existingData ? JSON.parse(existingData) : [];

  const existingIds = new Set(existing.map((c) => c.id));

  const newCredentials = backup.credentials.filter(
    (c) => !existingIds.has(c.id) && c.encryptedData
  );

  if (newCredentials.length === 0) {
    return 0;
  }

  const merged = [...existing, ...newCredentials];
  await AsyncStorage.setItem(CREDENTIALS_KEY, JSON.stringify(merged));

  return newCredentials.length;
};
