/**
 * The storage sub-router — pods, what is held where, and what to do when full.
 *
 * Lazily loaded like every sub-router.
 */

import type { GuideContent, RouterDefinition } from '../types';

const podsExplained: GuideContent = {
  title: 'Pods, and why there are two',
  purpose: 'Know where your data actually is and what to do when space runs out.',
  sections: [
    {
      heading: 'Why not just one big store',
      body: [
        'The browser gives an origin about 5 MB of localStorage. That limit is per-origin, not per-name, so a second localStorage store would share the same 5 MB and gain nothing.',
        'IndexedDB on the same origin is a genuinely separate and far larger bucket. That is why the second pod uses it.',
      ],
    },
    {
      heading: 'What each pod is for',
      body: [
        'Pod 1 is localStorage. It is small, but it is the only one that can be read without waiting, and some parts of the interface must read while drawing. That is why it exists, not its size.',
        'Pod 2 is IndexedDB. Large, compressed, and read with a short wait. Anything big lives here.',
      ],
    },
    {
      heading: 'What happens when Pod 1 fills',
      body: [
        'The write moves to Pod 2 instead of being lost. You keep working and the value is still found later by the same name.',
        'Without that, a full store means your work silently stops saving, which you would only discover on the next launch.',
      ],
    },
    {
      heading: 'Compression, and how retention is proven',
      body: [
        'Pod 2 payloads are compressed losslessly. Nothing is approximated or dropped.',
        'Every payload carries a hash of the original taken before compression. Reading re-checks it, so a payload that no longer means what it meant fails loudly instead of returning something plausible and wrong.',
      ],
    },
    {
      heading: 'When it says storage is full',
      body: [
        'Open Storage to see what is held and which entries are largest. A total alone does not tell you what to delete.',
        'Export what matters first, then remove the largest entries. Export is signed and verifiable, so nothing is lost by moving it off the device.',
      ],
    },
  ],
};

export const storageRouter: RouterDefinition = {
  id: 'storage-router',
  title: 'Storage router',
  purpose: 'Where your data is, how much room is left, and what to do about it.',
  entries: [
    {
      kind: 'guide',
      id: 'guide-pods',
      label: 'Explain pods and storage',
      keywords: ['pods', 'explain', 'how does storage work', 'why two', 'guide'],
      hint: 'Why there are two, and what happens when one fills',
      load: async () => podsExplained,
    },
    {
      kind: 'command',
      id: 'st-usage',
      label: 'What is taking up space?',
      keywords: ['space', 'usage', 'full', 'disk', 'how much room', 'largest'],
      channel: 'launch-app',
      payload: { appId: 'storage_stats' },
    },
    {
      kind: 'command',
      id: 'st-export',
      label: 'Export before clearing anything',
      keywords: ['export', 'backup', 'save first'],
      channel: 'launch-app',
      payload: { appId: 'cybernetic_export' },
      hint: 'Signed and verifiable, so moving it off the device loses nothing',
    },
    {
      kind: 'command',
      id: 'st-vault',
      label: 'Open the data vault',
      keywords: ['vault', 'data', 'secure storage'],
      channel: 'launch-app',
      payload: { appId: 'data_vault' },
    },
  ],
};
