// FortLock — centralized storage keys
// Single source of truth. Renaming a key here must be accompanied by a
// migration, since existing installs hold data under the old key.

// AsyncStorage
export const CREDENTIALS_KEY = 'fortlock_credentials';
export const TOTP_KEY = 'fortlock_totp_entries';
export const THEME_KEY = 'fortlock_theme_mode';
export const AUTO_LOCK_KEY = 'fortlock_auto_lock_timer';

// SecureStore
export const MASTER_HASH_KEY = 'fortlock_master_hash';
export const SALT_KEY = 'fortlock_salt';
export const BIOMETRIC_KEY = 'fortlock_biometric_key';
// Plain (non auth-bound) mirror of whether BIOMETRIC_KEY is stored. Reading
// BIOMETRIC_KEY itself would trigger a biometric prompt, so this flag lets the
// UI show the correct toggle state without one.
export const BIOMETRIC_ENABLED_KEY = 'fortlock_biometric_enabled';
