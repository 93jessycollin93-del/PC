/** @type {import('tailwindcss').Config} */
export default {
    // Every directory that ships className strings. Missing one here silently
    // purges its utilities from the build, so this list tracks the repo layout
    // rather than a fixed set: components/, src/ (components, jackie-core,
    // pc-themes, sas-pod-system, integration), cybernetic/, export/, lib/,
    // sas-hub-core/, plus the root-level entry files.
    content: [
        './index.html',
        './index.tsx',
        './App.tsx',
        './types.ts',
        './components/**/*.{ts,tsx}',
        './cybernetic/**/*.{ts,tsx}',
        './export/**/*.{ts,tsx}',
        './lib/**/*.{ts,tsx}',
        './sas-hub-core/**/*.{ts,tsx}',
        './src/**/*.{ts,tsx}',
    ],
    theme: {
        extend: {
            // Carried over verbatim from the inline `tailwind.config` that the
            // CDN script used to define in index.html.
            colors: {
                os: {
                    bg: '#1e1e2e',
                    surface: '#313244',
                    text: '#cdd6f4',
                    accent: '#89b4fa',
                },
            },
            animation: {
                'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
        },
    },
    plugins: [],
};
