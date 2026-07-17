import React, { useState, useEffect } from 'react';
import { ShieldAlert, Lock, CheckCircle, AlertCircle, BarChart3, Settings } from 'lucide-react';
import { secretsVault } from '../../lib/secretsVault';
import { permissions } from '../../lib/permissions';
import { bus } from '../../lib/bus';

export const SecurityCenterApp: React.FC = () => {
  const [tab, setTab] = useState<'overview' | 'vault' | 'permissions' | 'denials'>('overview');
  const [vaultStatus, setVaultStatus] = useState<'locked' | 'unlocked' | 'uninitialized'>('uninitialized');
  const [denials, setDenials] = useState<Array<{ time: number; scope: string; capability: string; detail?: string }>>([]);
  const [providerHealth, setProviderHealth] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Vault status
    if (secretsVault.isInitialized()) {
      setVaultStatus('unlocked');
    } else if (localStorage.getItem('secrets-vault::vault')) {
      setVaultStatus('locked');
    } else {
      setVaultStatus('uninitialized');
    }
  }, []);

  useEffect(() => {
    // Listen for permission denials
    const handleDenial = (detail: { scope: string; capability: string; detail?: string }) => {
      setDenials(prev => [{ time: Date.now(), ...detail }, ...prev.slice(0, 49)]);
    };
    return bus.on('permission-denied', handleDenial);
  }, []);

  const getStatusColor = (status: string) => {
    if (status === 'unlocked') return 'text-emerald-400';
    if (status === 'locked') return 'text-amber-400';
    return 'text-red-400';
  };

  const getStatusIcon = (status: string) => {
    if (status === 'unlocked') return CheckCircle;
    if (status === 'locked') return AlertCircle;
    return ShieldAlert;
  };

  const StatusIcon = getStatusIcon(vaultStatus);

  return (
    <div className="h-full w-full bg-zinc-950 text-white overflow-auto">
      {/* Header */}
      <div className="border-b border-zinc-700/50 bg-gradient-to-r from-red-950/30 to-zinc-950 p-6">
        <div className="flex items-center gap-3 mb-2">
          <ShieldAlert className="w-8 h-8 text-red-400" />
          <h1 className="text-3xl font-bold">Security Center</h1>
        </div>
        <p className="text-zinc-400">Vault, permissions, and security event monitoring</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-700/50 bg-zinc-900/50">
        {['overview', 'vault', 'permissions', 'denials'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t as any)}
            className={`px-6 py-3 font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-sky-400 text-sky-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-300'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-8">
        {tab === 'overview' && (
          <div className="space-y-6">
            {/* Vault Status Card */}
            <div className="bg-zinc-900 border border-zinc-700/50 rounded-xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Lock className={`w-6 h-6 ${getStatusColor(vaultStatus)}`} />
                  <div>
                    <h3 className="text-xl font-semibold">Secrets Vault</h3>
                    <p className="text-sm text-zinc-400">Encrypted API key storage</p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  vaultStatus === 'unlocked' ? 'bg-emerald-500/20 text-emerald-400' :
                  vaultStatus === 'locked' ? 'bg-amber-500/20 text-amber-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {vaultStatus === 'unlocked' ? 'Unlocked' : vaultStatus === 'locked' ? 'Locked' : 'Not Set Up'}
                </span>
              </div>

              <div className="space-y-2 text-sm">
                {vaultStatus === 'unlocked' && (
                  <>
                    <p className="text-emerald-400">✓ Vault is unlocked and ready to use</p>
                    <p className="text-zinc-400">Secrets: {secretsVault.listSecrets().length} stored</p>
                  </>
                )}
                {vaultStatus === 'locked' && (
                  <p className="text-amber-400">⚠ Vault exists but is locked. Unlock via Secrets Vault app.</p>
                )}
                {vaultStatus === 'uninitialized' && (
                  <p className="text-red-400">✗ Vault not initialized. Set up in Secrets Vault app.</p>
                )}
              </div>
            </div>

            {/* Permission Posture Card */}
            <div className="bg-zinc-900 border border-zinc-700/50 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Settings className="w-6 h-6 text-sky-400" />
                <div>
                  <h3 className="text-xl font-semibold">Permission Posture</h3>
                  <p className="text-sm text-zinc-400">App capability restrictions</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm">
                {(['model_access', 'spend', 'filesystem'] as const).map(cap => (
                  <div key={cap} className="bg-zinc-800/50 rounded-lg p-3">
                    <p className="text-zinc-400 mb-2">{cap.replace('_', ' ')}</p>
                    <p className="text-emerald-400 font-medium">Global: Allow</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Denials Card */}
            <div className="bg-zinc-900 border border-zinc-700/50 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <AlertCircle className="w-6 h-6 text-amber-400" />
                <div>
                  <h3 className="text-xl font-semibold">Recent Permission Denials</h3>
                  <p className="text-sm text-zinc-400">Last 10 blocked actions</p>
                </div>
              </div>

              {denials.length === 0 ? (
                <p className="text-zinc-500 text-sm">No permission denials</p>
              ) : (
                <div className="space-y-2 text-sm">
                  {denials.slice(0, 10).map((d, i) => (
                    <div key={i} className="flex items-center justify-between bg-zinc-800/50 p-3 rounded">
                      <div>
                        <p className="text-zinc-300">{d.scope} · {d.capability}</p>
                        {d.detail && <p className="text-zinc-500 text-xs">{d.detail}</p>}
                      </div>
                      <p className="text-zinc-500 text-xs">{new Date(d.time).toLocaleTimeString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'vault' && (
          <div className="space-y-4">
            <div className="bg-zinc-900 border border-zinc-700/50 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">Stored Secrets</h3>

              {secretsVault.listSecrets().length === 0 ? (
                <p className="text-zinc-500">No secrets stored yet</p>
              ) : (
                <div className="space-y-2">
                  {secretsVault.listSecrets().map(entry => (
                    <div key={entry.name} className="flex items-center justify-between bg-zinc-800/50 p-3 rounded">
                      <div>
                        <p className="font-medium">{entry.name}</p>
                        {entry.provider && <p className="text-sm text-zinc-400">Provider: {entry.provider}</p>}
                      </div>
                      <span className="text-xs text-zinc-500">
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'permissions' && (
          <div className="space-y-4">
            <div className="bg-blue-950/30 border border-blue-700/50 rounded-xl p-4 text-sm">
              <p className="text-blue-300">See <span className="font-mono text-blue-400">Permissions</span> app for detailed capability management per scope.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {(['model_access', 'spend', 'network', 'filesystem', 'shell', 'clipboard'] as const).map(cap => (
                <div key={cap} className="bg-zinc-900 border border-zinc-700/50 rounded-xl p-4">
                  <p className="font-medium text-sm mb-2">{cap.replace('_', ' ')}</p>
                  <p className="text-xs text-emerald-400">✓ Enabled by default</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'denials' && (
          <div className="bg-zinc-900 border border-zinc-700/50 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">Permission Denial Log</h3>
            {denials.length === 0 ? (
              <p className="text-zinc-500">No denials recorded</p>
            ) : (
              <div className="space-y-3">
                {denials.map((d, i) => (
                  <div key={i} className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700/30">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium">{d.scope}</p>
                        <p className="text-sm text-zinc-400">Denied: {d.capability}</p>
                      </div>
                      <p className="text-xs text-zinc-500">{new Date(d.time).toLocaleTimeString()}</p>
                    </div>
                    {d.detail && (
                      <p className="text-xs text-zinc-400 mt-2">Detail: {d.detail}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
