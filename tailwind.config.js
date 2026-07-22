/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './index.html',
        './index.tsx',
        './App.tsx',
        './types.ts',
        './components/**/*.{ts,tsx}',
        './lib/**/*.{ts,tsx}',
        './sas-hub-core/**/*.{ts,tsx}',
    ],
    theme: {
        extend: {
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
