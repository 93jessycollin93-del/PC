/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Agents — twelve agent tools behind one icon.
 *
 * Every section below is an existing, unmodified app. Nothing was merged, no
 * file grew, and no capability moved: this is a router over components that
 * already worked, so the dock loses eleven icons and the codebase loses
 * nothing.
 *
 * The twelve are genuinely one subject — building an agent, giving it tools,
 * running several at once, watching what they did, and asking a fleet a
 * question. Scattering that across twelve launcher entries made the
 * relationship invisible; a rail makes it the first thing you see.
 *
 * Ordering follows how the work actually goes, not the alphabet: build it,
 * give it something to do, run a team, watch them, then the specialised labs.
 *
 * ADDING A SECTION
 * ----------------
 * One entry. Do NOT move the component's code here — that produces the
 * two-thousand-line file this exists to avoid.
 */
import React from 'react';
import {
    Bot, Boxes, Brain, Eye, GitBranch, Hammer, Layers, Radar, Radio, Users, Workflow, Scale,
} from 'lucide-react';
import { AppHub, type HubSection } from '../AppHub';

/**
 * Resolve a section component whether the module exports it by name or as a
 * default. PC's apps do both — `FleetAtlasApp` has only a default export while
 * most have only a named one — and guessing wrong yields a blank pane with no
 * error, which is the failure mode hardest to notice.
 */
function section(
    loader: () => Promise<Record<string, unknown>>,
    exportName: string,
): HubSection['Component'] {
    return React.lazy(async () => {
        const mod = await loader();
        const Component = (mod[exportName] ?? mod.default) as React.ComponentType;
        if (!Component) throw new Error(`Agents hub: ${exportName} exports no component`);
        return { default: Component };
    });
}

const SECTIONS: HubSection[] = [
    {
        id: 'builder',
        label: 'Agent Builder',
        icon: Hammer,
        blurb: 'Compose an agent: prompt, tools, workflow templates.',
        Component: section(() => import('./AgentBuilderApp'), 'AgentBuilderApp'),
    },
    {
        id: 'team',
        label: 'Team Console',
        icon: Users,
        blurb: 'Run a squad and watch the hand-offs.',
        Component: section(() => import('./AgentTeamConsoleApp'), 'AgentTeamConsoleApp'),
    },
    {
        id: 'orchestration',
        label: 'Orchestration',
        icon: Workflow,
        blurb: 'Multi-agent coordination dashboard.',
        Component: section(() => import('./AgentOrchestrationDashboard'), 'AgentOrchestrationDashboard'),
    },
    {
        id: 'small-fleet',
        label: 'Small Fleet',
        icon: Boxes,
        blurb: 'A handful of narrow agents, cheaply.',
        Component: section(() => import('./SmallAgentFleetApp'), 'SmallAgentFleetApp'),
    },
    {
        id: 'fleet',
        label: 'Fleet',
        icon: Layers,
        blurb: 'The full fleet and its state.',
        Component: section(() => import('./FleetApp'), 'FleetApp'),
    },
    {
        id: 'atlas',
        label: 'Fleet Atlas',
        icon: Radar,
        blurb: 'Where every agent is and what it covers.',
        Component: section(() => import('./FleetAtlasApp'), 'FleetAtlasApp'),
    },
    {
        id: 'ambient',
        label: 'Ambient Agents',
        icon: Radio,
        blurb: 'Agents that run without being asked.',
        Component: section(() => import('./AmbientAgentsApp'), 'AmbientAgentsApp'),
    },
    {
        id: 'choreography',
        label: 'Choreography',
        icon: GitBranch,
        blurb: 'Who acts when, and in what order.',
        Component: section(() => import('./ChoreographyApp'), 'ChoreographyApp'),
    },
    {
        id: 'understudy',
        label: 'Understudy',
        icon: Eye,
        blurb: 'Learns your workflows by watching.',
        Component: section(() => import('./UnderstudyApp'), 'UnderstudyApp'),
    },
    {
        id: 'consensus',
        label: 'Consensus Lab',
        icon: Scale,
        blurb: 'Ask several models and compare the disagreement.',
        Component: section(() => import('./MultiAgentConsensusLab'), 'MultiAgentConsensusLab'),
    },
    {
        id: 'vision',
        label: 'Agentic Vision',
        icon: Brain,
        blurb: 'Agents that look at images.',
        Component: section(() => import('./AgenticVisionApp'), 'AgenticVisionApp'),
    },
    {
        id: 'bots',
        label: 'Bot Studio',
        icon: Bot,
        blurb: 'Build and wire chat bots.',
        Component: section(() => import('./BotStudioApp'), 'BotStudioApp'),
    },
];

export const AgentsHubApp: React.FC = () => (
    <AppHub
        title="Agents"
        subtitle="Build them, run them, watch them."
        sections={SECTIONS}
        initialId="builder"
    />
);

export default AgentsHubApp;
