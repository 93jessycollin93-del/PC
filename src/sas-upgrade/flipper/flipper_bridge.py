"""
Flipper Zero RPC bridge for SAS Hub.

Talks to the Flipper's OWN, UNMODIFIED RPC server — the same protocol qFlipper
and lab.flipper.net use. This does not touch the firmware.

DEPENDENCY: uses the `flipperzero-protobuf-py` package (pip install
flipperzero-protobuf), which vendors the compiled .proto bindings from
https://github.com/flipperdevices/flipperzero-protobuf — the same submodule
referenced by the firmware repo at assets/protobuf. Do NOT hand-roll protobuf
messages; install that package so wire framing matches the real device exactly.

    pip install flipperzero-protobuf pyserial bleak

If flipperzero-protobuf's import path differs by version, adjust the imports
in _open_usb()/_open_ble() below — the rest of this module only depends on
the small FlipperBridge interface, not on protobuf internals leaking out.
"""

import glob
import json
import threading
import time
from dataclasses import dataclass, field
from typing import Optional


class FlipperBusyError(Exception):
    """Raised when a command is attempted while another is in flight."""


class FlipperNotConnectedError(Exception):
    """Raised when a command is attempted with no active session."""


@dataclass
class FlipperStatus:
    connected: bool = False
    transport: Optional[str] = None  # "usb" | "ble"
    battery_pct: Optional[int] = None
    firmware_version: Optional[str] = None
    device_name: Optional[str] = None


