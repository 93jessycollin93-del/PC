import * as React from 'react';

import { bus, notify } from '../kernel/bus';
import { vfs } from '../kernel/vfs';
import { applyTheme, DEFAULT_THEME_ID, THEMES } from '../themes';

const THEME_PATH = '/system/session/theme';

/** Theme choice and the session reset. Everything here writes through the VFS. */
export default function SettingsApp() {
  const [themeId, setThemeId] = React.useState(DEFAULT_THEME_ID);

  React.useEffect(() => {
    void vfs()
      .read(THEME_PATH)
      .then((saved) => {
        if (saved) setThemeId(saved);
      })
      .catch(() => {
        /* fall back to the default rather than blocking the panel */
      });
  }, []);

  const choose = async (nextId: string) => {
    setThemeId(nextId);
    applyTheme(nextId);
    bus.emit('theme-changed', { themeId: nextId });
    try {
      await vfs().write(THEME_PATH, nextId);
    } catch (cause) {
      notify('error', 'Settings', cause instanceof Error ? cause.message : String(cause));
    }
  };

  const resetSession = async () => {
    if (!window.confirm('Close all windows and forget the saved layout?')) return;
    try {
      await vfs().remove('/system/session/windows.json');
      notify('info', 'Settings', 'Session cleared — reloading');
      // A reload is the honest way to reach a clean boot: it re-runs the VFS
      // probe and the layout restore exactly as a real boot would.
      setTimeout(() => window.location.reload(), 600);
    } catch (cause) {
      notify('error', 'Settings', cause instanceof Error ? cause.message : String(cause));
    }
  };

  return (
    <div className="settings">
      <div className="settings__section">Theme</div>
      <div className="settings__themes">
        {THEMES.map((theme) => (
          <button
            key={theme.id}
            className={`swatch${theme.id === themeId ? ' swatch--active' : ''}`}
            onClick={() => void choose(theme.id)}
          >
            <span className="swatch__preview">
              {theme.preview.map((colour) => (
                <span key={colour} style={{ background: colour }} />
              ))}
            </span>
            <span className="swatch__label">{theme.label}</span>
            <span className="swatch__desc">{theme.description}</span>
          </button>
        ))}
      </div>

      <div className="settings__section">Session</div>
      <p className="settings__note">
        Window layout and theme are stored in <code>/system/session/</code> on the mounted
        filesystem — <code>{vfs().backend}</code>.
      </p>
      <button className="btn btn--danger" onClick={() => void resetSession()}>
        Reset session
      </button>
    </div>
  );
}
