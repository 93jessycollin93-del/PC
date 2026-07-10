/**
 * Encrypted Secrets Vault — WebCrypto-backed storage for API keys with rotation support
 */

import { appStorage } from './appStorage';
import { permissions } from './permissions';
import { bus } from './bus';

export interface SecretEntry {
  name: string; // e.g. 'groq_api_key'
  provider?: string; // e.g. 'groq' (for organization)
  createdAt: number;
  rotatedAt?: number;
  expiresAt?: number; // optional expiration
  tags?: string[]; // e.g. ['automation', 'ai-term'] for scoped access
}

interface VaultStore {
  version: number;
  encryptedData: string; // base64-encoded encrypted data
  iv: string; // initialization vector (base64)
  salt: string; // salt for key derivation (base64)
  entries: SecretEntry[]; // metadata (not encrypted)
}

class SecretsVault {
  private masterKey: CryptoKey | null = null;
  private vaultData: VaultStore | null = null;
  private secrets: Map<string, string> = new Map(); // in-memory decrypted cache
  private initialized = false;

  constructor() {
    this.loadVault();
  }

  /**
   * Initialize vault with a master password (first-time setup)
   */
  public async initializeVault(masterPassword: string): Promise<void> {
    this.masterKey = await this.deriveKey(masterPassword);
    this.vaultData = {
      version: 1,
      encryptedData: '',
      iv: '',
      salt: '', // Salt is already in the key derivation
      entries: [],
    };
    this.secrets.clear();
    this.initialized = true;
    await this.encryptAndSave();
    bus.emit('jackie-notification', {
      level: 'success',
      title: 'Secrets Vault initialized',
      message: 'Master password set. Start adding secrets.',
      source: 'secrets-vault',
    });
  }

  /**
   * Unlock vault with master password (on page load)
   */
  public async unlockVault(masterPassword: string): Promise<boolean> {
    try {
      this.masterKey = await this.deriveKey(masterPassword);
      await this.decryptVault();
      this.initialized = true;
      return true;
    } catch (e) {
      console.error('[SecretsVault] Unlock failed:', e);
      this.initialized = false;
      return false;
    }
  }

  /**
   * Store a secret (encrypted)
   */
  public async setSecret(
    name: string,
    value: string,
    options: Partial<SecretEntry> = {}
  ): Promise<void> {
    if (!this.initialized) {
      throw new Error('Vault not initialized. Call initializeVault() first.');
    }

    this.secrets.set(name, value);

    // Update metadata
    const entry: SecretEntry = {
      name,
      provider: options.provider,
      createdAt: Date.now(),
      expiresAt: options.expiresAt,
      tags: options.tags || [],
    };

    // Remove old entry if exists
    if (this.vaultData) {
      this.vaultData.entries = this.vaultData.entries.filter(e => e.name !== name);
      this.vaultData.entries.push(entry);
    }

    await this.encryptAndSave();
  }

  /**
   * Get a secret (requires permission)
   */
  public async getSecret(name: string, scope?: string): Promise<string | undefined> {
    if (!this.initialized) {
      return undefined;
    }

    // Permission check: if scope provided, verify access
    if (scope) {
      if (!permissions.require(scope, 'model_access', `vault.getSecret(${name})`)) {
        throw new Error(`Access denied for scope "${scope}" to secret "${name}"`);
      }
    }

    return this.secrets.get(name);
  }

  /**
   * Delete a secret
   */
  public async deleteSecret(name: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('Vault not initialized.');
    }

    this.secrets.delete(name);

    if (this.vaultData) {
      this.vaultData.entries = this.vaultData.entries.filter(e => e.name !== name);
    }

    await this.encryptAndSave();
    bus.emit('jackie-notification', {
      level: 'info',
      title: `Secret deleted`,
      message: name,
      source: 'secrets-vault',
    });
  }

  /**
   * List all secret names (metadata only, no values)
   */
  public listSecrets(): SecretEntry[] {
    return this.vaultData?.entries || [];
  }

  /**
   * Rotate a secret (mark old, add new with rotation timestamp)
   */
  public async rotateSecret(name: string, newValue: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('Vault not initialized.');
    }

    const oldEntry = this.vaultData?.entries.find(e => e.name === name);
    if (oldEntry) {
      oldEntry.rotatedAt = Date.now();
    }

    await this.setSecret(name, newValue, { ...oldEntry });
    bus.emit('jackie-notification', {
      level: 'info',
      title: `Secret rotated`,
      message: name,
      source: 'secrets-vault',
    });
  }

  /**
   * Check if a secret is expired
   */
  public isSecretExpired(name: string): boolean {
    const entry = this.vaultData?.entries.find(e => e.name === name);
    if (!entry || !entry.expiresAt) return false;
    return Date.now() > entry.expiresAt;
  }

  /**
   * Get secrets expiring soon (within N days)
   */
  public getExpiringSecrets(daysUntilExpiry: number = 7): SecretEntry[] {
    const threshold = Date.now() + daysUntilExpiry * 24 * 60 * 60 * 1000;
    return (this.vaultData?.entries || []).filter(e => e.expiresAt && e.expiresAt <= threshold && !this.isSecretExpired(e.name));
  }

  /**
   * Check if vault is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Private: Derive a key from master password using PBKDF2
   */
  private async deriveKey(password: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));

    const passwordKey = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);

    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, hash: 'SHA-256', iterations: 100000 },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Private: Encrypt and save vault to storage
   */
  private async encryptAndSave(): Promise<void> {
    if (!this.masterKey || !this.vaultData) return;

    try {
      // Serialize secrets map to JSON
      const secretsJson = JSON.stringify(Array.from(this.secrets.entries()));
      const encoder = new TextEncoder();
      const data = encoder.encode(secretsJson);

      // Generate IV and encrypt
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encryptedBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, this.masterKey, data);

      // Save to storage
      this.vaultData.encryptedData = this.bufferToBase64(encryptedBuffer);
      this.vaultData.iv = this.bufferToBase64(iv);

      const storage = appStorage('secrets-vault');
      storage.set('vault', this.vaultData);
    } catch (e) {
      console.error('[SecretsVault] Encryption failed:', e);
      throw e;
    }
  }

  /**
   * Private: Decrypt vault from storage
   */
  private async decryptVault(): Promise<void> {
    if (!this.masterKey) return;

    const storage = appStorage('secrets-vault');
    const vaultData = storage.get<VaultStore>('vault');
    if (!vaultData) {
      throw new Error('No vault data found');
    }

    try {
      const encryptedBuffer = this.base64ToBuffer(vaultData.encryptedData);
      const iv = this.base64ToBuffer(vaultData.iv);

      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        this.masterKey,
        encryptedBuffer
      );

      const decoder = new TextDecoder();
      const secretsJson = decoder.decode(decryptedBuffer);
      const secretsArray = JSON.parse(secretsJson) as [string, string][];

      this.secrets = new Map(secretsArray);
      this.vaultData = vaultData;
    } catch (e) {
      console.error('[SecretsVault] Decryption failed:', e);
      throw e;
    }
  }

  /**
   * Private: Load vault from storage (attempt to unlock with cached key)
   */
  private loadVault(): void {
    const storage = appStorage('secrets-vault');
    this.vaultData = storage.get<VaultStore>('vault');
    if (this.vaultData) {
      // Vault exists but needs unlock password
      this.initialized = false;
    }
  }

  /**
   * Private: Convert buffer to base64
   */
  private bufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Private: Convert base64 to buffer
   */
  private base64ToBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

export const secretsVault = new SecretsVault();
