import React, { useState, useEffect } from 'react';
import { AlertTriangle, TrendingUp, CheckCircle, Zap, Trash2 } from 'lucide-react';
import { anomalyDetector, type AnomalyAlert } from '../../lib/anomalyDetector';
import { bus } from '../../lib/bus';

export const AnomalyAlertApp: React.FC = () => {
  const [alerts, setAlerts] = useState<AnomalyAlert[]>([]);
  const [threshold, setThreshold] = useState(3);

  useEffect(() => {
    refreshAlerts();

    const unsubNotif = bus.on('jackie-notification' as any, () => {
      setTimeout(refreshAlerts, 500);
    });

    const interval = setInterval(refreshAlerts, 5000);
    return () => {
      unsubNotif();
      clearInterval(interval);
    };
  }, []);

  const refreshAlerts = () => {
    setAlerts(anomalyDetector.getAlerts());
  };

  const handleResolve = (id: string) => {
    anomalyDetector.resolveAlert(id);
    refreshAlerts();
  };

  const handleClearAll = () => {
    anomalyDetector.clearAlerts();
    refreshAlerts();
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500/10 border-red-500/30';
      case 'warning':
        return 'bg-orange-500/10 border-orange-500/30';
      default:
        return 'bg-yellow-500/10 border-yellow-500/30';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-5 h-5 text-red-400" />;
      case 'warning':
        return <TrendingUp className="w-5 h-5 text-orange-400" />;
      default:
        return <Zap className="w-5 h-5 text-yellow-400" />;
    }
  };

  return (
    <div className="h-full w-full bg-zinc-950 text-white overflow-auto flex flex-col">
      {/* Header */}
      <div className="border-b border-zinc-700/50 bg-gradient-to-r from-red-950/30 to-zinc-950 p-6 shrink-0">
        <div className="flex items-center gap-3 mb-2">
          <AlertTriangle className="w-8 h-8 text-red-400" />
          <h1 className="text-3xl font-bold">Anomaly & Alerts</h1>
        </div>
        <p className="text-zinc-400">Detect unusual spending and execution patterns</p>
      </div>

      {/* Stats */}
      <div className="border-b border-zinc-700/50 bg-zinc-900/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-zinc-400 mb-1">Active Alerts</p>
              <p className={`text-2xl font-bold ${alerts.length > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {alerts.length}
              </p>
            </div>
            <div>
              <p className="text-sm text-zinc-400 mb-1">Critical</p>
              <p className="text-2xl font-bold text-red-400">{alerts.filter(a => a.severity === 'critical').length}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-400 mb-1">Warnings</p>
              <p className="text-2xl font-bold text-orange-400">{alerts.filter(a => a.severity === 'warning').length}</p>
            </div>
          </div>
          {alerts.length > 0 && (
            <button
              onClick={handleClearAll}
              className="px-4 py-2 rounded-lg bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white font-medium flex items-center gap-2 transition-all"
            >
              <Trash2 className="w-4 h-4" />
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Alerts List */}
      <div className="flex-1 overflow-auto p-6 space-y-3">
        {alerts.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
            <p className="text-zinc-400">No active alerts</p>
            <p className="text-xs text-zinc-500 mt-1">All systems operating within normal parameters</p>
          </div>
        ) : (
          alerts.map(alert => (
            <div
              key={alert.id}
              className={`border rounded-lg p-4 ${getSeverityColor(alert.severity)}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-start gap-3 flex-1">
                  {getSeverityIcon(alert.severity)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm">{alert.title}</p>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold ${
                          alert.severity === 'critical'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-orange-500/20 text-orange-400'
                        }`}
                      >
                        {alert.severity.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-300">{alert.message}</p>
                    <div className="mt-2 flex gap-4 text-xs text-zinc-500">
                      <span>Actual: {alert.actual.toFixed(2)}</span>
                      <span>Threshold: {alert.threshold.toFixed(2)}</span>
                      <span>{new Date(alert.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleResolve(alert.id)}
                  className="px-3 py-2 rounded text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-all whitespace-nowrap"
                >
                  Resolve
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
