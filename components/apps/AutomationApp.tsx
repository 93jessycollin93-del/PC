import React, { useEffect, useReducer, useState } from 'react';
import { Zap, Clock, ScrollText, Plus, Trash2, Play, CheckCircle2, XCircle } from 'lucide-react';
import { automationEngine, TRIGGER_CHANNELS, type AutomationRule } from '../../lib/automation';
import { schedulerEngine, describeSchedule, type Schedule, type ScheduledJob } from '../../lib/scheduler';
import { describeAction, ACTION_TYPES, type JackieAction } from '../../lib/actions';
import type { BusChannel } from '../../lib/bus';

/**
 * Automation — UI over the rule engine (#4) and scheduler (#5).
 *
 * Rules: when a Jackie Bus event fires → run an action.
 * Schedules: run an action on an interval / daily / once.
 * Run Log: bounded history of every engine execution.
 */

type Tab = 'rules' | 'schedules' | 'log';

const inputCls =
  'px-2 py-1.5 bg-zinc-950 border border-zinc-700 rounded text-xs text-zinc-300 focus:border-amber-500 outline-none';

/** Shared action form state + builder used by both the rule and job forms. */
interface ActionDraft {
  type: JackieAction['type'];
  appId: string;
  title: string;
  message: string;
  prompt: string;
  text: string;
}

const emptyDraft: ActionDraft = { type: 'notify', appId: '', title: '', message: '', prompt: '', text: '' };

function buildAction(d: ActionDraft): JackieAction | null {
  switch (d.type) {
    case 'launch_app':
      return d.appId.trim() ? { type: 'launch_app', appId: d.appId.trim() } : null;
    case 'notify':
      return d.title.trim() ? { type: 'notify', level: 'info', title: d.title.trim(), message: d.message.trim() || undefined } : null;
    case 'ai_prompt':
      return d.prompt.trim() ? { type: 'ai_prompt', prompt: d.prompt.trim(), notifyResult: true } : null;
    case 'telegram':
      return d.text.trim() ? { type: 'telegram', text: d.text.trim() } : null;
  }
}

const ActionFields: React.FC<{ draft: ActionDraft; onChange: (d: ActionDraft) => void }> = ({ draft, onChange }) => (
  <>
    <select value={draft.type} onChange={e => onChange({ ...draft, type: e.target.value as JackieAction['type'] })} className={inputCls}>
      {ACTION_TYPES.map(a => (
        <option key={a.id} value={a.id}>{a.label}</option>
      ))}
    </select>
    {draft.type === 'launch_app' && (
      <input value={draft.appId} onChange={e => onChange({ ...draft, appId: e.target.value })} placeholder="app id (e.g. mission_control)" className={inputCls} />
    )}
    {draft.type === 'notify' && (
      <>
        <input value={draft.title} onChange={e => onChange({ ...draft, title: e.target.value })} placeholder="notification title" className={inputCls} />
        <input value={draft.message} onChange={e => onChange({ ...draft, message: e.target.value })} placeholder="message (optional)" className={inputCls} />
      </>
    )}
    {draft.type === 'ai_prompt' && (
      <input value={draft.prompt} onChange={e => onChange({ ...draft, prompt: e.target.value })} placeholder="prompt to run" className={`${inputCls} flex-1 min-w-40`} />
    )}
    {draft.type === 'telegram' && (
      <input value={draft.text} onChange={e => onChange({ ...draft, text: e.target.value })} placeholder="message text" className={`${inputCls} flex-1 min-w-40`} />
    )}
  </>
);

const Toggle: React.FC<{ on: boolean; onClick: () => void }> = ({ on, onClick }) => (
  <button
    onClick={onClick}
    className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${on ? 'bg-amber-500' : 'bg-zinc-700'}`}
    title={on ? 'Enabled' : 'Disabled'}
  >
    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? 'left-4' : 'left-0.5'}`} />
  </button>
);

