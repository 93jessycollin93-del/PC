/**
 * Secrets Migration — Move plaintext API keys from localStorage into encrypted vault
 */

import { secretsVault } from './secretsVault';
import { bus } from './bus';

const PLAINTEXT_KEY_NAMES = [
  'grok_api_key',
  'groq_api_key',
  'gemini_api_key',
  'deepseek_api_key',
  'anthropic_api_key',
  'agent_apikey_main',
  'agent_apikey_secondary',
  'ollama_api_key',
];

const MIGRATION_FLAG_KEY = 'jackie_secrets_migrated_v1';

/**
 * Migrate plaintext API keys from localStorage to the secrets vault.
 * Idempotent: runs once, then skips on subsequent calls.
 */
export async function migrateSecretsToVault(): Promise<{ migrated: number; failed: number }> {
  if (!secretsVault.isInitialized()) {
    console.warn('[SecretsMigration] Vault not initialized; skipping migration');
    return { migrated: 0, failed: 0 };
  }

  // Check if migration has already run
  if (localStorage.getItem(MIGRATION_FLAG_KEY) === 'true') {
    console.log('[SecretsMigration] Already migrated; skipping');
    return { migrated: 0, failed: 0 };
  }

  let migrated = 0;
  let failed = 0;

  for (const keyName of PLAINTEXT_KEY_NAMES) {
    const plainKey = localStorage.getItem(keyName);
    if (!plainKey) continue;

    try {
      await secretsVault.setSecret(keyName, plainKey, {
        provider: keyName.replace('_api_key', ''),
        tags: ['migrated-from-plaintext'],
      });
      migrated++;
    } catch (e) {
      console.error(`[SecretsMigration] Failed to migrate ${keyName}:`, e);
      failed++;
    }
  }

  // Only mark as complete if at least one key was migrated or no keys existed
  if (migrated > 0 || failed === 0) {
    localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
  }

  if (migrated > 0) {
    bus.emit('jackie-notification', {
      level: 'success',
      title: 'Secrets migrated',
      message: `${migrated} API key(s) moved to encrypted vault. Plaintext copies will be removed on next action.`,
      source: 'secrets-migration',
    });
  }

  if (failed > 0) {
    bus.emit('jackie-notification', {
      level: 'warning',
      title: 'Partial migration',
      message: `${failed} key(s) failed to migrate. Check console for details.`,
      source: 'secrets-migration',
    });
  }

  return { migrated, failed };
}

/**
 * Scrub plaintext API keys from localStorage (run after vault is confirmed healthy).
 * Idempotent; checks that each key exists in vault before removing.
 */
export async function scrubPlaintextKeys(): Promise<{ scrubbed: number }> {
  if (!secretsVault.isInitialized()) {
    console.warn('[SecretsMigration] Vault not initialized; cannot verify keys before scrubbing');
    return { scrubbed: 0 };
  }

  let scrubbed = 0;

  for (const keyName of PLAINTEXT_KEY_NAMES) {
    const plainKey = localStorage.getItem(keyName);
    if (!plainKey) continue;

    // Verify it exists in vault before removing plaintext copy
    const vaultKey = await secretsVault.getSecret(keyName);
    if (vaultKey === plainKey) {
      localStorage.removeItem(keyName);
      scrubbed++;
    }
  }

  if (scrubbed > 0) {
    bus.emit('jackie-notification', {
      level: 'info',
      title: 'Plaintext keys scrubbed',
      message: `${scrubbed} plaintext key(s) removed from localStorage.`,
      source: 'secrets-migration',
    });
  }

  return { scrubbed };
}
