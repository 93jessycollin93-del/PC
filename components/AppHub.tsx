/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AppHub — one icon, many apps, without merging their code.
 *
 * PC grew to 109 desktop apps, and a large share of them are one screen each
 * on a shared subject: twelve about agents, seventeen about models and
 * prompts, fifteen about security. As a dock that is unusable; as a codebase
 * it is fine, because each of those files is small, focused and independently
 * testable.
 *
 * So this consolidates the SURFACE and deliberately not the SOURCE. A hub
 * declares sections, each pointing at an existing component, and renders them
 * behind a segmented control. Nothing is rewritten, nothing is merged into a
 * two-thousand-line file, and no feature is lost — the only thing that changes
 * is how many icons you scan to find one.
 *
 * The alternative — actually merging twelve apps into one component — is what
 * produces the unreadable file nobody wants to touch. This keeps the modules
 * exactly as they are and treats the hub as a router over them.
 *
 * WHY LAZY
 * --------
 * Sections load on first visit. A hub of twelve apps that mounted all twelve
 * would be strictly worse than twelve separate icons: it would pay every app's
 * import cost to show one. `React.lazy` means opening the Agents hub costs the
 * one section you look at.
 */
import React, { Suspense, useState } from 'react';
import { Loader2, type LucideIcon } from 'lucide-react';

export interface HubSection {
    id: string;
    label: string;
    icon: LucideIcon;
    /** One line, shown under the title — what this section is for. */
    blurb?: string;
    /**
     * Lazily-imported component. Nothing mounts until the section is opened.
     * Sections take no props — every app routed through a hub is self-contained,
     * which is what makes routing to it a one-line entry.
     */
    Component: React.LazyExoticComponent<React.ComponentType>;
}

interface AppHubProps {
    title: string;
    subtitle: string;
    sections: HubSection[];
    /** Section shown first. Defaults to the first entry. */
    initialId?: string;
}

export const AppHub: React.FC<AppHubProps> = ({ title, subtitle, sections, initialId }) => {
    const [activeId, setActiveId] = useState<string>(initialId ?? sections[0]?.id ?? '');
    const active = sections.find(s => s.id === activeId) ?? sections[0] ?? null;

    if (!active) {
        return (
            <div className="flex h-full items-center justify-center bg-zinc-950 text-xs text-zinc-500">
                Nothing in this hub.
            </div>
        );
    }

    const ActiveComponent = active.Component;

    return (
        <div className="flex h-full w-full bg-zinc-950 text-zinc-200">
            {/* rail */}
            <nav className="flex w-44 shrink-0 flex-col border-r border-zinc-800">
                <div className="border-b border-zinc-800 px-3 py-2.5">
                    <p className="text-xs font-semibold text-zinc-100">{title}</p>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-zinc-500">{subtitle}</p>
                </div>
                <div className="flex-1 overflow-y-auto py-1">
                    {sections.map(section => {
                        const Icon = section.icon;
                        const on = section.id === active.id;
                        return (
                            <button
                                key={section.id}
                                onClick={() => setActiveId(section.id)}
                                title={section.blurb}
                                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] transition-colors ${
                                    on
                                        ? 'bg-zinc-800 text-zinc-100'
                                        : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                                }`}
                            >
                                <Icon size={13} className="shrink-0" />
                                <span className="truncate">{section.label}</span>
                            </button>
                        );
                    })}
                </div>
                <p className="border-t border-zinc-800 px-3 py-1.5 text-[10px] text-zinc-600">
                    {sections.length} tools
                </p>
            </nav>

            {/* the section itself, untouched */}
            <div className="min-w-0 flex-1">
                <Suspense
                    fallback={
                        <div className="flex h-full items-center justify-center gap-2 text-xs text-zinc-500">
                            <Loader2 size={14} className="animate-spin" />
                            Loading {active.label}…
                        </div>
                    }
                >
                    {/* Keyed by id so switching sections remounts rather than
                        handing one app's state to another. */}
                    <ActiveComponent key={active.id} />
                </Suspense>
            </div>
        </div>
    );
};

export default AppHub;
