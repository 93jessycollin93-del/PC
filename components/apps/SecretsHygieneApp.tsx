import React, { useState, useEffect } from 'react';
import { Key, AlertCircle, CheckCircle, Clock, RotateCcw, AlertTriangle } from 'lucide-react';
import { secretsVault } from '../../lib/secretsVault';

interface SecretStatus {
  name: string;
  provider?: string;
  ageMs: number;
  rotatedAt?: number;
  expiresAt?: number;
  isExpired: boolean;
  daysUntilExpiry?: number;
  needsRotation: boolean;
  tags?: string[];
}

export const SecretsHygieneApp: React.FC = () => {
  const [secrets, setSecrets] = useState<SecretStatus[]>([]);
  const [stats, setStats] = useState({ total: 0, expired: 0, expiringSoon: 0, rotationDue: 0 });

  useEffect(() => {
    const entries = secretsVault.listSecrets();
    const now = Date.now();
    const ROTATION_INTERVAL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
    const EXPIRY_WARNING_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

    const secretStatuses = entries.map(entry => {
      const createdAt = entry.createdAt || now;
      const rotatedAt = entry.rotatedAt || createdAt;
      const expiresAt = entry.expiresAt;
      const ageMs = now - createdAt;
      const daysSinceRotation = (now - rotatedAt) / (1000 * 60 * 60 * 24);
      const isExpired = expiresAt ? now > expiresAt : false;
      const daysUntilExpiry = expiresAt ? (expiresAt - now) / (1000 * 60 * 60 * 24) : undefined;
      const needsRotation = daysSinceRotation > 90; // Rotation due after 90 days

      return {
        name: entry.name,
        provider: entry.provider,
        ageMs,
        rotatedAt,
        expiresAt,
        isExpired,
        daysUntilExpiry,
        needsRotation,
        tags: entry.tags,
      };
    });

    setSecrets(secretStatuses);

    // Calculate stats
    const stats = {
      total: secretStatuses.length,
      expired: secretStatuses.filter(s => s.isExpired).length,
      expiringSoon: secretStatuses.filter(s => s.daysUntilExpiry !== undefined && s.daysUntilExpiry > 0 && s.daysUntilExpiry <= 7).length,
      rotationDue: secretStatuses.filter(s => s.needsRotation).length,
    };

    setStats(stats);
  }, []);

  const formatDays = (ms: number): string => {
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return '1 day ago';
    return `${days} days ago`;
  };

  const formatExpiryStatus = (daysUntilExpiry?: number): string => {
    if (daysUntilExpiry === undefined) return 'No expiry set';
    if (daysUntilExpiry < 0) return 'Expired';
    if (daysUntilExpiry === 0) return 'Expires today';
    if (daysUntilExpiry === 1) return 'Expires tomorrow';
    return `Expires in ${Math.ceil(daysUntilExpiry)} days`;
  };

  const getHealthStatus = (secret: SecretStatus): 'critical' | 'warning' | 'caution' | 'healthy' => {
    if (secret.isExpired) return 'critical';
    if (secret.needsRotation) return 'warning';
    if (secret.daysUntilExpiry !== undefined && secret.daysUntilExpiry <= 7) return 'caution';
    return 'healthy';
  };

  const getStatusColor = (status: 'critical' | 'warning' | 'caution' | 'healthy') => {
    switch (status) {
      case 'critical':
        return 'bg-red-500/10 border-red-500/30';
      case 'warning':
        return 'bg-orange-500/10 border-orange-500/30';
      case 'caution':
        return 'bg-amber-500/10 border-amber-500/30';
      default:
        return 'bg-emerald-500/10 border-emerald-500/30';
    }
  };

  const getStatusIcon = (status: 'critical' | 'warning' | 'caution' | 'healthy') => {
    switch (status) {
      case 'critical':
        return <AlertTriangle className="w-5 h-5 text-red-400" />;
      case 'warning':
        return <Clock className="w-5 h-5 text-orange-400" />;
      case 'caution':
        return <AlertCircle className="w-5 h-5 text-amber-400" />;
      default:
        return <CheckCircle className="w-5 h-5 text-emerald-400" />;
    }
  };

  return (
    <div className="h-full w-full bg-zinc-950 text-white overflow-auto">
      {/* Header */}
      <div className="border-b border-zinc-700/50 bg-gradient-to-r from-amber-950/30 to-zinc-950 p-6">
        <div className="flex items-center gap-3 mb-2">
          <Key className="w-8 h-8 text-amber-400" />
          <h1 className="text-3xl font-bold">Secrets Hygiene</h1>
        </div>
        <p className="text-zinc-400">API key ages, rotation status, and expiration tracking</p>
      </div>

      {/* Stats */}
      {stats.total > 0 && (
        <div className="border-b border-zinc-700/50 bg-zinc-900/50 p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-zinc-400 mb-1">Total Keys</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-400 mb-1">Expired</p>
              <p className={`text-2xl font-bold ${stats.expired > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {stats.expired}
              </p>
            </div>
            <div>
              <p className="text-sm text-zinc-400 mb-1">Expiring Soon (7d)</p>
              <p className={`text-2xl font-bold ${stats.expiringSoon > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {stats.expiringSoon}
              </p>
            </div>
            <div>
              <p className="text-sm text-zinc-400 mb-1">Rotation Due (90d)</p>
              <p className={`text-2xl font-bold ${stats.rotationDue > 0 ? 'text-orange-400' : 'text-emerald-400'}`}>
                {stats.rotationDue}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Secrets List */}
      <div className="p-6 space-y-3">
        {secrets.length === 0 ? (
          <div className="text-center py-12">
            <Key className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400">No secrets stored in vault</p>
            <p className="text-xs text-zinc-500 mt-1">Open Secrets Vault to add API keys</p>
          </div>
        ) : (
          secrets.map(secret => {
            const status = getHealthStatus(secret);
            return (
              <div
                key={secret.name}
                className={`border rounded-lg p-4 ${getStatusColor(status)}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3 flex-1">
                    {getStatusIcon(status)}
                    <div>
                      <p className="font-medium">{secret.name}</p>
                      {secret.provider && (
                        <p className="text-xs text-zinc-500">Provider: {secret.provider}</p>
                      )}
                      {secret.tags && secret.tags.length > 0 && (
                        <p className="text-xs text-zinc-500">Tags: {secret.tags.join(', ')}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="bg-zinc-900/50 rounded p-2">
                    <p className="text-zinc-500 mb-1">Created</p>
                    <p className="font-mono text-zinc-300">{formatDays(secret.ageMs)}</p>
                  </div>

                  <div className="bg-zinc-900/50 rounded p-2">
                    <p className="text-zinc-500 mb-1">Last Rotated</p>
                    {secret.rotatedAt ? (
                      <p className="font-mono text-zinc-300">{formatDays(Date.now() - secret.rotatedAt)}</p>
                    ) : (
                      <p className="font-mono text-zinc-400">Never</p>
                    )}
                  </div>

                  <div className="bg-zinc-900/50 rounded p-2">
                    <p className="text-zinc-500 mb-1">Expiry</p>
                    <p className={`font-mono ${secret.isExpired ? 'text-red-400' : secret.daysUntilExpiry !== undefined && secret.daysUntilExpiry <= 7 ? 'text-amber-400' : 'text-zinc-300'}`}>
                      {formatExpiryStatus(secret.daysUntilExpiry)}
                    </p>
                  </div>
                </div>

                {(secret.isExpired || secret.needsRotation) && (
                  <div className="mt-3 flex gap-2">
                    {secret.isExpired && (
                      <span className="px-2 py-1 rounded text-xs font-bold bg-red-500/20 text-red-400 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        EXPIRED
                      </span>
                    )}
                    {secret.needsRotation && !secret.isExpired && (
                      <span className="px-2 py-1 rounded text-xs font-bold bg-orange-500/20 text-orange-400 flex items-center gap-1">
                        <RotateCcw className="w-3 h-3" />
                        ROTATION DUE
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
