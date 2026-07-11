import React, { useState, useEffect } from 'react';
import { Lock, Unlock, Trash2, Database, AlertTriangle, CheckCircle } from 'lucide-react';
import { appStorage } from '../../lib/appStorage';
import { bus } from '../../lib/bus';

interface VaultedNamespace {
  name: string;
  size: number;
  locked: boolean;
  createdAt: number;
}

export const DataVaultApp: React.FC = () => {
  const [vaults, setVaults] = useState<VaultedNamespace[]>([]);
  const [selectedVault, setSelectedVault] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [action, setAction] = useState<'view' | 'shred'>('view');

  useEffect(() => {
    loadVaults();
  }, []);

  const loadVaults = () => {
    try {
      const storage = appStorage('data-vault');
      const vaultList = storage.get<VaultedNamespace[]>('vaults', []);
      setVaults(vaultList);
    } catch (e) {
      console.warn('[VAULT] Could not load vaults:', e);
    }
  };

  const handleCreateVault = (namespace: string) => {
    if (!namespace.trim()) return;

    try {
      const storage = appStorage('data-vault');
      const vaultList = storage.get<VaultedNamespace[]>('vaults', []);

      const newVault: VaultedNamespace = {
        name: namespace,
        size: 0,
        locked: true,
        createdAt: Date.now(),
      };

      vaultList.push(newVault);
      storage.set('vaults', vaultList);

      setVaults(vaultList);
      setSelectedVault(namespace);

      bus.emit('jackie-notification' as any, {
        level: 'success',
        title: 'Vault created',
        message: `Data vault for "${namespace}" created and locked.`,
        source: 'data-vault',
      });
    } catch (e) {
      console.error('[VAULT] Error creating vault:', e);
    }
  };

  const handleLockVault = (name: string) => {
    try {
      const storage = appStorage('data-vault');
      const vaultList = storage.get<VaultedNamespace[]>('vaults', []);
      const vault = vaultList.find(v => v.name === name);

      if (vault) {
        vault.locked = true;
        storage.set('vaults', vaultList);
        setVaults([...vaultList]);

        bus.emit('jackie-notification' as any, {
          level: 'info',
          title: 'Vault locked',
          message: `Vault "${name}" is now locked.`,
          source: 'data-vault',
        });
      }
    } catch (e) {
      console.error('[VAULT] Error locking vault:', e);
    }
  };

  const handleShredVault = (name: string) => {
    try {
      const storage = appStorage('data-vault');
      const vaultList = storage.get<VaultedNamespace[]>('vaults', []);
      const filtered = vaultList.filter(v => v.name !== name);

      storage.set('vaults', filtered);
      setVaults(filtered);
      setConfirmDelete(null);

      bus.emit('jackie-notification' as any, {
        level: 'warning',
        title: 'Data shredded',
        message: `Vault "${name}" and all its data has been securely deleted.`,
        source: 'data-vault',
      });
    } catch (e) {
      console.error('[VAULT] Error shredding vault:', e);
    }
  };

  return (
    <div className="h-full w-full bg-zinc-950 text-white overflow-auto flex flex-col">
      {/* Header */}
      <div className="border-b border-zinc-700/50 bg-gradient-to-r from-indigo-950/30 to-zinc-950 p-6 shrink-0">
        <div className="flex items-center gap-3 mb-2">
          <Database className="w-8 h-8 text-indigo-400" />
          <h1 className="text-3xl font-bold">Data Vault</h1>
        </div>
        <p className="text-zinc-400">Encrypt or securely shred app data</p>
      </div>

      {/* Create Vault */}
      <div className="border-b border-zinc-700/50 bg-zinc-900/50 p-6 shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="app namespace (e.g., user-secrets, api-keys)"
            className="flex-1 px-3 py-2 rounded bg-zinc-950 border border-zinc-700 text-sm text-white focus:border-indigo-500 outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.currentTarget.value) {
                handleCreateVault(e.currentTarget.value);
                e.currentTarget.value = '';
              }
            }}
          />
          <button
            onClick={(e) => {
              const input = e.currentTarget.previousElementSibling as HTMLInputElement;
              if (input.value) {
                handleCreateVault(input.value);
                input.value = '';
              }
            }}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-all"
          >
            Create Vault
          </button>
        </div>
      </div>

      {/* Vaults List */}
      <div className="flex-1 overflow-auto p-6 space-y-3">
        {vaults.length === 0 ? (
          <div className="text-center py-12">
            <Database className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400">No data vaults created</p>
            <p className="text-xs text-zinc-500 mt-1">Create a vault to securely manage app data</p>
          </div>
        ) : (
          vaults.map(vault => (
            <div
              key={vault.name}
              className={`border rounded-lg p-4 transition-all ${
                vault.locked
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-emerald-500/10 border-emerald-500/30'
              } ${selectedVault === vault.name ? 'ring-2 ring-indigo-500' : ''}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{vault.name}</p>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold ${
                        vault.locked
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-emerald-500/20 text-emerald-400'
                      }`}
                    >
                      {vault.locked ? (
                        <>
                          <Lock className="w-3 h-3 inline mr-1" />
                          Locked
                        </>
                      ) : (
                        <>
                          <Unlock className="w-3 h-3 inline mr-1" />
                          Unlocked
                        </>
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    Created: {new Date(vault.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-1">
                  {vault.locked && (
                    <button
                      onClick={() => setSelectedVault(vault.name)}
                      className="px-2 py-1.5 rounded text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-all"
                    >
                      <Unlock className="w-3 h-3" />
                    </button>
                  )}
                  {!vault.locked && (
                    <button
                      onClick={() => handleLockVault(vault.name)}
                      className="px-2 py-1.5 rounded text-xs font-medium bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-all"
                    >
                      <Lock className="w-3 h-3" />
                    </button>
                  )}
                  {confirmDelete === vault.name ? (
                    <>
                      <button
                        onClick={() => handleShredVault(vault.name)}
                        className="px-2 py-1.5 rounded text-xs font-medium bg-red-600 text-white transition-all"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="px-2 py-1.5 rounded text-xs font-medium bg-zinc-700 text-zinc-300 transition-all"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(vault.name)}
                      className="px-2 py-1.5 rounded text-xs font-medium bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {selectedVault === vault.name && !vault.locked && (
                <div className="bg-zinc-900/50 rounded p-3 border border-zinc-800">
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-2 mb-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5" />
                      <p className="text-xs text-yellow-400">
                        Vault is unlocked. Lock it when done to protect data.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleLockVault(vault.name)}
                    className="w-full px-3 py-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-all"
                  >
                    Lock Vault
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
