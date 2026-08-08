# Bootable Jackie's PC

This directory turns Jackie's PC into a USB stick you can boot a computer from.

## What this actually is

Read this part before anything else, because it sets expectations correctly.

Jackie's PC is a **React web application**. It is not an operating system, it
has no kernel, and it cannot boot a machine on its own. What this directory
builds is a minimal **Ubuntu live system** whose only job is to start the app
full-screen with nothing else visible. You plug in the stick, the machine boots,
and you land in the workspace — no desktop, no browser chrome, no Ubuntu
branding.

So: the *experience* is "an OS that boots from USB". The *implementation* is
Linux running one app in a kiosk. That distinction matters when something
breaks, and it is why the troubleshooting steps below talk about `systemctl`.

The host machine's own disk is never touched. This runs entirely from the USB
stick and RAM.

## Building the image

Requires a Debian or Ubuntu host, root, ~12GB of free disk, and a network
connection.

```bash
sudo apt-get install -y debootstrap squashfs-tools xorriso \
    grub-pc-bin grub-efi-amd64-bin mtools dosfstools

sudo ./boot/build-iso.sh
```

The result is `boot/out/jackies-pc.iso` plus a `.sha256` next to it. A full run
takes roughly 30–50 minutes, most of it in `debootstrap` and the squashfs
compression.

Useful flags:

| Flag | Effect |
|---|---|
| `--skip-app` | Reuse the existing `dist/` instead of rebuilding the web app |
| `--keep-work` | Leave `boot/work/` behind so you can inspect the chroot |
| `--fast` | Compress with zstd instead of xz — much quicker, ~15% bigger |
| `--suite NAME` | Build against a different Ubuntu suite (default `noble`) |
| `--output NAME` | Change the ISO filename |

## Checking the image before you commit a USB stick to it

```bash
sudo ./boot/scripts/verify-iso.sh
```

Confirms both boot paths are present, the casper payload is complete, and — by
mounting the squashfs — that the three services are installed *and enabled*, the
kiosk binaries and WebKitGTK typelib exist, and the app's runtime dependencies
came along. A unit that is present but not enabled boots to a black screen, so
that distinction is checked explicitly.

## Trying it without hardware

```bash
sudo apt-get install -y qemu-system-x86 ovmf
./boot/scripts/test-qemu.sh              # BIOS boot
MODE=uefi ./boot/scripts/test-qemu.sh    # UEFI boot
```

## Writing it to a USB stick

**This erases the target device.** Identify the stick first:

```bash
lsblk -o NAME,SIZE,TYPE,RM,MOUNTPOINT,MODEL
```

Then, passing the whole disk (`/dev/sdb`) rather than a partition (`/dev/sdb1`):

```bash
sudo ./boot/scripts/write-usb.sh boot/out/jackies-pc.iso /dev/sdb
```

The script refuses partitions, warns loudly on non-removable disks, asks you to
retype the device path, and verifies the written bytes against the image
afterwards.

