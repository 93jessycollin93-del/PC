import * as React from 'react';
import { createRoot } from 'react-dom/client';

import { Desktop } from './ui/Desktop';
import { WindowManagerProvider } from './kernel/windows';
import { openVfs, vfs } from './kernel/vfs';
import { applyTheme, DEFAULT_THEME_ID } from './themes';
import './styles.css';

/**
 * Boot.
 *
 * Order matters and is enforced rather than hoped for: the VFS must be mounted
 * before any component renders, because the window manager reads the saved
 * layout in its first effect and `vfs()` throws if the probe has not resolved.
 * Nothing mounts until `openVfs()` has picked a backend.
 */

const README = `eYe OS — shell
=================

This is the desktop, running on whichever filesystem won the probe at boot.
Open System Info to see which one that is.

Try this:

  1. Open Terminal and run:  df
     It prints the mounted backend. In a browser tab it says localStorage.
     On the booted disk image it says host filesystem.

  2. Still in Terminal:      write /home/hello.txt from the terminal
  3. Open Files, go to /home — hello.txt is already there.
     Neither app imports the other; they share the VFS and the bus.
  4. Open System Info and watch the IPC trace fill up as you click.

Everything under /system is the shell's own state. Deleting
/system/session/windows.json resets the desktop layout.
`;

/** First-boot seed. Skipped entirely if /system/.seeded already exists. */
async function seedFilesystem(): Promise<void> {
  const fs = vfs();
  if ((await fs.read('/system/.seeded')) !== null) return;
  await fs.mkdir('/home');
  await fs.mkdir('/system/session');
  await fs.write('/home/README.txt', README);
  await fs.write('/system/.seeded', new Date().toISOString());
}

async function boot(): Promise<void> {
  await openVfs();

  try {
    await seedFilesystem();
  } catch {
    // A read-only or full disk still gives you a usable desktop.
  }

  let themeId = DEFAULT_THEME_ID;
  try {
    themeId = (await vfs().read('/system/session/theme')) ?? DEFAULT_THEME_ID;
  } catch {
    /* default theme */
  }
  applyTheme(themeId);

  const container = document.getElementById('root');
  if (!container) throw new Error('#root missing from index.html');

  document.getElementById('boot-splash')?.remove();

  createRoot(container).render(
    <React.StrictMode>
      <WindowManagerProvider>
        <Desktop />
      </WindowManagerProvider>
    </React.StrictMode>,
  );
}

void boot().catch((error: unknown) => {
  // A kiosk has no console to check, so a boot failure has to be on screen.
  const message = error instanceof Error ? error.message : String(error);
  document.body.innerHTML =
    `<pre style="padding:2rem;font:14px ui-monospace,monospace;color:#e5646d;">` +
    `Boot failed\n\n${message}</pre>`;
});
