import * as React from 'react';

import { bus, type BusChannels } from '../kernel/bus';

type Toast = BusChannels['notification'];

const VISIBLE_MS = 4500;

/**
 * Toasts are the bus made visible: this component subscribes to one channel
 * and knows about no app in particular. Anything that can reach `notify()`
 * can surface a message here, including code that has no UI of its own.
 */
export function Notifications() {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  React.useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const unsubscribe = bus.on('notification', (toast) => {
      setToasts((prev) => [...prev.slice(-4), toast]);
      const timer = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
        timers.delete(timer);
      }, VISIBLE_MS);
      timers.add(timer);
    });
    return () => {
      unsubscribe();
      timers.forEach(clearTimeout);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.level}`}>
          <div className="toast__title">{toast.title}</div>
          {toast.body && <div className="toast__body">{toast.body}</div>}
        </div>
      ))}
    </div>
  );
}