On Windows, use [Rufus](https://rufus.ie) or
[balenaEtcher](https://etcher.balena.io) instead — write the ISO in **DD /
image mode**, not ISO-extract mode.

To boot it: restart, and pick the USB stick from the firmware boot menu (usually
`F12`, `F11`, `Esc`, or the `Option` key on a Mac).

## What you get

- Boots on both **UEFI and legacy BIOS** machines (hybrid image).
- Goes straight to the workspace full-screen; no login, no desktop behind it.
- Runs the real app server, so the local API routes work offline.
- Four boot menu entries: normal, persistent, safe graphics, and a console-only
  mode for when the kiosk itself is the problem.

## Persistence

By default every change is discarded at shutdown — the root filesystem is a RAM
overlay. To keep files between boots, add a second partition to the stick
labelled `casper-rw`:

```bash
# after writing the ISO, using the free space on the stick
sudo parted /dev/sdb mkpart primary ext4 4GiB 100%
sudo mkfs.ext4 -L casper-rw /dev/sdb3
```

Then choose **Jackie's PC (live, persistent)** in the boot menu.

## Secure Boot

This image is **not signed by Microsoft**, so a machine with Secure Boot enabled
will refuse to boot it. There is no way around that other than:

1. Entering firmware setup and disabling Secure Boot, or
2. Enrolling your own keys, or
3. Paying for a Microsoft-signed shim.

If the stick does not appear in the boot menu at all, or appears and is
immediately skipped, Secure Boot is the first thing to check.

## Configuration

Drop API keys into `/etc/jackie-pc/env` inside the running system to light up
the online AI panels:

```
GEMINI_API_KEY=...
```

The workspace runs fine without them; those panels just stay offline. On a
non-persistent stick this file resets on every boot — bake it into
`config/chroot-setup.sh` if you want it permanent, and remember that anything
baked in ships to whoever holds the stick.

## Security note — please read

`server.ts` hardcodes `app.listen(PORT, '0.0.0.0')`, and its `requireAuth()`
helper returns `true` whenever `JACKIE_API_TOKEN` is unset. That combination
means `/api/shell/exec`, `/api/build/run` and `/api/term-fs/*` are reachable
with no credentials by **anyone on the same network**.

We cannot fix that by setting a token, because the bundled frontend never sends
an `x-jackie-token` header — turning auth on would 403 the app's own features.

So the image ships `jackie-firewall.service`, an nftables rule that accepts port
5000 on `lo` and drops it everywhere else. Local use is unaffected; the network
sees nothing.

**If you disable that service, you are exposing remote shell execution to your
entire LAN.** Don't. The real fix belongs upstream in `server.ts` — either bind
to `127.0.0.1`, or have `requireAuth()` fail closed and teach the frontend to
send the token.

`jackie-pc.service` is also sandboxed with `ProtectSystem=strict`,
`ProtectHome=true` and `PrivateTmp=true`. Worth knowing because it is visible
from inside the app: anything reached through `/api/shell/exec` or the terminal
apps can read the system but can only *write* to `/opt/jackie-pc/data` and its
private `/tmp`. Everything is discarded at shutdown anyway on a non-persistent
stick; relax `ReadWritePaths` in the unit if you need more.

## How it fits together

| File | Role |
|---|---|
| `build-iso.sh` | Orchestrates the whole build |
| `config/packages.list` | What gets installed into the live system |
| `config/chroot-setup.sh` | Runs inside the chroot: users, services, initramfs |
| `config/kiosk/jackie-kiosk.py` | The fullscreen WebKitGTK browser shell |
| `config/kiosk/jackie-kiosk-session` | X session wrapper (openbox + kiosk) |
| `config/kiosk/jackie-firewall` | nftables loopback restriction |
| `config/systemd/*.service` | Boot units for server, kiosk and firewall |
| `config/grub/grub.cfg` | Boot menu |
| `scripts/verify-iso.sh` | Structural checks on a built image |
| `scripts/write-usb.sh` | Guarded USB flashing |
| `scripts/test-qemu.sh` | Boot the ISO in a VM |

### Why WebKitGTK instead of Chromium

On Ubuntu, `chromium-browser` and `firefox` are transitional stubs that install
snaps, and snaps cannot be installed inside a build chroot. WebKitGTK is a real
`.deb` with a normal dependency chain, so the kiosk is a small GTK window
wrapping a `WebKit2.WebView`. It also keeps the image meaningfully smaller.

## Troubleshooting

Press `Ctrl+Alt+F2` for a console at any time. The user is `jackie` with no
password.

```bash
systemctl status jackie-pc          # the app server
journalctl -u jackie-pc -b          # its logs
systemctl status jackie-kiosk       # the fullscreen browser
journalctl -u jackie-kiosk -b       # X and WebKit errors
curl -I http://127.0.0.1:5000/      # is the app answering at all?
```

**Black screen, no splash** — X failed to start. Check
`journalctl -u jackie-kiosk -b` and try the *safe graphics* boot entry.

**Splash sticks on "starting workspace…"** — the server never came up. Check
`journalctl -u jackie-pc -b`. Boot *console only* to poke at it directly.

**Stick does not appear in the boot menu** — Secure Boot, or the image was
written in ISO-extract mode rather than DD mode.

`Ctrl+Alt+Q` quits the kiosk; systemd restarts it a couple of seconds later.
`Ctrl+R` reloads the page.