export const AutomationApp: React.FC = () => {
  const [tab, setTab] = useState<Tab>('rules');
  const [, tick] = useReducer((x: number) => x + 1, 0);

  // Rule form
  const [ruleName, setRuleName] = useState('');
  const [ruleChannel, setRuleChannel] = useState<BusChannel>('launch-app');
  const [ruleDraft, setRuleDraft] = useState<ActionDraft>(emptyDraft);

  // Job form
  const [jobName, setJobName] = useState('');
  const [schedKind, setSchedKind] = useState<Schedule['kind']>('interval');
  const [everyMinutes, setEveryMinutes] = useState(30);
  const [dailyTime, setDailyTime] = useState('09:00');
  const [onceAt, setOnceAt] = useState('');
  const [jobDraft, setJobDraft] = useState<ActionDraft>(emptyDraft);

  useEffect(() => {
    const offA = automationEngine.subscribe(tick);
    const offB = schedulerEngine.subscribe(tick);
    return () => {
      offA();
      offB();
    };
  }, []);

  const rules = automationEngine.getRules();
  const jobs = schedulerEngine.getJobs();
  const log = automationEngine.getRunLog();

  const addRule = () => {
    const action = buildAction(ruleDraft);
    if (!action) return;
    automationEngine.addRule(ruleName, ruleChannel, action);
    setRuleName('');
    setRuleDraft(emptyDraft);
  };

  const addJob = () => {
    const action = buildAction(jobDraft);
    if (!action) return;
    let schedule: Schedule;
    if (schedKind === 'interval') {
      schedule = { kind: 'interval', everyMinutes: Math.max(1, everyMinutes) };
    } else if (schedKind === 'daily') {
      const [hh, mm] = dailyTime.split(':').map(Number);
      schedule = { kind: 'daily', hh: hh || 0, mm: mm || 0 };
    } else {
      if (!onceAt) return;
      schedule = { kind: 'once', atISO: new Date(onceAt).toISOString() };
    }
    schedulerEngine.addJob(jobName, schedule, action);
    setJobName('');
    setJobDraft(emptyDraft);
  };

  const TabBtn: React.FC<{ id: Tab; icon: React.ReactNode; label: string; count?: number }> = ({ id, icon, label, count }) => (
    <button
      onClick={() => setTab(id)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-colors ${
        tab === id ? 'bg-amber-600/30 border border-amber-500/50 text-amber-300' : 'text-zinc-400 hover:text-zinc-200'
      }`}
    >
      {icon}
      {label}
      {count !== undefined && <span className="text-[10px] text-zinc-500">({count})</span>}
    </button>
  );

  return (
    <div className="h-full w-full bg-zinc-950 text-zinc-300 font-sans flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-14 border-b border-zinc-800 bg-zinc-900 px-4 flex items-center justify-between shrink-0">
        <h2 className="font-bold text-sm text-white flex items-center gap-2">
          <Zap size={16} className="text-amber-400" />
          Automation
        </h2>
        <div className="flex items-center gap-1">
          <TabBtn id="rules" icon={<Zap size={12} />} label="Rules" count={rules.length} />
          <TabBtn id="schedules" icon={<Clock size={12} />} label="Schedules" count={jobs.length} />
          <TabBtn id="log" icon={<ScrollText size={12} />} label="Run Log" count={log.length} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {tab === 'rules' && (
          <>
            {/* Create rule */}
            <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-3 space-y-2">
              <div className="text-[10px] uppercase tracking-wide text-zinc-500">New rule — when event fires, run action</div>
              <div className="flex flex-wrap items-center gap-2">
                <input value={ruleName} onChange={e => setRuleName(e.target.value)} placeholder="rule name" className={inputCls} />
                <span className="text-xs text-zinc-500">when</span>
                <select value={ruleChannel} onChange={e => setRuleChannel(e.target.value as BusChannel)} className={inputCls}>
                  {TRIGGER_CHANNELS.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <span className="text-xs text-zinc-500">then</span>
                <ActionFields draft={ruleDraft} onChange={setRuleDraft} />
                <button onClick={addRule} className="px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1">
                  <Plus size={12} /> Add
                </button>
              </div>
            </div>

            {/* Rule list */}
            {rules.length === 0 ? (
              <div className="text-xs text-zinc-500 text-center py-6">No rules yet. Try: when <span className="text-zinc-300">launch-app</span> → post a notification.</div>
            ) : (
              rules.map(rule => (
                <div key={rule.id} className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-3 flex items-center gap-3">
                  <Toggle on={rule.enabled} onClick={() => automationEngine.toggleRule(rule.id)} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white font-semibold truncate">{rule.name}</div>
                    <div className="text-[11px] text-zinc-500 truncate">
                      when <span className="text-sky-400">{rule.trigger.channel}</span> → {describeAction(rule.action)}
                    </div>
                    {rule.lastRun && (
                      <div className="text-[10px] text-zinc-600 mt-0.5">
                        {rule.runCount}× · last {new Date(rule.lastRun).toLocaleTimeString()} · {rule.lastResult}
                      </div>
                    )}
                  </div>
                  <button onClick={() => automationEngine.runNow(rule.id)} title="Run now" className="text-zinc-500 hover:text-emerald-400">
                    <Play size={14} />
                  </button>
                  <button onClick={() => automationEngine.removeRule(rule.id)} title="Delete" className="text-zinc-500 hover:text-red-400">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </>
        )}

        {tab === 'schedules' && (
          <>
            {/* Create job */}
            <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-3 space-y-2">
              <div className="text-[10px] uppercase tracking-wide text-zinc-500">New schedule — run action on a timer</div>
              <div className="flex flex-wrap items-center gap-2">
                <input value={jobName} onChange={e => setJobName(e.target.value)} placeholder="job name" className={inputCls} />
                <select value={schedKind} onChange={e => setSchedKind(e.target.value as Schedule['kind'])} className={inputCls}>
                  <option value="interval">every N minutes</option>
                  <option value="daily">daily at time</option>
                  <option value="once">once at date/time</option>
                </select>
                {schedKind === 'interval' && (
                  <input type="number" min={1} value={everyMinutes} onChange={e => setEveryMinutes(Number(e.target.value))} className={`${inputCls} w-20`} />
                )}
                {schedKind === 'daily' && (
                  <input type="time" value={dailyTime} onChange={e => setDailyTime(e.target.value)} className={inputCls} />
                )}
                {schedKind === 'once' && (
                  <input type="datetime-local" value={onceAt} onChange={e => setOnceAt(e.target.value)} className={inputCls} />
                )}
                <span className="text-xs text-zinc-500">do</span>
                <ActionFields draft={jobDraft} onChange={setJobDraft} />
                <button onClick={addJob} className="px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1">
                  <Plus size={12} /> Add
                </button>
              </div>
            </div>

            {/* Job list */}
            {jobs.length === 0 ? (
              <div className="text-xs text-zinc-500 text-center py-6">No scheduled jobs yet.</div>
            ) : (
              jobs.map(job => (
                <div key={job.id} className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-3 flex items-center gap-3">
                  <Toggle on={job.enabled} onClick={() => schedulerEngine.toggleJob(job.id)} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white font-semibold truncate">{job.name}</div>
                    <div className="text-[11px] text-zinc-500 truncate">
                      <span className="text-sky-400">{describeSchedule(job.schedule)}</span> → {describeAction(job.action)}
                    </div>
                    <div className="text-[10px] text-zinc-600 mt-0.5">
                      {job.runCount}× · {job.enabled ? `next ${new Date(job.nextRun).toLocaleString()}` : 'paused'}
                      {job.lastResult ? ` · ${job.lastResult}` : ''}
                    </div>
                  </div>
                  <button onClick={() => schedulerEngine.runNow(job.id)} title="Run now" className="text-zinc-500 hover:text-emerald-400">
                    <Play size={14} />
                  </button>
                  <button onClick={() => schedulerEngine.removeJob(job.id)} title="Delete" className="text-zinc-500 hover:text-red-400">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </>
        )}

        {tab === 'log' && (
          log.length === 0 ? (
            <div className="text-xs text-zinc-500 text-center py-6">No runs yet.</div>
          ) : (
            <div className="space-y-1.5">
              {log.map((e, i) => (
                <div key={i} className="bg-zinc-900/70 border border-zinc-800 rounded p-2 flex items-center gap-2 text-xs">
                  {e.ok ? <CheckCircle2 size={13} className="text-emerald-400 shrink-0" /> : <XCircle size={13} className="text-red-400 shrink-0" />}
                  <span className="text-zinc-500 shrink-0">{new Date(e.at).toLocaleTimeString()}</span>
                  <span className="text-zinc-200 font-semibold truncate">{e.source}</span>
                  <span className="text-zinc-500 truncate">{e.detail}</span>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Footer */}
      <div className="h-9 border-t border-zinc-800 bg-zinc-900 px-4 flex items-center text-[11px] text-zinc-500 shrink-0">
        Rules react to Jackie Bus events · Schedules tick every 30s · actions respect the Permission Broker
      </div>
    </div>
  );
};

export default AutomationApp;
