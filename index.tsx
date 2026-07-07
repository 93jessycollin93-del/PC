/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { initializeGlobalState } from './lib/persist';
import { AuthProvider } from './lib/authContext';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

const root = ReactDOM.createRoot(rootElement);

const RootApp = () => {
    const [initialized, setInitialized] = useState(false);

    useEffect(() => {
        initializeGlobalState().then(() => {
            setInitialized(true);
        });
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
                <App />
            </AuthProvider>
        </React.StrictMode>
    );
};

root.render(<RootApp />);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('SW registered: ', registration);
    }).catch(registrationError => {
      console.log('SW registration failed: ', registrationError);
    });
  });
}
