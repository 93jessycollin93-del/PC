import React, { useEffect, useReducer, useState } from 'react';
import { Lock, Unlock, Trash2, RotateCw, Plus, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { secretsVault, type SecretEntry } from '../../lib/secretsVault';
import { appStorage } from '../../lib/appStorage';

/**
 * Secrets Vault — encrypted storage for API keys with rotation support
 */

type AppState = 'locked' | 'unlocked' | 'needs-init';

export const SecretsVaultApp: React.FC = () => {
  const [, tick] = useReducer((x: number) => x + 1, 0);
  const [appState, setAppState] = useState<AppState>('locked');
  const [masterPassword, setMasterPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [secretName, setSecretName] = useState('');
  const [secretValue, setSecretValue] = useState('');
  const [showValues, setShowValues] = useState<Set<string>>(new Set());
  const [errorMsg, setErrorMsg] = useState('');

  // Determine initial state
  useEffect(() => {
    if (secretsVault.isInitialized()) {
      setAppState('unlocked');
    } else if (secretsVault.listSecrets().length === 0) {
      setAppState('needs-init');
    } else {
      setAppState('locked');
    }
  }, []);

  const handleInitialize = async () => {
    if (!newPassword || newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setErrorMsg('Password must be at least 8 characters');
      return;
    }
    try {
      await secretsVault.initializeVault(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      setAppState('unlocked');
      setErrorMsg('');
      tick();
    } catch (e) {
      setErrorMsg(String(e));
    }
  };

  const handleUnlock = async () => {
    if (!masterPassword) {
      setErrorMsg('Password required');
      return;
    }
    const success = await secretsVault.unlockVault(masterPassword);
    if (success) {
      setMasterPassword('');
      setAppState('unlocked');
      setErrorMsg('');
      tick();
    } else {
      setErrorMsg('Incorrect password');
    }
  };

  const handleAddSecret = async () => {
    if (!secretName || !secretValue) {
      setErrorMsg('Name and value required');
      return;
    }
    try {
      await secretsVault.setSecret(secretName, secretValue);
      setSecretName('');
      setSecretValue('');
      setErrorMsg('');
      tick();
    } catch (e) {
      setErrorMsg(String(e));
    }
  };

  const handleDeleteSecret = async (name: string) => {
    if (!confirm(`Delete secret "${name}"?`)) return;
    try {
      await secretsVault.deleteSecret(name);
      tick();
    } catch (e) {
      setErrorMsg(String(e));
    }
  };

  const handleRotateSecret = async (name: string) => {
    const newVal = prompt(`Enter new value for "${name}":`);
    if (!newVal) return;
    try {
      await secretsVault.rotateSecret(name, newVal);
      tick();
    } catch (e) {
      setErrorMsg(String(e));
    }
  };

  const toggleShowValue = (name: string) => {
    const next = new Set(showValues);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    setShowValues(next);
  };

  const secrets = secretsVault.listSecrets();
  const expiringMapped = secretsVault.getExpiringSecrets(7);

  return (
    <div className="h-full w-full bg-zinc-950 text-zinc-300 font-sans flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-14 border-b border-zinc-800 bg-zinc-900 px-4 flex items-center justify-between shrink-0">
        <h2 className="font-bold text-sm text-white flex items-center gap-2">
          <Lock size={16} className="text-amber-400" />
          Secrets Vault
        </h2>
        <div className="text-xs text-zinc-500">
          {appState === 'unlocked' && <span className="text-emerald-400">🔓 Unlocked</span>}
          {appState === 'locked' && <span className="text-amber-400">🔒 Locked</span>}
          {appState === 'needs-init' && <span className="text-red-400">⚠ Not initialized</span>}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Initialization screen */}
        {appState === 'needs-init' && (
          <div className="max-w-md mx-auto space-y-4 mt-8">
            <div className="bg-zinc-900/70 border border-zinc-700 rounded-lg p-4">
              <h3 className="font-bold text-white mb-3">Initialize Vault</h3>
              <p className="text-xs text-zinc-400 mb-4">
                Set a master password to encrypt your API keys. This password will be required to access secrets.
              </p>
              <div className="space-y-2">
                <input
                  type="password"
                  placeholder="Master password (min 8 chars)"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-700 rounded text-sm text-zinc-300 focus:border-amber-500 outline-none"
                />
                <input
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-700 rounded text-sm text-zinc-300 focus:border-amber-500 outline-none"
                />
                <button
                  onClick={handleInitialize}
                  className="w-full px-3 py-2 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm"
                >
                  Initialize Vault
                </button>
              </div>
              {errorMsg && <div className="mt-2 text-xs text-red-400">{errorMsg}</div>}
            </div>
          </div>
        )}

        {/* Unlock screen */}
        {appState === 'locked' && (
          <div className="max-w-md mx-auto space-y-4 mt-8">
            <div className="bg-zinc-900/70 border border-zinc-700 rounded-lg p-4">
              <h3 className="font-bold text-white mb-3">Unlock Vault</h3>
              <div className="space-y-2">
                <input
                  type="password"
                  placeholder="Master password"
                  value={masterPassword}
                  onChange={e => setMasterPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleUnlock()}
                  className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-700 rounded text-sm text-zinc-300 focus:border-amber-500 outline-none"
                />
                <button
                  onClick={handleUnlock}
                  className="w-full px-3 py-2 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm"
                >
                  Unlock
                </button>
              </div>
              {errorMsg && <div className="mt-2 text-xs text-red-400">{errorMsg}</div>}
            </div>
          </div>
        )}

        {/* Unlocked view */}
        {appState === 'unlocked' && (
          <div className="space-y-4">
            {/* Warnings */}
            {expiringMapped.length > 0 && (
              <div className="bg-amber-900/30 border border-amber-700 rounded-lg p-3 flex gap-2">
                <AlertCircle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-200">
                  {expiringMapped.length} secret(s) expiring within 7 days
                </div>
              </div>
            )}

            {/* Add new secret form */}
            <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Plus size={13} className="text-zinc-500" />
                <h3 className="text-sm font-bold text-white">Add Secret</h3>
              </div>
              <div className="space-y-2">
                <input
                  placeholder="Secret name (e.g., groq_api_key)"
                  value={secretName}
                  onChange={e => setSecretName(e.target.value)}
                  className="w-full px-2 py-1 bg-zinc-950 border border-zinc-700 rounded text-xs text-zinc-300 focus:border-amber-500 outline-none"
                />
                <input
                  placeholder="Secret value"
                  value={secretValue}
                  onChange={e => setSecretValue(e.target.value)}
                  type="password"
                  className="w-full px-2 py-1 bg-zinc-950 border border-zinc-700 rounded text-xs text-zinc-300 focus:border-amber-500 outline-none"
                />
                <button
                  onClick={handleAddSecret}
                  className="w-full px-2 py-1 rounded text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white"
                >
                  Add
                </button>
              </div>
              {errorMsg && <div className="mt-2 text-xs text-red-400">{errorMsg}</div>}
            </div>

            {/* Secrets list */}
            {secrets.length === 0 ? (
              <div className="text-xs text-zinc-500 text-center py-8">No secrets stored yet.</div>
            ) : (
              <div className="space-y-2">
                {secrets.map(entry => {
                  const isExpired = secretsVault.isSecretExpired(entry.name);
                  return (
                    <div
                      key={entry.name}
                      className={`border rounded-lg p-2 flex items-center gap-2 ${
                        isExpired ? 'bg-red-900/20 border-red-700' : 'bg-zinc-900/50 border-zinc-700'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-mono text-white truncate">{entry.name}</div>
                        <div className="text-[10px] text-zinc-500">
                          Created {new Date(entry.createdAt).toLocaleDateString()}
                          {entry.rotatedAt && ` · Rotated ${new Date(entry.rotatedAt).toLocaleDateString()}`}
                          {entry.expiresAt && ` · Expires ${new Date(entry.expiresAt).toLocaleDateString()}`}
                          {isExpired && ' · ⚠️ EXPIRED'}
                        </div>
                      </div>
                      <button
                        onClick={() => toggleShowValue(entry.name)}
                        className="p-1 hover:bg-zinc-700 rounded"
                        title="Show/hide value"
                      >
                        {showValues.has(entry.name) ? (
                          <Eye size={12} className="text-zinc-400" />
                        ) : (
                          <EyeOff size={12} className="text-zinc-600" />
                        )}
                      </button>
                      <button
                        onClick={() => handleRotateSecret(entry.name)}
                        className="p-1 hover:bg-zinc-700 rounded"
                        title="Rotate secret"
                      >
                        <RotateCw size={12} className="text-zinc-500 hover:text-amber-400" />
                      </button>
                      <button
                        onClick={() => handleDeleteSecret(entry.name)}
                        className="p-1 hover:bg-zinc-700 rounded"
                        title="Delete secret"
                      >
                        <Trash2 size={12} className="text-zinc-600 hover:text-red-400" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-zinc-800 bg-zinc-900/50 text-[10px] text-zinc-600">
        <div>• Master password encryption using WebCrypto (AES-256-GCM)</div>
        <div>• Secrets are encrypted at rest, decrypted in memory</div>
        <div>• No secrets transmitted to backend — all client-side</div>
      </div>
    </div>
  );
};

export default SecretsVaultApp;
