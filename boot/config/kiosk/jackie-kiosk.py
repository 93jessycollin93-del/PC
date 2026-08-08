#!/usr/bin/env python3
"""Fullscreen WebKitGTK kiosk shell for Jackie's PC.

Chromium and Firefox ship only as snap stubs on Ubuntu, and snaps do not work
inside a live-image chroot, so the kiosk is a WebKitGTK window instead. It
waits for the local app server to answer, then shows it fullscreen with no
browser chrome.
"""

import os
import sys
import threading
import urllib.error
import urllib.request

import gi

gi.require_version("Gtk", "3.0")
gi.require_version("WebKit2", "4.1")

from gi.repository import GLib, Gtk, WebKit2  # noqa: E402

APP_URL = os.environ.get("JACKIE_KIOSK_URL", "http://127.0.0.1:5000/")
# Long enough to cover a slow first boot off a USB 2.0 stick.
STARTUP_TIMEOUT = int(os.environ.get("JACKIE_KIOSK_TIMEOUT", "180"))
POLL_INTERVAL = 1.0


def server_is_up(url: str, timeout: float = 2.0) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            return response.status < 500
    except (urllib.error.URLError, OSError, ValueError):
        return False


class Kiosk(Gtk.Window):
    def __init__(self) -> None:
        super().__init__(title="Jackie's PC")
        self.set_decorated(False)
        self.fullscreen()
        self.connect("destroy", Gtk.main_quit)

        # The splash stays up until the Node server answers, so a slow boot
        # looks like booting rather than like a crash.
        self.splash = Gtk.Label()
        self.splash.set_markup(
            "<span font='26' weight='bold' foreground='#e4e4e7'>JACKIE'S PC</span>\n"
            "<span font='12' foreground='#a1a1aa'>starting workspace…</span>"
        )
        self.splash.set_justify(Gtk.Justification.CENTER)

        self.webview = WebKit2.WebView()
        self._configure_webview()

        self.stack = Gtk.Stack()
        self.stack.add_named(self.splash, "splash")
        self.stack.add_named(self.webview, "web")
        self.stack.set_visible_child_name("splash")
        self.add(self.stack)

        self.connect("key-press-event", self._on_key)
        self.webview.connect("load-failed", self._on_load_failed)

        threading.Thread(target=self._wait_for_server, daemon=True).start()

    def _configure_webview(self) -> None:
        settings = self.webview.get_settings()
        settings.set_enable_developer_extras(False)
        settings.set_enable_write_console_messages_to_stdout(True)
        # The app ships an onnxruntime WASM bundle and uses IndexedDB.
        settings.set_enable_webgl(True)
        settings.set_enable_javascript(True)
        settings.set_javascript_can_access_clipboard(True)
        settings.set_enable_page_cache(True)
        settings.set_hardware_acceleration_policy(
            WebKit2.HardwareAccelerationPolicy.ON_DEMAND
        )
        # No right-click menu: there is no second window to open things into.
        self.webview.connect("context-menu", lambda *_: True)

        data_manager = self.webview.get_website_data_manager()
        if data_manager is not None:
            data_manager.set_tls_errors_policy(WebKit2.TLSErrorsPolicy.IGNORE)

    def _wait_for_server(self) -> None:
        waited = 0.0
        while waited < STARTUP_TIMEOUT:
            if server_is_up(APP_URL):
                GLib.idle_add(self._show_app)
                return
            GLib.usleep(int(POLL_INTERVAL * 1_000_000))
            waited += POLL_INTERVAL
        GLib.idle_add(self._show_timeout)

    def _show_app(self) -> bool:
        self.webview.load_uri(APP_URL)
        self.stack.set_visible_child_name("web")
        self.webview.grab_focus()
        return False

    def _show_timeout(self) -> bool:
        self.splash.set_markup(
            "<span font='20' weight='bold' foreground='#f87171'>Workspace did not start</span>\n"
            "<span font='11' foreground='#a1a1aa'>"
            f"No response from {GLib.markup_escape_text(APP_URL)} after {STARTUP_TIMEOUT}s.\n"
            "Press Ctrl+Alt+F2 for a console, then: journalctl -u jackie-pc"
            "</span>"
        )
        return False

    def _on_load_failed(self, _view, _event, _uri, _error) -> bool:
        # A failed load usually means the server restarted; retry rather than
        # leaving a blank white window on screen.
        self.stack.set_visible_child_name("splash")
        threading.Thread(target=self._wait_for_server, daemon=True).start()
        return True

    def _on_key(self, _widget, event) -> bool:
        from gi.repository import Gdk

        ctrl = event.state & Gdk.ModifierType.CONTROL_MASK
        alt = event.state & Gdk.ModifierType.MOD1_MASK
        key = Gdk.keyval_name(event.keyval) or ""

        if key in ("F5", "r", "R") and ctrl:
            self.webview.reload()
            return True
        if ctrl and alt and key in ("q", "Q"):
            Gtk.main_quit()
            return True
        return False


def main() -> int:
    if not Gtk.init_check()[0]:
        print("kiosk: no display available", file=sys.stderr)
        return 1
    window = Kiosk()
    window.show_all()
    Gtk.main()
    return 0


if __name__ == "__main__":
    sys.exit(main())
