# Jackie OS

A machine that boots straight into a desktop shell. No login prompt, no
display manager, no desktop environment underneath — the kernel comes up, a
compositor takes the framebuffer, and the shell is the only thing on screen.

This is a **new, self-contained project**. It borrows the architecture of the
apps in this repository (`components/apps/`) and of `my-pc-companion`, but
shares no code with either and changes nothing in them. They stay exactly as
they are; this is the OS layer they suggested.

## What is actually here

```
jackie-os/
├── shell/                  the desktop, a standalone web app
│   └── src/
│       ├── kernel/         bus (IPC), vfs, window manager, app registry
│       ├── ui/             desktop, windows, taskbar, notifications
│       ├── apps/           terminal, files, editor, system info, settings
│       └── themes/         CSS custom-property token sets
├── image/
│   ├── build.sh            bootstraps a Linux rootfs and bakes the image
│   ├── run.sh              boots the result in QEMU
│   └── overlay/            what gets laid onto the rootfs
│       ├── etc/systemd/system/   the two units that make it a kiosk
│       └── opt/jackie-os/bin/    host agent + session launcher
└── Makefile
```

## Quick start

```sh
make check      # typecheck the shell, lint the scripts   (no root)
make shell      # build the shell alone                   (no root)
make dev        # hot-reload the shell in your browser    (no root)

sudo make image # bootstrap the rootfs and build the image (~10 min, ~2GB)
make run        # boot it in a QEMU window
make smoke      # boot headless and assert the system came up
```

Iterating on the shell? `sudo make rebuild` re-lays it onto the rootfs from
the last build and re-bakes the images without bootstrapping again — about a
minute instead of ten.

`make run-serial` boots the same image headless with the console on your
terminal, which is how you read the boot log when something goes wrong.

## Tests

`make check` is static: types and shell lint. Two things actually exercise the
system:

```sh
make smoke                        # boots the image, asserts on the serial log
make smoke-disk                   # same, but through UEFI and systemd-boot
npm --prefix shell run test:browser   # drives the shell in a real browser
```

`make smoke` boots the kernel directly, so a failure is the system's fault.
`make smoke-disk` boots the GPT disk through OVMF and systemd-boot, which is
the path real hardware takes — run it when you change anything about
partitioning or the loader.

The browser test needs Playwright, which is deliberately not a dependency —
`make image` would otherwise pull a browser download it has no use for:

```sh
npm --prefix shell install --no-save playwright && npx playwright install chromium
```

It is worth running. It is what caught the fact that focusing a window on
pointerdown used to reorder the DOM mid-gesture, which stopped the browser
delivering the `click` — Minimize on an unfocused window quietly did nothing
until you clicked twice. No unit test would have seen that.

Without KVM (`/dev/kvm` absent, which is normal in a container) QEMU falls
back to emulation and the boot takes minutes rather than seconds; `smoke-test.sh`
raises its own timeout to match.

For real hardware:

```sh
sudo make disk  # adds a GPT + EFI system partition + systemd-boot
sudo dd if=image/out/jackie-os.img of=/dev/sdX bs=4M status=progress conv=fsync
```

## How the boot works

1. Firmware loads the kernel (systemd-boot on a real disk; QEMU loads it
   directly with `-kernel`, which takes the bootloader out of the picture
   entirely when you are debugging).
2. systemd reaches `graphical.target`.
3. `jackie-hostd.service` starts the host agent on `127.0.0.1:7788`. It serves
   the built shell and exposes `/api/fs` — the machine's real filesystem.
4. `jackie-kiosk.service` claims tty1, opens a logind session (that is what
   `PAMName=login` is for — without it wlroots has no seat and cannot open the
   DRM device), and runs `cage` with a single browser client.
5. The shell boots, probes for the host agent, and mounts the real filesystem
   instead of `localStorage`.

Step 5 is the interesting one. Open **System Info** and it will tell you which
backend won. In a browser tab it says `localStorage (browser)`; on the booted
image it says `host filesystem`. Same shell, same app code — the storage layer
is the only thing that changed.

## Try this once it boots

```
Terminal:  df
           write /home/hello.txt written from the terminal
Files:     navigate to /home — hello.txt is already there
```

Neither app imports the other. They share a VFS and a message bus, and
**System Info** renders every message that crosses that bus while you click,
so the architecture is inspectable rather than merely claimed.

## Distributions

`build.sh` targets Ubuntu `noble` by default and Debian if you ask for it:

```sh
sudo SUITE=bookworm ./image/build.sh    # Debian, gets real Chromium
sudo ./image/build.sh                   # Ubuntu, gets Epiphany
```

The split exists because Ubuntu ships Chromium only as a snap, which cannot
run inside a bootstrapped rootfs. It matters less than it sounds: `cage` is
what makes the session a kiosk, and it will host whichever browser is present.
`jackie-kiosk` detects the browser at runtime and picks the right flags.

## What this is and is not

It **is** a real operating system in every sense a user cares about: it owns
the boot, the filesystem and the display, and you can install it on a laptop
and hand that laptop to someone.

It is **not** a kernel written from scratch. It runs the Linux kernel, and
that is a deliberate choice — see [`docs/ROADMAP.md`](docs/ROADMAP.md) for
what the tiers above and below this one cost, and which parts of the shell
would have to change to get process isolation worth the name.

## Naming

"Jackie OS" appears in `shell/index.html` (the `<title>` and splash),
`image/build.sh` (`IMAGE_HOSTNAME`) and the two systemd unit descriptions.
Renaming is a find-and-replace across those; nothing keys off the name.
