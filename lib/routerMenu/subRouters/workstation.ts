/**
 * The workstation sub-router — one place to reach everything.
 *
 * Lazily loaded like every sub-router: named, it decompresses; closed, it goes
 * away again.
 */

import type { GuideContent, RouterDefinition } from '../types';

const whereThingsAre: GuideContent = {
  title: 'Where everything lives',
  purpose: 'Stop hunting. Know which surface answers which question.',
  sections: [
    {
      heading: 'Start here',
      body: [
        'The main router (this menu) reaches every app by name or number, and never needs a network.',
        'Say "back" or "exit" from anywhere to return to the desktop. Say a sub-router name to swap this menu for a focused one.',
      ],
    },
    {
      heading: 'Your work',
      body: [
        'Search my documents — keyword search over anything you have added, offline, no model required.',
        'Time machine — the hash-chained history. Scrub back, fork, restore.',
        'Export the whole desktop — signed, compressed, and verifiable on another device.',
      ],
    },
    {
      heading: 'The AI side',
      body: [
        'Agent fleet — who is registered, who is awake, and what it costs in RAM. Dormant members cost nothing.',
        'Model router — which provider takes a request. Local runs first when your box is reachable.',
        'Routers router — what routers are and how to build one.',
      ],
    },
    {
      heading: 'When something is wrong',
      body: [
        'App health — what failed and why.',
        'Storage — what is held, what is largest, and what to remove.',
        'Fleet audit — dangling routes, conflicting labels, anything that would silently drop a question.',
      ],
    },
  ],
};

export const workstationRouter: RouterDefinition = {
  id: 'workstation-router',
  title: 'Workstation router',
  purpose: 'Build, move, and inspect. Everything reachable from one place.',
  entries: [
    {
      kind: 'guide',
      id: 'guide-where-things-are',
      label: 'Where does everything live?',
      keywords: ['where', 'lost', 'what is there', 'overview', 'map', 'start', 'i dont know where to start'],
      hint: 'A map of the surfaces and what each one answers',
      load: async () => whereThingsAre,
    },
    {
      kind: 'command',
      id: 'ws-export',
      label: 'Export everything to this device',
      keywords: ['export', 'save', 'backup', 'bundle', 'send to my phone'],
      channel: 'launch-app',
      payload: { appId: 'cybernetic_export' },
      hint: 'Signed and compressed, verifiable on arrival',
    },
    {
      kind: 'command',
      id: 'ws-import',
      label: 'Import a bundle',
      keywords: ['import', 'restore', 'load', 'bring it back'],
      channel: 'launch-app',
      payload: { appId: 'cybernetic_export' },
    },
    {
      kind: 'command',
      id: 'ws-knowledge',
      label: 'Search my documents',
      keywords: ['knowledge', 'notes', 'docs', 'find in my notes', 'what did i write'],
      channel: 'launch-app',
      payload: { appId: 'knowledge' },
      hint: 'Works with no network and no model',
    },
    {
      kind: 'command',
      id: 'ws-fleet',
      label: 'Agent fleet',
      keywords: ['fleet', 'agents', 'specialists', 'ram', 'who is thinking'],
      channel: 'launch-app',
      payload: { appId: 'fleet' },
    },
    {
      kind: 'command',
      id: 'ws-time',
      label: 'Time machine',
      keywords: ['time', 'history', 'undo', 'go back', 'restore', 'yesterday'],
      channel: 'launch-app',
      payload: { appId: 'time_machine' },
    },
    {
      kind: 'command',
      id: 'ws-storage',
      label: 'Storage and pods',
      keywords: ['storage', 'space', 'full', 'disk', 'pods'],
      channel: 'launch-app',
      payload: { appId: 'storage_stats' },
    },
    {
      kind: 'command',
      id: 'ws-terminal',
      label: 'Terminal',
      keywords: ['terminal', 'shell', 'console', 'command line'],
      channel: 'launch-app',
      payload: { appId: 'terminal' },
    },
    {
      kind: 'command',
      id: 'ws-themes',
      label: 'Change how the OS looks',
      keywords: ['theme', 'skin', 'windows 95', 'macos', 'linux', 'appearance'],
      channel: 'launch-app',
      payload: { appId: 'pc_themes' },
    },
  ],
};
