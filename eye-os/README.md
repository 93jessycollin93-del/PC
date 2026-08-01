# eYe OS

A machine that boots into your PC application and nothing else. No login
prompt, no display manager, no desktop underneath — the kernel comes up, a
compositor takes the framebuffer, and your app is the machine.

The security foundation lives here rather than in the app, because that is the
only place some of it can be enforced. See [`docs/SECURITY.md`](docs/SECURITY.md);
run `eye-audit` on a booted machine to check any of it.

## Your app is not modified

`eye-os/` reads the PC application from the repository root, builds it into a
staging directory, and copies the result into the image. It changes nothing
outside `eye-os/`. All 60+ apps, all 16 themes, the service worker, the
manifest — they ship as they are.

Two sessions are installed:

- **`pc`** (default) — your application, plus its Express backend
- **`shell`** — a small recovery desktop that ships with eye-os, always
  installed, for when a change to the PC session leaves it unable to paint

Switch by editing `EYE_STATIC` in `/etc/eye-os/session.conf` and restarting
`eye-hostd` and `eye-kiosk`.

## Quick start

```sh
make check       # typecheck, lint, compile-check       (no root)
make dev         # hot-reload the recovery shell        (no root)

sudo make image  # build everything and bake the image  (~12 min, ~3GB)
make run         # boot it in a QEMU window
make smoke       # boot headless and assert it came up
```

Iterating? `sudo make rebuild` re-lays the sessions onto the existing rootfs
in about a minute instead of bootstrapping again.

For real hardware:

```sh
sudo make disk
sudo dd if=image/out/eye-os.img of=/dev/sdX bs=4M status=progress conv=fsync
```

`--no-pc` builds a recovery-only image with no Node and no session server.

## How it fits together

```
       tty1
        │
   eye-kiosk ──── cage ──── browser ──┐
                                      │  http://127.0.0.1:7788
                                      ▼
                                 eye-hostd ──── /api/fs   → the real disk
                                      │
                                      │  injects the session token,
                                      │  refuses /api/shell|build|term-fs
                                      ▼
                                  eye-pc  (127.0.0.1:5000)

                    all of it under nftables: default deny
```

`eye-hostd` is the only thing the browser talks to. It serves the session,
provides a real filesystem at `/api/fs`, and fronts your Express backend —
adding the credential the browser is never given, and refusing the routes that
would turn a compromised page into a compromised machine.

## Boot sequence

1. Firmware loads the kernel — systemd-boot on a real disk; QEMU loads it
   directly with `-kernel`, which takes the bootloader out of the picture when
   you are debugging.
2. `eye-firewall` loads the ruleset **before any interface comes up**, so a
   network appearing later cannot open a hole.
3. `eye-provision` generates this machine's session token, once.
4. `eye-pc` starts your Express backend on loopback.
5. `eye-hostd` serves the session on `127.0.0.1:7788`.
6. `eye-kiosk` claims tty1, opens a logind session — that is what
   `PAMName=login` is for; without it wlroots has no seat and cannot open the
   DRM device — and runs `cage` with a single browser client.

## The filesystem seam

The recovery shell's `kernel/vfs.ts` probes for `eye-hostd` at boot. In a
browser tab it mounts `localStorage`; on the booted machine it mounts a real
disk. Same code, same apps.

That seam matters for the PC session too: it is how those 60 apps eventually
get off `localStorage` and onto a real filesystem without any of them being
rewritten. `/api/fs` is already there and already serving.

## Layout

```
eye-os/
├── shell/                  the recovery desktop (a standalone web app)
│   └── src/kernel/         bus (IPC), vfs, window manager, app registry
├── image/
│   ├── build.sh            bootstraps the rootfs, bakes the image
│   ├── run.sh              boots it in QEMU
│   ├── smoke-test.sh       boots it headless and asserts it came up
│   ├── pc-vite-stub.mjs    keeps the build toolchain off the appliance
│   └── overlay/
│       ├── etc/eye-os/     firewall, egress allowlist, session policy
│       ├── etc/systemd/    the units that make it an appliance
│       └── opt/eye-os/bin/ hostd, kiosk, firewall-apply, provision, audit
└── docs/
    ├── SECURITY.md         threat model, what is enforced, what is not
    └── ROADMAP.md          what the tiers above and below this one cost
```

## Tests

```sh
make check                            # types, shellcheck, py_compile
make smoke                            # boots the image, asserts on serial
make smoke-disk                       # same, through UEFI and systemd-boot
npm --prefix shell run test:browser   # drives the shell in a real browser
eye-audit                             # on the machine: live security posture
```

The browser test needs Playwright, deliberately not a dependency — `make
image` would otherwise pull a browser download it has no use for:

```sh
npm --prefix shell install --no-save playwright && npx playwright install chromium
```

It is worth running. It caught a real defect: focusing a window on pointerdown
reordered the DOM mid-gesture, so the browser never delivered the `click`, and
Minimize on an unfocused window quietly did nothing until you clicked twice.

Without KVM (`/dev/kvm` absent, normal in a container) QEMU emulates and the
boot takes minutes rather than seconds; `smoke-test.sh` raises its own timeout
to match.

## Distributions

Ubuntu `noble` by default, Debian on request:

```sh
sudo SUITE=bookworm ./image/build.sh   # Debian, real Chromium
sudo ./image/build.sh                  # Ubuntu, Epiphany
```

Ubuntu ships Chromium only as a snap, which cannot run in a bootstrapped
rootfs. It matters less than it sounds: `cage` is what makes the session a
kiosk, and `eye-kiosk` detects the browser at runtime.

## What this is

A real operating system in every sense that matters here: it owns the boot,
the display, the filesystem and the network policy, and you can install it on
a laptop and hand that laptop to someone.

It runs the Linux kernel, deliberately. [`docs/ROADMAP.md`](docs/ROADMAP.md)
costs out the tiers above and below.
