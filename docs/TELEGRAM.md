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

## How the session is protected

`session.save()` returns a string that **is** the account: read everything,
send as you, no expiry. Telegram Web keeps its equivalent in plaintext
localStorage. That is not good enough here, because this origin also runs code
The Forge generated.

`lib/telegram/vault.ts` holds it instead:

| | |
|---|---|
| At rest | AES-256-GCM ciphertext in a **separate IndexedDB database** from the rest of the desktop. A bug in app storage cannot reach it. |
| Key | Never persisted. Derived per unlock, held as a **non-extractable** `CryptoKey` — usable while unlocked, impossible to copy out. |
| Passkey tier | WebAuthn PRF → HKDF → AES key. The secret never leaves the authenticator, so there is nothing to phish and nothing to brute-force offline. |
| Passphrase tier | PBKDF2-HMAC-SHA256, **600,000 iterations** (OWASP's current floor), 32-byte random salt. |
| Binding | Origin + install id go into the AEAD's additional data, read from the **live environment**. A blob lifted to another origin fails authentication even with the correct passphrase. |
| In memory | Plaintext exists only between unlock and lock. Auto-locks on idle (15 min default) and on tab hide. |
| Failed attempts | Free for two, then exponential backoff from 5s to 5 min, persisted so a reload does not reset it. |
| Errors | A wrong passphrase and a tampered vault return the *same* message — distinguishing them tells an attacker which one they achieved. |

Sealing happens **after** login, as a deliberate step. Between authorisation
and sealing the session exists only in memory: close the tab and it is gone.
That is the correct failure direction for a credential.

### Honest limits

Stated plainly because overselling security is worse than not having it:

- **While unlocked**, hostile code in this realm can ask the live client to
  act. Encryption at rest does not fix that — short auto-lock windows help,
  and moving MTProto into a worker realm would fix it properly. Not done yet.
- **An attacker holding the ciphertext can brute-force offline** at their own
  pace. The only real defence is KDF cost, which is why the passkey tier is
  offered first and recommended.
- **Attempt throttling defends the live page, not offline cracking.** It is
  not a substitute for a strong passphrase.
- **Telegram cloud chats are not end-to-end encrypted** — that is a property
  of the protocol, not of this client. Everything above protects the
  credential on *your device*; it does not change what Telegram's servers can
  see.

### Migration

A session written by the pre-vault build is plaintext in localStorage. On
first run the app removes that key and requires you to seal what it recovered.
The plaintext copy stops existing either way.

### Verification

`lib/telegram/vault.test.ts` asserts the properties above rather than assuming
them — round-trip, wrong passphrase, tampered blob, cross-install binding,
throttle escalation and reset, idle lock, activity deferral, and that the
secret never appears in localStorage. The binding test earned its place: it
caught a version where the AAD was read from the stored record, which meant a
stolen blob carried its own binding and authenticated anywhere.

## Sealed messages — end-to-end encryption over Telegram

Telegram cloud chats are **not** end-to-end encrypted. They are encrypted in
transit and at rest on Telegram's servers, which means Telegram can read them.
End-to-end exists only in Secret Chats, which are single-device, mobile-only,
and unavailable to every web client including this one.

A **sealed message** is an ordinary Telegram message whose body is ciphertext.
Telegram transports it, stores it, syncs it across your devices — and cannot
read it. Anyone without this app sees a marker and base64.

### Using it

1. Open a conversation and press **Send my key**. That posts your public key
   as an ordinary message.
2. Have them do the same. Both clients adopt each other's key automatically,
   including from history, so an existing conversation works without redoing it.
3. Press **Not sealed** to flip the conversation to **End-to-end**.
4. Press **Unverified** and compare the 60-digit safety number out of band —
   on a call, or in person. Then mark it verified.

Step 4 is not optional decoration. Encryption without verification protects
you from Telegram but not from someone who substituted a key at the moment of
exchange. The safety number is what closes that.

### How it works

| | |
|---|---|
| Identity | ECDH P-256, generated once. P-256 over X25519 because WebCrypto support for X25519 is still uneven, and a cipher nobody can run is not security. |
| Storage | The private key is stored **as a `CryptoKey`**, not as bytes. Generated non-extractable, so WebCrypto refuses to serialise the material even to itself. Verified in Chromium: survives a full reload, still derives ECDH, and `exportKey` throws. |
| Per message | A **fresh ephemeral keypair** every time, ECDH against their long-term key, discarded immediately. |
| KDF | HKDF-SHA256, fresh 32-byte salt per message, `info` binding both fingerprints. |
| AEAD | AES-256-GCM. Additional data commits to the wire version and both fingerprints, so a ciphertext replayed into another conversation fails to authenticate. |
| Key change | A different key arriving for a known conversation is stored with `changedAt`, verification is revoked, and the UI says so. Silent acceptance is how key substitution succeeds. |
| Refusal | Sending in a sealed conversation with no peer key **throws** rather than falling back to plaintext. A silent downgrade is the worst failure this feature could have. |

### What this does not do

- **Not a double ratchet.** Compromising the *recipient's* long-term key
  decrypts past messages they received. Sender-side forward secrecy is real —
  the ephemeral key is gone — receiver-side is not claimed.
- **Metadata is still Telegram's.** Who, when, how often, how long. Content
  only.
- **No backup.** The non-extractable key cannot be exported, so losing the
  browser profile loses the ability to read past sealed messages. That is the
  cost of the key being unexfiltratable, and it is a deliberate trade.

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
