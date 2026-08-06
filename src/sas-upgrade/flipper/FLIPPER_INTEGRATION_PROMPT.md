# PROMPT — Integrate Flipper Zero into SAS Hub

*Copy everything below into a fresh Claude Code session scoped to the `jacky` repo,
running on the mini PC that has the Flipper Zero physically connected (USB or paired
via Bluetooth). This is a standalone, self-contained task.*

---

You're adding Flipper Zero as a hardware capability module inside SAS Hub (the
Python 3.11 + Flask app in this repo, served by `serve.py` / `jacky_api.py`). SAS Hub
already has a working pattern for adding capabilities: JSON POST/GET routes in
`jacky_api.py`, a status card + action panel in `sas_ui/dashboard.html`, and squad-routed
AI analysis via the existing `POST /api/ask`. Follow that pattern — do not invent a new
architecture.

## Ground truth: what the Flipper Zero firmware actually does

The Flipper Zero firmware is **not to be modified**. It already runs an RPC server
(protobuf-based) over USB (CDC serial) and Bluetooth LE, used by the official qFlipper
app and lab.flipper.net. You are building a **client** that talks to that existing RPC
service — the same relationship qFlipper has to the Flipper, not a firmware change.

Full capability list, confirmed from the firmware source (`applications/main/`,
`lib/`, `applications/services/`):

| Domain | Capability | Firmware module |
|---|---|---|
| **SubGHz (RF)** | Scan/receive/transmit 300–928 MHz, frequency analyzer, protocol decode/encode, replay | `applications/main/subghz/`, `lib/subghz/` |
| **NFC** | Read/write/emulate ISO14443-3A/B, ISO15693 cards; card parser plugins | `applications/main/nfc/`, `lib/nfc/` |
| **Infrared** | Learn, transmit, universal remote, brute-force IR codes | `applications/main/infrared/`, `lib/infrared/` |
| **LF RFID** | Low-frequency RFID read/write/emulate | `applications/main/lfrfid/` |
| **iButton / 1-Wire** | Dallas protocol read/write/emulate | `applications/main/ibutton/`, `applications/main/onewire/` |
| **Bad USB** | HID keyboard/mouse emulation (scripted) | `applications/main/bad_usb/` |
| **GPIO** | Direct pin read/write/control | `applications/main/gpio/` |
| **U2F** | FIDO2 USB authenticator | `applications/main/u2f/` |
| **Storage** | File browser, SD card contents, `.sub`/`.nfc`/`.ir`/`.rfid` file formats | `applications/services/storage/` |
| **Bluetooth** | BLE pairing/session management | `applications/services/bt/` |
| **RPC transport** | Protobuf messages over USB CDC serial or BLE; multi-session (only one owner at a time per transport) | `applications/services/rpc/` |

Device info also exposed via RPC: battery %, firmware version, connected/disconnected
state — this is your status card data.

## What to build

### 1. `flipper_bridge.py` (new file, repo root or a `hardware/` subpackage — match
   existing jacky conventions)
A Python client for the Flipper's RPC protocol. Two transport backends:
- **USB (primary for a mini PC with a physical port):** serial CDC via `pyserial`.
- **Bluetooth LE (for phones / no USB port):** via `bleak`.

Do not hand-roll the protobuf schema — the Flipper firmware repo ships the actual
`.proto` definitions (see `applications/services/rpc/` and the companion
`flipperzero-protobuf` / `flipperzero_protobuf_py` ecosystem projects). Vendor or
pip-install the compiled protobuf bindings rather than redefining messages by hand;
mismatched schemas silently corrupt RPC framing.

Bridge responsibilities:
- Connect/disconnect, transport auto-detect (try USB first, fall back to configured BLE
  address).
- `get_status()` → battery, firmware version, connected transport.
- `list_storage(path)` → browse SD card (needed to pull saved `.sub`/`.nfc`/`.ir` files
  for display/reuse).
- Per-domain command wrappers: `subghz_scan()`, `subghz_transmit(file)`, `nfc_read()`,
  `nfc_emulate(file)`, `infrared_send(file)`, `infrared_learn()`, `ibutton_read()`,
  `badusb_run(script)`, `gpio_read(pin)` / `gpio_write(pin, value)`. Each returns a
  structured result (dict), not raw protobuf, so the Flask layer stays simple.
- Timeouts and a single "session busy" guard — RPC is single-owner per transport; two
  simultaneous commands must queue or reject cleanly, not corrupt the stream.

