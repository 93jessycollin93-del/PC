/**
 * Secure Export/Import Signing — sign exports with vault-derived key for integrity verification
 */

import { appStorage } from './appStorage';
import { secretsVault } from './secretsVault';

export interface SignedExport {
  version: string;
  timestamp: string;
  data: string; // base64 encoded
  signature: string; // hex encoded HMAC
  algorithm: string;
  hash: string;
}

class SecureSigner {
  private algorithm = 'SHA-256';
  private version = '1.0';
  private signingKey: CryptoKey | null = null;

  /**
   * Initialize signing key from vault master password (async)
   */
  async initialize(password: string): Promise<boolean> {
    try {
      // Derive a signing key from the password using PBKDF2
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const salt = new TextEncoder().encode('secure-signing-salt-v1');

      const key = await crypto.subtle.importKey(
        'raw',
        data,
        'PBKDF2',
        false,
        ['deriveKey']
      );

      this.signingKey = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
        key,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      return true;
    } catch (e) {
      console.warn('[SECURE_SIGNING] Failed to initialize:', e);
      return false;
    }
  }

  /**
   * Sign an export with HMAC-SHA256
   */
  async signExport(data: any): Promise<SignedExport | null> {
    if (!this.signingKey) return null;

    try {
      const jsonStr = JSON.stringify(data);
      const encoded = new TextEncoder().encode(jsonStr);
      const dataB64 = btoa(jsonStr);

      const signatureBytes = await crypto.subtle.sign(
        'HMAC',
        this.signingKey,
        encoded
      );

      const signatureHex = Array.from(new Uint8Array(signatureBytes))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      return {
        version: this.version,
        timestamp: new Date().toISOString(),
        data: dataB64,
        signature: signatureHex,
        algorithm: 'HMAC-SHA256',
        hash: 'SHA-256',
      };
    } catch (e) {
      console.warn('[SECURE_SIGNING] Failed to sign:', e);
      return null;
    }
  }

  /**
   * Verify a signed export
   */
  async verifyExport(signed: SignedExport): Promise<{ valid: boolean; data: any | null }> {
    if (!this.signingKey) {
      return { valid: false, data: null };
    }

    try {
      const decoded = atob(signed.data);
      const encoded = new TextEncoder().encode(decoded);

      const expectedSignatureBytes = await crypto.subtle.sign(
        'HMAC',
        this.signingKey,
        encoded
      );

      const expectedSignatureHex = Array.from(new Uint8Array(expectedSignatureBytes))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const valid = expectedSignatureHex === signed.signature;

      if (!valid) {
        console.warn('[SECURE_SIGNING] Signature mismatch - export may be tampered');
        return { valid: false, data: null };
      }

      const data = JSON.parse(decoded);
      return { valid: true, data };
    } catch (e) {
      console.warn('[SECURE_SIGNING] Failed to verify:', e);
      return { valid: false, data: null };
    }
  }

  /**
   * Export a namespace signed
   */
  async exportNamespaceSigned(namespace: string, password: string): Promise<SignedExport | null> {
    const initialized = await this.initialize(password);
    if (!initialized) return null;

    try {
      const storage = appStorage(namespace);
      const keys = storage.keys();
      const data: Record<string, any> = {};

      keys.forEach(key => {
        data[key] = storage.get(key);
      });

      return this.signExport({ namespace, data, timestamp: Date.now() });
    } catch (e) {
      console.warn('[SECURE_SIGNING] Failed to export namespace:', e);
      return null;
    }
  }

  /**
   * Import a signed namespace
   */
  async importNamespaceSigned(signed: SignedExport, password: string): Promise<boolean> {
    const initialized = await this.initialize(password);
    if (!initialized) return false;

    try {
      const verification = await this.verifyExport(signed);
      if (!verification.valid || !verification.data) {
        console.warn('[SECURE_SIGNING] Import failed verification');
        return false;
      }

      const { namespace, data } = verification.data;
      const storage = appStorage(namespace);

      Object.entries(data).forEach(([key, value]) => {
        storage.set(key, value);
      });

      return true;
    } catch (e) {
      console.warn('[SECURE_SIGNING] Failed to import namespace:', e);
      return false;
    }
  }
}

export const secureSigner = new SecureSigner();
