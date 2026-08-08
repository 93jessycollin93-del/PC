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


/**
 * A lazy app that can also be fetched ahead of time.
 *
 * `React.lazy` hides its loader, so nothing outside can warm an app's chunk
 * before the user clicks. Keeping a reference to the loader lets the
 * Understudy prefetch the app it expects next — the chunk is already in
 * memory when the click lands, instead of a spinner.
 */
export type PreloadableLazy = LazyExoticComponent<ComponentType<any>> & {
    preload: () => Promise<unknown>;
};

function lazyApp(loader: () => Promise<{ default: ComponentType<any> }>): PreloadableLazy {
    const C = lazy(loader) as PreloadableLazy;
    let started: Promise<unknown> | null = null;
    // Memoized: a repeated prefetch must not re-issue the network request.
    C.preload = () => (started ??= loader().catch(() => undefined));
    return C;
}

export const APP_REGISTRY: Partial<Record<AppId, AppDefinition>> = {
    bypass: {
        defaultSize: { width: 560, height: 660 },
        Component: lazyApp(() => import('../components/apps/BypassApp').then(m => ({ default: m.BypassApp }))),
        props: () => ({}),
    },
    fleet: {
        defaultSize: { width: 520, height: 640 },
        Component: lazyApp(() => import('../components/apps/FleetApp').then(m => ({ default: m.FleetApp }))),
        props: () => ({}),
    },
    knowledge: {
        defaultSize: { width: 560, height: 640 },
        Component: lazyApp(() => import('../components/apps/KnowledgeApp').then(m => ({ default: m.KnowledgeApp }))),
        props: () => ({}),
    },
    jacky: {
        defaultSize: { width: 500, height: 700 },
        Component: lazyApp(() => import('../components/apps/JackieChatApp').then(m => ({ default: m.JackieChatApp }))),
        props: (ctx) => ({ onNavigate: ctx.navigate }),
    },
    mail: {
        defaultSize: { width: 800, height: 600 },
        Component: lazyApp(() => import('../components/apps/MailApp').then(m => ({ default: m.MailApp }))),
        props: (ctx) => ({ emails: ctx.emails }),
    },
    slides: {
        defaultSize: { width: 640, height: 480 },
        Component: lazyApp(() => import('../components/apps/SlidesApp').then(m => ({ default: m.SlidesApp }))),
        props: () => ({}),
    },
    snake: {
        defaultSize: { width: 500, height: 550 },
        Component: lazyApp(() => import('../components/apps/SnakeGame').then(m => ({ default: m.SnakeGame }))),
        props: () => ({}),
    },
    notepad: {
        defaultSize: { width: 400, height: 500 },
        Component: lazyApp(() => import('../components/apps/NotepadApp').then(m => ({ default: m.NotepadApp }))),
        props: (ctx) => ({ fileId: ctx.windowId, initialContent: ctx.item.notepadInitialContent }),
    },
    cybernetic_export: {
        defaultSize: { width: 580, height: 620 },
        Component: lazyApp(() => import('../components/apps/CyberneticExportApp').then(m => ({ default: m.CyberneticExportApp }))),
        props: () => ({}),
    },
    github_sync: {
        defaultSize: { width: 640, height: 480 },
        Component: lazyApp(() => import('../components/apps/GitHubSyncApp').then(m => ({ default: m.GitHubSyncApp }))),
        props: () => ({}),
    },
    flipper: {
        defaultSize: { width: 640, height: 480 },
        Component: lazyApp(() => import('../components/apps/FlipperZeroApp').then(m => ({ default: m.FlipperZeroApp }))),
        props: () => ({}),
    },

    // ── The ten ─────────────────────────────────────────────────────────
    // Built on three shared foundations (lib/ai/telemetry, lib/observe/recorder,
    // lib/ai/parallel) rather than ten independent stacks.
    budget_radar: {
        defaultSize: { width: 560, height: 660 },
        Component: lazyApp(() => import('../components/apps/BudgetRadarApp').then(m => ({ default: m.BudgetRadarApp }))),
        props: () => ({}),
    },
    colosseum: {
        defaultSize: { width: 760, height: 680 },
        Component: lazyApp(() => import('../components/apps/ColosseumApp').then(m => ({ default: m.ColosseumApp }))),
        props: () => ({}),
    },
    ambient_agents: {
        defaultSize: { width: 600, height: 680 },
        Component: lazyApp(() => import('../components/apps/AmbientAgentsApp').then(m => ({ default: m.AmbientAgentsApp }))),
        props: () => ({}),
    },
    bus_recorder: {
        defaultSize: { width: 640, height: 660 },
        Component: lazyApp(() => import('../components/apps/BusRecorderApp').then(m => ({ default: m.BusRecorderApp }))),
        props: () => ({}),
    },
    choreography: {
        defaultSize: { width: 560, height: 640 },
        Component: lazyApp(() => import('../components/apps/ChoreographyApp').then(m => ({ default: m.ChoreographyApp }))),
        props: () => ({}),
    },
    speed_racer: {
        defaultSize: { width: 640, height: 660 },
        Component: lazyApp(() => import('../components/apps/SpeedRacerApp').then(m => ({ default: m.SpeedRacerApp }))),
        props: () => ({}),
    },
    cartographer: {
        defaultSize: { width: 680, height: 660 },
        Component: lazyApp(() => import('../components/apps/CartographerApp').then(m => ({ default: m.CartographerApp }))),
        props: () => ({}),
    },
    prompt_genome: {
        defaultSize: { width: 720, height: 680 },
        Component: lazyApp(() => import('../components/apps/PromptGenomeApp').then(m => ({ default: m.PromptGenomeApp }))),
        props: () => ({}),
    },
    cortex: {
        defaultSize: { width: 600, height: 700 },
        Component: lazyApp(() => import('../components/apps/CortexApp').then(m => ({ default: m.CortexApp }))),
        props: () => ({}),
    },
    understudy: {
        defaultSize: { width: 560, height: 700 },
        Component: lazyApp(() => import('../components/apps/UnderstudyApp').then(m => ({ default: m.UnderstudyApp }))),
        props: () => ({}),
    },
};

export const getAppDefinition = (appId?: AppId): AppDefinition | undefined =>
    appId ? APP_REGISTRY[appId] : undefined;
