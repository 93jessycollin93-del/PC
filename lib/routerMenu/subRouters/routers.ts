/**
 * The routers sub-router — what a router is, why it exists, and how to build one.
 *
 * This module is only ever reached through a dynamic import from mainRouter, so
 * its text ships as a separate chunk and is absent from the main bundle until
 * someone asks for it. That is the "compressed until named" behaviour, made
 * real by the bundler rather than described.
 *
 * The guide is deliberately blunt about the limit that matters most (a small
 * router is not a small language model), because getting that wrong is what
 * makes the whole architecture seem to fail later.
 */

import type { GuideContent, RouterDefinition } from '../types';

const whatIsARouter: GuideContent = {
  title: 'Routers, A to Z',
  purpose: 'Understand what a router can and cannot do, then build one that works.',
  sections: [
    {
      heading: 'A router is a decider, not a knower',
      body: [
        'A router reads a piece of text and answers one question: which of these labels does it belong to. That is all it does.',
        'It does not know facts about the label. A router trained on physics questions cannot solve a physics problem. It can only recognise that a question IS a physics question and pass it to whatever handles those.',
        'This is why routers are small. Recognising a category is a far smaller job than understanding a subject, and it compresses into kilobytes.',
      ],
    },
    {
      heading: 'The limit worth knowing before you start',
      body: [
        'A 500 kB file cannot be a language model. The smallest models that genuinely understand language are a few hundred megabytes, and that floor is real.',
        'So a fleet of a hundred tiny specialists is not a hundred tiny brains. It is a hundred tiny switchboards around one brain, plus retrieval.',
        'Designed that way it works and runs on a phone. Designed the other way it disappoints, and the disappointment arrives late, after the work is done.',
      ],
    },
    {
      heading: 'How a nano router actually works',
      body: [
        'Text is lowercased and its whitespace collapsed, so spacing and capitalisation cannot change the answer.',
        'Overlapping character n-grams are hashed into a fixed number of buckets. Hashing means the vocabulary never grows: ten words or ten thousand, the model stays the same size.',
        'Each bucket count is normalised, then multiplied by a small weight matrix, one row per label. The row with the highest total wins.',
        'Weights are stored as 8-bit integers with a per-label scale, which is most of why the file is measured in kilobytes.',
      ],
    },
    {
      heading: 'Confidence, and why a confident wrong answer is the danger',
      body: [
        'Scores are turned into probabilities that sum to one, so the top score reads as a confidence.',
        'A router is always confident about something. With two labels it will never report less than 50 percent, even for input belonging to neither.',
        'That means low accuracy is worse than no router: a wrong route arrives looking certain, and nothing downstream signals the mistake. Check accuracy on data the router never trained on.',
      ],
    },
    {
      heading: 'Training one',
      body: [
        'Collect real examples per label, phrased the way you actually phrase things. Twenty per label is a floor, not a target.',
        'Hold some back. Accuracy measured on the training data is optimistic and tells you almost nothing.',
        'Train, check the held-out accuracy, and only then export. The forge records examples, accuracy and whether a holdout was used, and the audit reads those fields.',
      ],
    },
    {
      heading: 'Portability, and the reason parity is tested',
      body: [
        'An artifact trained on the desktop must route identically on the phone, or the same question gets different handling depending on the device and nothing tells you.',
        'That is why the runtimes are checked against a shared fixture to four decimal places, including the hash function and the UTF-8 encoding beneath them.',
        'If you change how text is normalised on one side, regenerate the fixture on both. Never relax the comparison to make a change pass.',
      ],
    },
    {
      heading: 'Where routers fit in this app',
      body: [
        'Each specialist in the fleet can carry one. It is compiled when the specialist wakes and dropped when it sleeps, so a dormant router costs nothing.',
        'Every label must map to a member that exists. A label pointing nowhere silently drops the question, which is the failure the audit checks for first.',
        'Run the audit after building any router. It reports dangling labels, conflicting routes, thin training data and anything too large to load.',
      ],
    },
  ],
};

const buildingOne: GuideContent = {
  title: 'Building your own router',
  purpose: 'Go from an idea to a working artifact without the usual mistakes.',
  sections: [
    {
      heading: 'Pick labels that do not overlap',
      body: [
        'Labels must be things a human could sort confidently. If you cannot decide which label an example belongs to, the router cannot either.',
        'Two labels that mean nearly the same thing produce a router that is right half the time and confident always.',
      ],
    },
    {
      heading: 'Write examples the way you speak',
      body: [
        'Training on tidy, well-formed sentences and then typing "gpu dead again" gets you a router that fails exactly when you need it.',
        'Include the messy phrasings, the typos you actually make, and the short fragments.',
      ],
    },
    {
      heading: 'Check it before trusting it',
      body: [
        'Look at the held-out accuracy, not the training accuracy.',
        'Try inputs belonging to no label at all and see what it claims. That tells you how it will behave in the wild.',
        'Then run the fleet audit, which catches the wiring mistakes that a good model cannot save you from.',
      ],
    },
  ],
};

export const routersRouter: RouterDefinition = {
  id: 'routers-router',
  title: 'Routers router',
  purpose: 'What routers are, how they work, and how to build one that holds up.',
  entries: [
    {
      kind: 'guide',
      id: 'guide-what-is-a-router',
      label: 'Teach me about routers, A to Z',
      keywords: ['what are routers', 'how do they work', 'explain', 'teach me', 'guide', 'concept', 'purpose'],
      hint: 'The full explanation, including the limit that matters most',
      load: async () => whatIsARouter,
    },
    {
      kind: 'guide',
      id: 'guide-build-a-router',
      label: 'How do I build my own router?',
      keywords: ['build', 'make', 'create', 'train', 'my own', 'how do i'],
      hint: 'Labels, examples, holdout, and the checks worth running',
      load: async () => buildingOne,
    },
    {
      kind: 'command',
      id: 'open-fleet-from-routers',
      label: 'Show my agent fleet',
      keywords: ['fleet', 'agents', 'specialists', 'who is thinking', 'ram'],
      channel: 'launch-app',
      payload: { appId: 'fleet' },
      hint: 'See what is awake and what it costs',
    },
    {
      kind: 'command',
      id: 'open-model-router-from-routers',
      label: 'Open the model router',
      keywords: ['model router', 'routing', 'providers', 'which model'],
      channel: 'launch-app',
      payload: { appId: 'model_router' },
    },
  ],
};
