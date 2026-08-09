# Telegram — real accounts, not bot tokens

`components/apps/TelegramApp.tsx` is a Telegram client on **your own account**
over MTProto, plus a private local conversation store, behind one UI.

## Why this is not the app that was already here

`Cybernetic67App` ("Telegram Replica") is a faithful reproduction of Telegram's
*interface* driven by the **Bot API** (`/api/telegram/send`,
`/api/telegram/updates` in `server.ts`), falling back to Gemini for mock
replies. A bot can only ever see chats it was explicitly added to — it cannot
read your dialogs, your DMs, or your history. That app is untouched; this one
sits beside it.

This app speaks MTProto as a **user**: your dialog list, your messages, your
account.

## Why it runs in the browser, not in `server.ts`

The same build is served standalone *and* frozen into Jackie's `public/pc-os/`
as static files behind an iframe, where no Express process exists. A
server-side client would work in one of those and silently fail in the other.
MTProto over WebSocket is how Telegram's own Web K/Z clients work, so this is
the ordinary path, not a workaround.

`teleproto` is used rather than `telegram` (GramJS): GramJS was archived
upstream mid-2026 and its own npm notice points to teleproto as the maintained
fork. For a library that handles full account credentials, unpatched is
disqualifying. The API is compatible apart from two things this repo already
accounts for: `useWSS: true` is now `networkSocket: PromisedWebSockets`, and
`onError` must resolve rather than return.

## Setup

1. Visit **my.telegram.org → API development tools**, create an application
   once, and copy `api_id` and `api_hash`.
2. Open Telegram on the PC, pick the **Telegram** tab, and paste both. They are
   stored on the device, not committed.
3. Sign in with your phone number. Telegram sends a login code to your other
   devices; enter it, then your two-step password if the account has one.

For development you may instead set `VITE_TELEGRAM_API_ID` /
`VITE_TELEGRAM_API_HASH` in `.env.local` — see `.env.example`. These are
build-time values and end up in the bundle, so use the in-app fields for
anything you ship.

## The credential warning, stated plainly

`client.session.save()` returns a string that **is** the account. Anyone who
holds it can read and send everything, and it does not expire on its own.

It is persisted through `safeStorage` (origin-scoped `localStorage`). That
means any code on this origin can read it — including apps compiled by The
Forge and run by `GeneratedAppRunner`.

**Always sign out from inside the app** rather than clearing browser data.
`signOut()` calls `auth.logOut` so the session is revoked at Telegram; wiping
storage alone leaves a live session stranded on their servers forever.

The upgrade path is `lib/secretsVault.ts` (AES-GCM under a master password).
It is deliberately not wired in yet, because it would put a password prompt in
front of first run — a product decision worth making deliberately rather than
inheriting.

## The two providers

`lib/telegram/provider.ts` exposes one `ChatProvider` interface with two
implementations. `TelegramApp` holds a provider and never branches on which it
has, which is why the identical list/transcript/composer serves both.

| | `telegramProvider` | `localProvider` |
|---|---|---|
| Source | Live MTProto account | `localStorage` on this device |
| Needs network | Yes | No |
| Needs an account | Yes | No |
| Live updates | `NewMessage` event handler | In-process fan-out |

The local provider is a real store, not a demo: conversations and messages
persist across reloads and work with the cable pulled. It is also the natural
attachment point for an on-device model — wire `lib/localLlm.ts` into
`localProvider.sendMessage` to get an offline assistant in the same UI.

## Bundle cost

`teleproto` is ~2 MB (273 kB gzipped), pinned to its own `vendor-telegram`
chunk in `vite.config.ts` and loaded only when the app is first opened. It is
absent from `index.html`, so the desktop shell is unchanged for anyone who
never opens Telegram.

Browser builds need Node builtins shimmed — `vite-plugin-node-polyfills`
supplies `buffer`, `crypto`, `stream`, `util`, `events`, `path`, `os`, `zlib`.
Removing it will not fail the build; it fails at runtime on first import.

## Verified

Production build, then Chromium against `dist/`: the MTProto chunk loads with
no console errors, the local provider creates a conversation and persists a
message across reload, and the Telegram tab presents the sign-in gate, the
api-key form, and the credential warning.

Not verified end-to-end: a live sign-in, which needs a real phone number and a
real `api_id`. The auth flow is wired to Telegram's own `start()` state machine
rather than reimplemented, so the untested surface is the three prompt
callbacks, not the protocol.
