/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * APP REGISTRY — the single extension point for the Mini PC.
 *
 * Every application on the PC registers here. Each entry declares:
 *   - its window size
 *   - a LAZY-LOADED component (code-splits into its own chunk, downloaded
 *     only when the app is first opened — the desktop shell stays tiny
 *     no matter how many apps are installed)
 *   - a props resolver that maps shared OS context onto the app's props
 *
 * TO ADD A NEW APP:
 *   1. Create its component in components/apps/
 *   2. Add its id to AppId in types.ts
 *   3. Add one entry below + one DesktopItem in App.tsx
 * Nothing else in the core shell needs to change. Removing entries is
 * never required — the registry only grows.
 */
import { lazy, LazyExoticComponent, ComponentType } from 'react';
import React from 'react';
import { AppId, DesktopItem, Email } from '../types';

/** Shared OS services handed to every app at render time. */
export interface AppRenderContext {
    /** The desktop item / window being rendered. */
    item: DesktopItem;
    /** Window instance id (differs from appId for multi-instance apps like notepad). */
    windowId: string;
    /** Live email store (Mail and future comms apps). */
    emails: Email[];
    /** Surface a toast notification on the desktop. */
    showToast: (message: React.ReactNode, title?: string, autoDismiss?: boolean) => void;
    /** Jackie-driven navigation: open another feature/app by id. */
    navigate: (feature: string, params?: Record<string, any>) => void;
}

export interface AppDefinition {
    /** Default window size when launched. */
    defaultSize: { width: number; height: number };
    /** Lazily imported component — its code ships in a separate chunk. */
    Component: LazyExoticComponent<ComponentType<any>>;
    /** Maps shared OS context to this app's props. */
    props: (ctx: AppRenderContext) => Record<string, any>;
}

export const APP_REGISTRY: Partial<Record<AppId, AppDefinition>> = {
    jackie: {
        defaultSize: { width: 500, height: 700 },
        Component: lazy(() => import('../components/apps/JackieChatApp').then(m => ({ default: m.JackieChatApp }))),
        props: (ctx) => ({ onNavigate: ctx.navigate }),
    },
    mail: {
        defaultSize: { width: 800, height: 600 },
        Component: lazy(() => import('../components/apps/MailApp').then(m => ({ default: m.MailApp }))),
        props: (ctx) => ({ emails: ctx.emails }),
    },
    slides: {
        defaultSize: { width: 640, height: 480 },
        Component: lazy(() => import('../components/apps/SlidesApp').then(m => ({ default: m.SlidesApp }))),
        props: () => ({}),
    },
    snake: {
        defaultSize: { width: 500, height: 550 },
        Component: lazy(() => import('../components/apps/SnakeGame').then(m => ({ default: m.SnakeGame }))),
        props: () => ({}),
    },
    notepad: {
        defaultSize: { width: 400, height: 500 },
        Component: lazy(() => import('../components/apps/NotepadApp').then(m => ({ default: m.NotepadApp }))),
        props: (ctx) => ({ fileId: ctx.windowId, initialContent: ctx.item.notepadInitialContent }),
    },
    cybernetic_export: {
        defaultSize: { width: 580, height: 620 },
        Component: lazy(() => import('../components/apps/CyberneticExportApp').then(m => ({ default: m.CyberneticExportApp }))),
        props: () => ({}),
    },
    github_sync: {
        defaultSize: { width: 640, height: 480 },
        Component: lazy(() => import('../components/apps/GitHubSyncApp').then(m => ({ default: m.GitHubSyncApp }))),
        props: () => ({}),
    },
    flipper: {
        defaultSize: { width: 640, height: 480 },
        Component: lazy(() => import('../components/apps/FlipperZeroApp').then(m => ({ default: m.FlipperZeroApp }))),
        props: () => ({}),
    },
};

export const getAppDefinition = (appId?: AppId): AppDefinition | undefined =>
    appId ? APP_REGISTRY[appId] : undefined;
