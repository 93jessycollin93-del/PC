import type { Metadata, Viewport } from "next";
import { theme } from "@cybernetic/ui-components";
import "./globals.css";

export const metadata: Metadata = {
  title: "Router Console v2 — Cybernetic",
  description: "Offline-first orchestration control for iPhone",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Router Console",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: theme.colors.accent.primary,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="application-name" content="Router Console" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Router Console" />
        <meta name="description" content="Offline-first orchestration control" />
        <meta name="theme-color" content={theme.colors.accent.primary} />
      </head>
      <body suppressHydrationWarning>
        {children}
        <script>{`
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(() => {});
          }
        `}</script>
      </body>
    </html>
  );
}
