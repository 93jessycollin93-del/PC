---
name: Flipper Zero firmware update feature
description: Real GitHub release fetching + WebUSB DFU flashing added to FlipperZeroApp; platform limits and design choices to remember.
---

FlipperZeroApp's "Firmware" tab fetches real latest-release data from GitHub (`/repos/<owner>/<repo>/releases/latest`) for a selectable source (official `flipperdevices/flipperzero-firmware` or `DarkFlippers/unleashed-firmware`), and can flash `.dfu` assets to a real device over WebUSB using the STM32 DfuSe protocol (AN3156).

**Why a source selector, not just official:** user wants "future proof" — community firmware (Unleashed) unlocks extra protocols/regions and is a common alternative; the fetch logic is repo-agnostic so adding more sources later is just another entry in `FIRMWARE_SOURCES`.

**Platform constraint (important, don't re-litigate):** iOS browsers (including all iOS browser engines, since WebKit is mandated) do not expose WebUSB or Web Serial — there is no way to flash firmware to a Flipper Zero from an iPhone browser. The real fix path for iOS users is Flipper's own official "Flipper Mobile" app (BLE-based OTA update), not this web app. The Firmware tab explicitly tells iOS/unsupported-browser users this and points them to the official app instead of pretending to work.

**How to apply:** if asked to extend hardware-flashing features for other USB/BLE devices, check API support (`'usb' in navigator`, `'serial' in navigator`, `'bluetooth' in navigator`) and if on iOS, be upfront about the OS-level restriction rather than building a flow that will silently fail there.

**DFU protocol correctness lessons (from a 3-round code review before this passed):**
- DfuSe target header is 274 bytes: 6-byte "Target" signature + 1-byte alt setting + 4-byte named flag + 255-byte name + 4-byte targetSize + 4-byte numElements — easy to get the signature length/field widths wrong.
- GETSTATUS's `bwPollTimeout` is a 24-bit LE field starting at byte offset 1 of the 6-byte response (not the same 4 bytes as `bStatus`).
- Must actively poll GETSTATUS while state is DNBUSY (using the device's own `bwPollTimeout`) before sending the next DNLOAD, and must throw if it stays busy past a bounded retry count instead of silently continuing.
- Erase must cover every flash page in `[address, address+length)`, not just the first byte's page.
- Cleanup (CLRSTATUS/ABORT/releaseInterface/close) must run in a single shared `finally` for both success and failure, all individually try/catch-guarded, because the device commonly disconnects itself right after a successful manifestation/reboot.
