**You're adding Flipper Zero as a hardware capability module inside SAS Hub.** Firmware stays untouched — you're building a client against its existing RPC service (same relationship qFlipper has to the device), following SAS Hub's existing pattern of JSON routes in `jacky_api.py` + a dashboard panel + AI analysis via `/api/ask`.

**All capabilities to integrate**, confirmed from the firmware source:

| Domain | Capability |
|---|---|
| SubGHz | Scan/receive/transmit 300–928MHz, protocol decode, replay |
| NFC | Read/write/emulate ISO14443/ISO15693 cards |
| Infrared | Learn, transmit, universal remote, brute-force |
| LF RFID | Read/write/emulate |
| iButton/1-Wire | Dallas protocol read/write/emulate |
| Bad USB | HID keyboard/mouse emulation scripts |
| GPIO | Direct pin read/write |
| U2F | FIDO2 authenticator |
| Storage | Browse SD card, `.sub`/`.nfc`/`.ir`/`.rfid` files |
| Bluetooth | BLE pairing/session |

**Build:** `flipper_bridge.py` (USB primary via `pyserial`, BLE secondary via `bleak`, using the Flipper's actual protobuf RPC schema — don't hand-roll it) → matching `/api/flipper/*` routes for every domain above → a dashboard panel with per-domain controls + an "Analyze with AI" button that reuses the existing `/api/ask`.
