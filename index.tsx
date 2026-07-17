/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { initializeGlobalState } from './lib/persist';
import { AuthProvider } from './lib/authContext';
import { ToastProvider } from './lib/toastContext';
import { PCThemeProvider } from './src/pc-themes/PCThemeContext';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

const root = ReactDOM.createRoot(rootElement);

const RootApp = () => {
    const [initialized, setInitialized] = useState(false);

    useEffect(() => {
        // Hard UI-side ceiling: never let the loading screen hang indefinitely,
        // regardless of how long IndexedDB/cloud/localStorage restoration takes.
        let settled = false;
        const finish = () => {
            if (!settled) {
                settled = true;
                setInitialized(true);
            }
        };
        initializeGlobalState().then(finish).catch((e) => {
            console.error('initializeGlobalState failed, starting with empty state.', e);
            finish();
        });
        // Set comfortably above persist.ts's own worst-case internal budget
        // (1200ms cloud timeout + 800ms IDB timeout + decompression), so this
        // only fires as a true last-resort safety net, not on the common path
        // — firing early would let App's save effect persist default state
        // over a still-in-flight restore.
        const ceiling = setTimeout(finish, 3000);
        return () => clearTimeout(ceiling);
    }, []);

    if (!initialized) {
        return (
            <div className="h-full w-full bg-zinc-950 flex flex-col items-center justify-center text-white font-mono gap-4">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <div className="text-sm text-zinc-400">Restoring Multi-Dimensional Memory Pod...</div>
            </div>
        );
    }

    return (
        <React.StrictMode>
            <AuthProvider>
                <ToastProvider>
                    {/* PC-shell theme context — state only; visuals stay scoped
                        to the PC desktop container inside App. */}
                    <PCThemeProvider>
                        <App />
                    </PCThemeProvider>
                </ToastProvider>
            </AuthProvider>
        </React.StrictMode>
    );
};

root.render(<RootApp />);

// Register the service worker relative to the deployed base path so the app
// keeps working when hosted under a sub-path (e.g. embedded at /pc-os/ inside
// Jackie). Skip registration inside iframes: the embedding page owns the
// origin-level service worker and a nested registration would fight it.
const isEmbedded = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();

if ('serviceWorker' in navigator && !isEmbedded) {
  window.addEventListener('load', () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker.register(swUrl).then(registration => {
      console.log('SW registered: ', registration);
    }).catch(registrationError => {
      console.log('SW registration failed: ', registrationError);
    });
  });
}