### 2. API endpoints in `jacky_api.py`
Mirror the JSON POST/GET shape of the existing `/api/bots/*`, `/api/shell` routes
already in this codebase:

- `GET /api/flipper/status` → connection state, battery, firmware version.
- `POST /api/flipper/connect` / `POST /api/flipper/disconnect` → transport select
  (`{"transport": "usb"}` or `{"transport": "ble", "address": "..."}`).
- `GET /api/flipper/storage?path=/ext` → list files on the Flipper's SD card.
- `POST /api/flipper/subghz/scan` → run a frequency scan, return detected signals.
- `POST /api/flipper/subghz/transmit` → `{"file": "..."}`, replay a saved signal.
- `POST /api/flipper/nfc/read` → poll for a card, return UID/type/data.
- `POST /api/flipper/nfc/emulate` → `{"file": "..."}`.
- `POST /api/flipper/infrared/send` → `{"file": "..."}` or `{"protocol": "...", "code": "..."}`.
- `POST /api/flipper/infrared/learn` → capture an incoming IR signal, save it.
- `POST /api/flipper/ibutton/read` → read an iButton/1-Wire key.
- `POST /api/flipper/gpio` → `{"pin": N, "action": "read"|"write", "value": 0|1}`.
- `POST /api/flipper/badusb/run` → `{"script": "..."}` — **gate this behind the same
  whitelist/confirmation discipline `/api/shell` already uses.** BadUSB emulates a
  keyboard; treat it with the same caution as arbitrary command execution.
- `GET /api/flipper/results` → recent operation history/results (for the dashboard
  panel and for feeding into `/api/ask` analysis).

Every route should degrade gracefully (`503` + clear JSON error) when the Flipper is
disconnected, not throw a raw exception.

### 3. Dashboard UI (`sas_ui/flipper.html`, linked from `dashboard.html` the same way
   `/terminal` was linked)
- Status card: connected/disconnected, transport, battery %, firmware version.
- Per-domain action panel: buttons/forms for SubGHz scan+transmit, NFC read+emulate,
  IR send+learn, iButton read, GPIO read/write. Keep it functional over fancy —
  this mirrors the pattern used for the control routes and terminal pages already
  in this repo.
- Results panel: shows raw output of the last operation, with history (not just the
  last one — keep a scrollback so AI analysis can reference prior captures).

### 4. AI integration (this is not a single button — wire it in properly)

SAS Hub already has the pieces: `squad_manager.py` (10 bots), `situation_assessor.py`
(routing verdict), `cloud_router.py` (Groq → Gemini → OpenRouter fallback),
`resource_policy.py`, and `POST /api/ask`. Flipper data plugs into all of it, not just
a generic chat box.

**a. A dedicated squad bot — "Recon" (or similar name matching jacky's existing bot
   naming convention).** Add it to `squad_manager.py`'s bot roster with a system
   prompt specialized for RF/NFC/IR/hardware analysis (protocol identification, known
   vulnerability patterns, "what does this capture likely control"). Route Flipper
   analysis requests to this bot specifically via `task_type: "recon"` (or whatever
   `/api/ask`'s existing `task_type` dispatch convention is — check `jacky_core.py` for
   how task_type maps to bot selection) rather than the generic default bot. This
   matters: a general-purpose bot will hedge on "what protocol is this," a
   recon-specialized system prompt will actually commit to an answer.

**b. Local-first routing is the default for this domain, not optional.** RF captures,
   NFC dumps, and iButton reads are exactly the kind of data your "offline-first /
   survival-oriented" security posture (per the plan file's UPDATED VISION section) is
   meant to protect. Force `routing_override = "local_only"` for any request tagged
   `task_type: "recon"`, regardless of the user's global routing setting, unless they
   explicitly opt out per-request (`{"allow_cloud": true}` in the request body). Do not
   silently send capture data to Groq/Gemini/OpenRouter by default.

