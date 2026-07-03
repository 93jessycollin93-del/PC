import React, { useState, useEffect } from 'react';
import { Shield, Check, X, Clock, AlertTriangle } from 'lucide-react';

/**
 * Mobile approval queue for SAS Hub's policy engine.
 *
 * NOTE ON THE DATA SOURCE: the original version of this component read/wrote
 * `command_center_audit` from localStorage. That only works if the approver's
 * phone is the SAME browser session that queued the action — which won't be
 * true in practice (an action gets queued from the workstation, approved from
 * a phone). This version fetches from and posts to SAS Hub's backend instead,
 * so approvals actually reach the system that's waiting on them.
 *
 * Backend contract this expects (add to jacky_api.py if not already present):
 *   GET  /api/audit?status=pending_approval  -> { actions: [...] }
 *   POST /api/audit/<action_id>/decide       -> { decision: "approved"|"denied" }
 * These should read/write the same audit store `/api/logs` already uses, not
 * a separate table — one audit trail, not two.
 */

const SAS_BASE = window.SAS_API_BASE || '';

function authHeaders() {
  const token = window.SAS_AUTH_TOKEN || localStorage.getItem('sas_token') || '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function MobileApprovals({ currentUser }) {
  const [pendingActions, setPendingActions] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`${SAS_BASE}/api/audit?status=pending_approval`, {
          headers: authHeaders()
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setPendingActions(data.actions || []);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    };

    load();
    const id = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const handleApproval = async (actionId, decision) => {
    // Optimistic UI update — remove immediately, backend call confirms.
    setPendingActions(p => p.filter(a => a.action_id !== actionId));

    try {
      const res = await fetch(`${SAS_BASE}/api/audit/${actionId}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ decision, approved_by: currentUser?.id })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      // Roll back on failure — the action wasn't actually decided.
      setError(`Failed to ${decision} action: ${e.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 bg-zinc-950 border-b border-zinc-800 p-4">
        <h1 className="font-bold flex items-center gap-2">
          <Shield className="w-5 h-5 text-green-400" /> Approvals
        </h1>
      </header>

      <div className="p-4">
        <p className="text-2xl font-bold">{pendingActions.length}</p>
        <p className="text-xs text-zinc-500">Pending</p>
        {error && (
          <p className="text-xs text-red-400 flex items-center gap-1 mt-2">
            <AlertTriangle className="w-3 h-3" /> {error}
          </p>
        )}
      </div>

      <div className="divide-y divide-zinc-900">
        {pendingActions.length === 0 && !error && (
          <div className="p-8 text-center text-zinc-600 flex flex-col items-center gap-2">
            <Clock className="w-6 h-6" />
            <p className="text-sm">Nothing waiting on you.</p>
          </div>
        )}
        {pendingActions.map(a => (
          <div key={a.action_id} className="p-4">
            <p className="font-medium">{a.domain}.{a.action_type}</p>
            <p className="text-xs text-zinc-500">
              {new Date(a.created_at).toLocaleTimeString()}
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => handleApproval(a.action_id, 'denied')}
                className="flex-1 py-2 bg-zinc-900 rounded-lg flex items-center justify-center gap-1"
              >
                <X className="w-4 h-4" /> Deny
              </button>
              <button
                onClick={() => handleApproval(a.action_id, 'approved')}
                className="flex-1 py-2 bg-green-600 text-black rounded-lg flex items-center justify-center gap-1"
              >
                <Check className="w-4 h-4" /> Approve
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