class FlipperBridge:
    """
    One bridge instance = one Flipper session. SAS Hub should hold a single
    module-level instance (see jacky_api.py integration notes at bottom of
    this file) — RPC is single-owner per transport, so this class enforces
    one in-flight command at a time via a lock, and raises FlipperBusyError
    rather than silently queuing (queuing hides latency problems; callers
    should retry or show "busy" in the UI).
    """

    def __init__(self, ble_address: Optional[str] = None):
        self._lock = threading.Lock()
        self._session = None  # underlying flipperzero_protobuf session object
        self._transport = None
        self.ble_address = ble_address

    # ---------------------------------------------------------------- connect

    def connect(self, transport: str = "auto") -> FlipperStatus:
        """
        transport: "auto" | "usb" | "ble"
        "auto" tries USB first (fixed mini-PC use case), falls back to BLE
        if a ble_address was configured.
        """
        if transport in ("auto", "usb"):
            port = self._find_usb_port()
            if port:
                self._open_usb(port)
                return self.get_status()
            if transport == "usb":
                raise FlipperNotConnectedError("No Flipper Zero found on USB (checked serial ports).")

        if transport in ("auto", "ble"):
            if not self.ble_address:
                raise FlipperNotConnectedError("No BLE address configured for Flipper.")
            self._open_ble(self.ble_address)
            return self.get_status()

        raise ValueError(f"Unknown transport: {transport}")

    def disconnect(self):
        with self._lock:
            if self._session is not None:
                try:
                    self._session.close()
                except Exception:
                    pass
            self._session = None
            self._transport = None

    def _find_usb_port(self) -> Optional[str]:
        """
        Flipper enumerates as a CDC serial device. On Linux this is typically
        /dev/ttyACM*; on the mini PC's actual OS adjust the glob pattern
        (Windows: use serial.tools.list_ports and match VID:PID 0483:5740).
        """
        candidates = glob.glob("/dev/ttyACM*") + glob.glob("/dev/serial/by-id/*flipper*")
        return candidates[0] if candidates else None

    def _open_usb(self, port: str):
        # flipperzero_protobuf's exact import path varies by package version —
        # this is the documented entry point as of the current PyPI release.
        from flipperzero_protobuf.flipper_serial import FlipperSerial
        from flipperzero_protobuf.flipper_proto import FlipperProto

        with self._lock:
            serial = FlipperSerial(port)
            self._session = FlipperProto(serial=serial)
            self._transport = "usb"

    def _open_ble(self, address: str):
        # BLE transport wraps the same protobuf framing over a GATT
        # characteristic instead of a serial port. See flipperzero_protobuf's
        # BLE transport class (name varies by version) — bleak handles the
        # underlying GATT connection.
        from flipperzero_protobuf.flipper_ble import FlipperBLE
        from flipperzero_protobuf.flipper_proto import FlipperProto

        with self._lock:
            ble = FlipperBLE(address)
            self._session = FlipperProto(serial=ble)
            self._transport = "ble"

    def _require_session(self):
        if self._session is None:
            raise FlipperNotConnectedError("Flipper not connected. Call connect() first.")

    # ----------------------------------------------------------------- status

    def get_status(self) -> FlipperStatus:
        self._require_session()
        with self._lock:
            info = self._session.rpc_device_info()  # returns dict of key/value device info
        return FlipperStatus(
            connected=True,
            transport=self._transport,
            battery_pct=info.get("power_info", {}).get("charge_level"),
            firmware_version=info.get("firmware_version"),
            device_name=info.get("device_name"),
        )

    def list_storage(self, path: str = "/ext") -> list:
        self._require_session()
        with self._lock:
            entries = self._session.rpc_storage_list(path)
        return [{"name": e.name, "type": e.type, "size": e.size} for e in entries]

    # ------------------------------------------------------------- sub-ghz

    def subghz_scan(self, duration_s: float = 5.0) -> dict:
        """Frequency scan. Returns detected signal(s) with frequency + raw capture ref."""
        self._require_session()
        with self._lock:
            result = self._session.rpc_subghz_rx(duration_s=duration_s)
        return {"signals": result}

    def subghz_transmit(self, file_path: str) -> dict:
        self._require_session()
        with self._lock:
            self._session.rpc_subghz_tx(file_path)
        return {"status": "transmitted", "file": file_path}

    # ------------------------------------------------------------------ nfc

    def nfc_read(self, timeout_s: float = 10.0) -> dict:
        self._require_session()
        with self._lock:
            card = self._session.rpc_nfc_detect(timeout_s=timeout_s)
        if card is None:
            return {"detected": False}
        return {
            "detected": True,
            "uid": card.uid.hex(),
            "atqa": getattr(card, "atqa", None),
            "sak": getattr(card, "sak", None),
            "type": getattr(card, "nfc_type", "unknown"),
        }

    def nfc_emulate(self, file_path: str) -> dict:
        self._require_session()
        with self._lock:
            self._session.rpc_nfc_emulate(file_path)
        return {"status": "emulating", "file": file_path}

    # ------------------------------------------------------------ infrared

    def infrared_send(self, file_path: Optional[str] = None,
                       protocol: Optional[str] = None, code: Optional[str] = None) -> dict:
        self._require_session()
        with self._lock:
            if file_path:
                self._session.rpc_infrared_send_file(file_path)
            else:
                self._session.rpc_infrared_send_raw(protocol, code)
        return {"status": "sent"}

    def infrared_learn(self, timeout_s: float = 15.0, save_as: Optional[str] = None) -> dict:
        self._require_session()
        with self._lock:
            captured = self._session.rpc_infrared_receive(timeout_s=timeout_s)
            if captured and save_as:
                self._session.rpc_storage_write(save_as, captured.raw)
        return {"captured": captured is not None, "protocol": getattr(captured, "protocol", None)}

    # --------------------------------------------------------------- ibutton

    def ibutton_read(self, timeout_s: float = 10.0) -> dict:
        self._require_session()
        with self._lock:
            key = self._session.rpc_ibutton_read(timeout_s=timeout_s)
        if key is None:
            return {"detected": False}
        return {"detected": True, "key_type": key.key_type, "id": key.id.hex()}

    # ------------------------------------------------------------------ gpio

    def gpio_read(self, pin: int) -> dict:
        self._require_session()
        with self._lock:
            value = self._session.rpc_gpio_read(pin)
        return {"pin": pin, "value": value}

    def gpio_write(self, pin: int, value: int) -> dict:
        self._require_session()
        with self._lock:
            self._session.rpc_gpio_write(pin, value)
        return {"pin": pin, "value": value}

    # ---------------------------------------------------------------- badusb

    def badusb_run(self, script: str) -> dict:
        """
        Caller (Flask layer) MUST enforce human confirmation + whitelist
        discipline before calling this — this method does not gate anything
        itself, matching how /api/shell's whitelist lives in the Flask layer.
        """
        self._require_session()
        with self._lock:
            self._session.rpc_badusb_run(script)
        return {"status": "running"}


# ---------------------------------------------------------------------------
# Flask integration notes (jacky_api.py) — pair with terminal_route.py's
# pattern: one module-level bridge instance, routes are thin wrappers that
# catch FlipperNotConnectedError/FlipperBusyError and return clean JSON.
#
#   flipper = FlipperBridge(ble_address=config.get("flipper_ble_address"))
#
#   @app.route('/api/flipper/status')
#   def api_flipper_status():
#       try:
#           s = flipper.get_status()
#       except FlipperNotConnectedError:
#           return jsonify({"connected": False}), 503
#       return jsonify(dataclasses.asdict(s))
#
# Repeat that try/except shape for every /api/flipper/* route in the prompt
# doc (FLIPPER_INTEGRATION_PROMPT.md) — each Flask route is now a 3-line
# wrapper around a method on this class, not something to design from scratch.
# ---------------------------------------------------------------------------
