import * as React from 'react';

import { bus } from '../kernel/bus';
import { APPS } from '../kernel/registry';
import { useWindows } from '../kernel/windows';
import { vfs } from '../kernel/vfs';

const BOOT_AT = Date.now();

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/**
 * What the shell can honestly say about itself: which storage backend won the
 * probe at boot, how long this session has been up, and every message that has
 * crossed the bus.
 *
 * The trace is the interesting part. "Apps only communicate through the bus"
 * is a claim about the architecture, and this renders the evidence for it
 * rather than asking you to trust the README.
 */
export default function SystemInfoApp() {
  const { windows } = useWindows();
  const [, forceTick] = React.useReducer((n: number) => n + 1, 0);
  const [trace, setTrace] = React.useState(() => bus.history());

  React.useEffect(() => {
    const timer = setInterval(forceTick, 1000);
    return () => clearInterval(timer);
  }, []);

  // Re-read the trace whenever anything at all is published.
  React.useEffect(() => {
    const channels = [
      'window-opened',
      'window-closed',
      'window-focused',
      'vfs-changed',
      'notification',
      'theme-changed',
      'open-file',
    ] as const;
    const unsubscribes = channels.map((channel) =>
      bus.on(channel, () => setTrace(bus.history())),
    );
    return () => unsubscribes.forEach((off) => off());
  }, []);

  const fs = vfs();
  const rows: Array<[string, string]> = [
    ['Shell', 'Jackie OS shell (dev build)'],
    ['Storage backend', fs.backend],
    ['Durable', fs.durable ? 'yes — survives reboot' : 'no — browser profile only'],
    ['Session uptime', formatUptime(Date.now() - BOOT_AT)],
    ['Apps registered', String(APPS.length)],
    ['Windows open', String(windows.length)],
    ['Renderer', typeof navigator === 'undefined' ? 'unknown' : navigator.userAgent],
    [
      'Viewport',
      typeof window === 'undefined' ? 'unknown' : `${window.innerWidth}×${window.innerHeight}`,
    ],
  ];

  return (
    <div className="sysinfo">
      <table className="sysinfo__table">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <th>{label}</th>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="sysinfo__head">
        IPC trace <span className="sysinfo__count">{trace.length} messages</span>
      </div>
      <div className="sysinfo__trace">
        {trace.length === 0 && <div className="sysinfo__empty">Nothing on the bus yet.</div>}
        {trace
          .slice()
          .reverse()
          .map((entry, index) => (
            <div key={`${entry.at}-${index}`} className="sysinfo__event">
              <span className="sysinfo__time">
                {new Date(entry.at).toLocaleTimeString([], { hour12: false })}
              </span>
              <span className="sysinfo__channel">{entry.channel}</span>
              <span className="sysinfo__payload">{JSON.stringify(entry.payload)}</span>
            </div>
          ))}
      </div>
    </div>
  );
}