**c. Per-domain analysis prompts, not one generic "explain this":**
   - SubGHz result → ask the bot to identify likely protocol family (fixed-code vs
     rolling-code, known modulation) and flag if it matches a common vulnerable
     pattern (e.g., static fixed-code garage remotes are replay-vulnerable — the bot
     should say so, not just describe the waveform).
   - NFC result → identify card type/vendor from UID/ATQA/SAK bytes, and flag known-weak
     tech (e.g., MIFARE Classic's crypto weaknesses) if applicable.
   - IR result → identify protocol (NEC, RC5, SIRC, etc.) and, if a device database
     lookup exists in the codebase already, cross-reference to a device model.
   - iButton/LF RFID → identify format (Dallas, EM4100, HID Prox, etc.) and note
     known cloning/emulation implications.
   Implement this as distinct prompt templates the Flask layer selects by domain, all
   still going through the one `/api/ask` call — don't build parallel AI codepaths.

**d. Auto-analysis toggle.** A per-session setting (stored the same way `config.json`
   stores other runtime toggles) that, when on, automatically fires the relevant
   analysis prompt immediately after every capture instead of waiting for a manual
   "Analyze" click. Default off (keep it opt-in — auto-firing AI calls on every scan
   could hammer local Ollama unnecessarily); expose the toggle in the dashboard panel.

**e. Natural-language command layer (optional, second pass — flag if scope is tight).**
   A single text box where the operator types something like *"scan 433MHz and tell me
   what's out there"* or *"read this NFC card and check if it's a known-weak type."*
   The AI (via `/api/ask`, `task_type: "recon"`) parses intent and returns a structured
   action (`{"action": "subghz_scan", "params": {...}}`), which the frontend then
   executes against the real `/api/flipper/*` endpoints — closing the loop between
   conversational control and actual hardware action. This is the same "AI has hands"
   principle as the rest of SAS Hub, applied to Flipper specifically. Build this only
   after (a)–(d) are working; it depends on them.

**f. Session memory for comparisons.** Because the results panel keeps scrollback (see
   above), the AI prompt should be able to include 2–3 prior captures as context when
   asked things like *"compare this to the signal from 10 minutes ago"* — pass the
   scrollback array into the `/api/ask` context, not just the single latest result.

**g. BadUSB script generation.** If the operator asks the AI to "write a BadUSB script
   that does X," route that through `/api/ask` with a prompt template that outputs
   Flipper's BadUSB DuckyScript syntax, then let the operator review before it's ever
   sent to `POST /api/flipper/badusb/run` — never auto-execute AI-generated BadUSB
   scripts without a human confirmation step in the UI.

### 5. Connection strategy (already decided, don't relitigate)
Wireless-first for portability, but the mini PC use case is USB-first since it's a
fixed machine with a port: **USB primary, BLE secondary** (for when the operator wants
to trigger it from a phone instead). No network-bridge tier for v1 — skip it.

## Constraints
- **Do not modify the Flipper firmware repo.** This integration is entirely a client
  living in `jacky`.
- **Do not weaken `/api/shell`'s existing whitelist** while building BadUSB support —
  if anything, apply the same discipline to the new BadUSB route.
- Reuse `jacky`'s existing auth pattern on every new route (same as `/api/bots/*`).
- Keep it Python-only, no build step for the dashboard page (vanilla HTML/JS, matching
  `dashboard.html` and `terminal.html`).
- One RPC session at a time — do not let two dashboard tabs both try to drive the
  Flipper simultaneously without a clear "busy" response.

## Verification (must actually run against physical hardware)
1. Connect the Flipper via USB. `GET /api/flipper/status` → returns real battery %
   and firmware version (not a stub).
2. `POST /api/flipper/subghz/scan` → detects an actual signal in range (test with a
   known remote, e.g. a garage door or car fob you own).
3. `POST /api/flipper/nfc/read` with a real NFC card/tag present → returns a real UID.
4. `POST /api/flipper/infrared/learn` pointed at a TV remote → captures and saves a
   signal; `infrared/send` on that saved file actually controls the device.
5. Disconnect the Flipper mid-session → next API call returns a clean `503`, not a
   crash or hang.
6. From the dashboard panel, hit "Analyze" on an NFC read result → confirm the request
   routes to the Recon bot specifically (check server logs for which bot/model was
   selected — should NOT be the generic default), and the response correctly identifies
   the card type from the UID.
7. Confirm local-only routing: with cloud providers enabled globally in SAS settings,
   trigger a Flipper analysis and verify (via logs) it stayed local (Ollama), not
   Groq/Gemini/OpenRouter — proving the `routing_override = local_only` force is
   actually applied for `task_type: "recon"`.
8. Toggle auto-analysis on, do a fresh SubGHz scan, confirm the AI read fires
   automatically without a manual click.
9. If the natural-language command layer (4e) was built: type "read this NFC card" with
   a card present → confirm it correctly calls `/api/flipper/nfc/read` and returns a
   result, not just a text description of what it would do.

## Explicitly not in this task
Firmware modification, custom Flipper apps (FAP plugins), training/AI model work,
multi-Flipper orchestration (one device for v1). Those are separate future phases.
