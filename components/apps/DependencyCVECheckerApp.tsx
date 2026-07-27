import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Package, RotateCw } from 'lucide-react';
import { aiClient } from '../../lib/aiClient';
import { permissions, GLOBAL_SCOPE } from '../../lib/permissions';

interface Vulnerability {
  name: string;
  severity: 'critical' | 'high' | 'moderate' | 'low';
  version: string;
  fixAvailable: boolean;
  description?: string;
  cve?: string[];
}

interface AuditResult {
  vulnerabilities?: Record<string, { severity: string; fixAvailable: boolean; description?: string; cves?: string[] }>;
  metadata?: { vulnerabilities: number; dependencies: number };
}

export const DependencyCVECheckerApp: React.FC = () => {
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);

  const runAudit = async () => {
    setLoading(true);
    setError(null);
    setCached(false);

    try {
      // Check permissions
      if (!permissions.can(GLOBAL_SCOPE, 'network')) {
        setError('Permission denied: network access required for CVE audit');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/security/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Audit request failed: ${response.status}`);
      }

      const result = await response.json() as AuditResult & { cached?: boolean };
      setCached(result.cached || false);
      setAudit(result);

      // Parse vulnerabilities
      const vulns: Vulnerability[] = [];
      if (result.vulnerabilities) {
        Object.entries(result.vulnerabilities).forEach(([name, data]: [string, any]) => {
          vulns.push({
            name,
            severity: (data.severity || 'low') as 'critical' | 'high' | 'moderate' | 'low',
            version: data.version || 'unknown',
            fixAvailable: data.fixAvailable || false,
            description: data.description || data.title || '',
            cve: data.cves || data.cve || [],
          });
        });
      }

      // Sort by severity
      const severityOrder = { critical: 0, high: 1, moderate: 2, low: 3 };
      vulns.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

      setVulnerabilities(vulns);
    } catch (err) {
      setError(String(err));
    }

    setLoading(false);
  };

  useEffect(() => {
    runAudit();
  }, []);

  const totalVulns = vulnerabilities.length;
  const criticalCount = vulnerabilities.filter(v => v.severity === 'critical').length;
  const highCount = vulnerabilities.filter(v => v.severity === 'high').length;
  const fixableCount = vulnerabilities.filter(v => v.fixAvailable).length;

  const severityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500/10 border-red-500/30 text-red-400';
      case 'high':
        return 'bg-orange-500/10 border-orange-500/30 text-orange-400';
      case 'moderate':
        return 'bg-amber-500/10 border-amber-500/30 text-amber-400';
      default:
        return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
    }
  };

  const severityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return <AlertTriangle className="w-4 h-4" />;
      case 'moderate':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Package className="w-4 h-4" />;
    }
  };

  return (
    <div className="h-full w-full bg-zinc-950 text-white overflow-auto">
      {/* Header */}
      <div className="border-b border-zinc-700/50 bg-gradient-to-r from-red-950/30 to-zinc-950 p-6">
        <div className="flex items-center gap-3 mb-2">
          <Package className="w-8 h-8 text-red-400" />
          <h1 className="text-3xl font-bold">Dependency & CVE Checker</h1>
        </div>
        <p className="text-zinc-400">npm audit results — vulnerabilities, severity, and fixes</p>
      </div>

      {/* Summary */}
      {audit && (
        <div className="border-b border-zinc-700/50 bg-zinc-900/50 p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-zinc-400 mb-1">Total Vulnerabilities</p>
              <p className="text-2xl font-bold">{totalVulns}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-400 mb-1">Critical</p>
              <p className="text-2xl font-bold text-red-400">{criticalCount}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-400 mb-1">High</p>
              <p className="text-2xl font-bold text-orange-400">{highCount}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-400 mb-1">Fixable</p>
              <p className="text-2xl font-bold text-emerald-400">{fixableCount}</p>
            </div>
          </div>
          <div className="flex gap-2 mt-6">
            <button
              onClick={() => runAudit()}
              disabled={loading}
              className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all ${
                loading
                  ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                  : 'bg-sky-600 hover:bg-sky-700 text-white'
              }`}
            >
              <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Scanning...' : 'Re-scan'}
            </button>
            {cached && (
              <div className="px-4 py-2 rounded-lg bg-amber-500/10 text-amber-400 text-sm flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Cached (1 hour)
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="p-6 bg-red-500/10 border-b border-red-500/30 text-red-400">
          <p className="font-medium">Error running audit</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Vulnerabilities */}
      <div className="p-6 space-y-3">
        {vulnerabilities.length === 0 ? (
          <div className="text-center py-12">
            {loading ? (
              <div className="text-zinc-400">Running audit...</div>
            ) : (
              <div>
                <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <p className="text-emerald-400 font-medium">No known vulnerabilities</p>
                <p className="text-zinc-400 text-sm">Your dependencies are up to date.</p>
              </div>
            )}
          </div>
        ) : (
          vulnerabilities.map(vuln => (
            <div
              key={`${vuln.name}@${vuln.version}`}
              className={`border rounded-lg p-4 ${severityColor(vuln.severity)}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-start gap-3 flex-1">
                  {severityIcon(vuln.severity)}
                  <div>
                    <p className="font-medium">{vuln.name}@{vuln.version}</p>
                    {vuln.description && (
                      <p className="text-xs text-zinc-400 mt-1">{vuln.description}</p>
                    )}
                    {vuln.cve && vuln.cve.length > 0 && (
                      <p className="text-xs text-zinc-500 mt-1">
                        CVE: {vuln.cve.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    vuln.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                    vuln.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                    vuln.severity === 'moderate' ? 'bg-amber-500/20 text-amber-400' :
                    'bg-blue-500/20 text-blue-400'
                  }`}>
                    {vuln.severity.toUpperCase()}
                  </span>
                  {vuln.fixAvailable && (
                    <span className="px-2 py-1 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400">
                      FIXABLE
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
