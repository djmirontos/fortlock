import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { Credential } from "../types";
import { decryptCredentialData } from "./cryptoService";

const CREDENTIALS_KEY = "fortlock_credentials";
const BACKUP_VERSION = "1.0";

interface BackupFile {
  version: string;
  appName: string;
  exportedAt: string;
  totalCredentials: number;
  credentials: Credential[];
}

const getDateStr = (): string => {
  const date = new Date();
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
};

const csvEscape = (value: string): string => {
  return `"${value.replace(/"/g, '""')}"`;
};

const xmlEscape = (value: string): string => {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
};

// Export encrypted vault backup (.flbx) — no decryption needed
export const exportFlbx = async (): Promise<void> => {
  let data: string | null = null;
  try {
    data = await AsyncStorage.getItem(CREDENTIALS_KEY);
  } catch {
    throw new Error("Failed to read vault data. Please try again.");
  }

  const credentials: Credential[] = data ? JSON.parse(data) : [];

  if (credentials.length === 0) {
    throw new Error("Your vault is empty. Add credentials before exporting.");
  }

  const backup: BackupFile = {
    version: BACKUP_VERSION,
    appName: "FortLock",
    exportedAt: new Date().toISOString(),
    totalCredentials: credentials.length,
    credentials,
  };

  const jsonString = JSON.stringify(backup, null, 2);

  const filename = `fortlock_backup_${getDateStr()}.flbx`;
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

// Export plaintext CSV — requires masterKey for decryption
export const exportCsv = async (masterKey: any): Promise<void> => {
  let data: string | null = null;
  try {
    data = await AsyncStorage.getItem(CREDENTIALS_KEY);
  } catch {
    throw new Error("Failed to read vault data. Please try again.");
  }

  const credentials: Credential[] = data ? JSON.parse(data) : [];

  if (credentials.length === 0) {
    throw new Error("Your vault is empty. Add credentials before exporting.");
  }

  const header = '"Title","Username","Password","URL","Notes","Category","CardHolder","CardNumber","ExpiryDate","CVV"';
  const rows = credentials.map((cred) => {
    const decrypted = decryptCredentialData(cred.encryptedData, masterKey);
    const fields = [
      decrypted.serviceName || "",
      decrypted.username || "",
      decrypted.password || "",
      "",
      decrypted.notes || "",
      cred.category || "",
      decrypted.cardHolder || "",
      decrypted.cardNumber || "",
      decrypted.expiryDate || "",
      decrypted.cvv || "",
    ];
    return fields.map((f) => csvEscape(f)).join(",");
  });

  const csvString = [header, ...rows].join("\n");

  const filename = `fortlock_export_${getDateStr()}.csv`;
  const filePath = FileSystem.cacheDirectory + filename;

  await FileSystem.writeAsStringAsync(filePath, csvString, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error("Sharing is not available on this device");
  }

  await Sharing.shareAsync(filePath, {
    mimeType: "text/csv",
    dialogTitle: "Export FortLock Backup",
    UTI: "public.comma-separated-values-text",
  });
};

// Export KeePass-compatible plaintext XML — requires masterKey for decryption
export const exportXml = async (masterKey: any): Promise<void> => {
  let data: string | null = null;
  try {
    data = await AsyncStorage.getItem(CREDENTIALS_KEY);
  } catch {
    throw new Error("Failed to read vault data. Please try again.");
  }

  const credentials: Credential[] = data ? JSON.parse(data) : [];

  if (credentials.length === 0) {
    throw new Error("Your vault is empty. Add credentials before exporting.");
  }

  const entries = credentials.map((cred) => {
    const decrypted = decryptCredentialData(cred.encryptedData, masterKey);
    return `      <Entry>
        <String><Key>Title</Key><Value>${xmlEscape(decrypted.serviceName || "")}</Value></String>
        <String><Key>UserName</Key><Value>${xmlEscape(decrypted.username || "")}</Value></String>
        <String><Key>Password</Key><Value>${xmlEscape(decrypted.password || "")}</Value></String>
        <String><Key>Notes</Key><Value>${xmlEscape(decrypted.notes || "")}</Value></String>
        <String><Key>Category</Key><Value>${xmlEscape(cred.category || "")}</Value></String>
        <String><Key>CardHolder</Key><Value>${xmlEscape(decrypted.cardHolder || "")}</Value></String>
        <String><Key>CardNumber</Key><Value>${xmlEscape(decrypted.cardNumber || "")}</Value></String>
        <String><Key>ExpiryDate</Key><Value>${xmlEscape(decrypted.expiryDate || "")}</Value></String>
        <String><Key>CVV</Key><Value>${xmlEscape(decrypted.cvv || "")}</Value></String>
        <Times>
          <CreationTime>${new Date(cred.createdAt).toISOString()}</CreationTime>
          <LastModificationTime>${new Date(cred.updatedAt).toISOString()}</LastModificationTime>
        </Times>
      </Entry>`;
  });

  const xmlString = `<?xml version="1.0" encoding="utf-8"?>
<KeePassFile>
  <Meta>
    <Generator>FortLock</Generator>
    <DatabaseName>FortLock Export</DatabaseName>
    <DatabaseDescription>Exported from FortLock Password Manager</DatabaseDescription>
  </Meta>
  <Root>
    <Group>
      <Name>FortLock</Name>
${entries.join("\n")}
    </Group>
  </Root>
</KeePassFile>`;

  const filename = `fortlock_export_${getDateStr()}.xml`;
  const filePath = FileSystem.cacheDirectory + filename;

  await FileSystem.writeAsStringAsync(filePath, xmlString, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error("Sharing is not available on this device");
  }

  await Sharing.shareAsync(filePath, {
    mimeType: "text/xml",
    dialogTitle: "Export FortLock Backup",
    UTI: "public.xml",
  });
};

// Import encrypted vault backup (.flbx) — replaces the active vault, no merge
export const importFlbx = async (): Promise<number> => {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["*/*"],
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return 0;
  }

  const file = result.assets[0];

  if (!file.name?.endsWith(".flbx")) {
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
    throw new Error("Invalid FortLock backup file");
  }

  const validCredentials = backup.credentials.filter((c) => c.id && c.encryptedData);

  await AsyncStorage.setItem(CREDENTIALS_KEY, JSON.stringify(validCredentials));

  return validCredentials.length;
};

// Deprecated aliases — kept so existing settings.tsx calls don't break
export const exportBackup = exportFlbx;
export const importBackup = importFlbx;
