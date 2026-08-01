# Where this can go

Three tiers, with honest costs. This project is Tier 1.

## Tier 1 — boots into your UI  *(done — this repo)*

Linux kernel, systemd, a single-window compositor, your shell as the session.
Owns the boot, the display and the filesystem.

**Cost:** a weekend. **Status:** built.

## Tier 2 — a real distribution

What is missing before this is something you would hand to someone else:

### Process isolation

Today every app is a React component in one JavaScript heap. An app that
throws takes down the desktop with it, and `sandbox.ts`-style Worker isolation
(the approach `my-pc-companion` uses) is honest about not being a jail.

The fix is to stop shipping apps as components. Options, cheapest first:

| Approach | Isolation | Cost |
|---|---|---|
| One `<iframe>` per window, `sandbox` attribute, `postMessage` to the bus | Separate JS realm; a crash kills one window | Days. The bus already has the right shape for this — `emit`/`on` become `postMessage`. |
| One browser process per window (Tauri multi-window, or Chromium `--site-per-process` with a distinct origin per app) | OS process boundary, real memory limits | Weeks |
| Apps as native processes speaking to the shell over a socket | Full kernel isolation, seccomp, cgroups | Months, and apps stop being web apps |

The registry and the bus were built so this swap does not touch app code. That
was the point of the indirection.

### Packaging and updates

Right now `build.sh` bakes a fixed image. A distribution needs:

- **An installer.** Currently you `dd` the image. Real installs need
  partitioning, a target disk picker, and first-boot resize.
- **A/B update partitions.** The kiosk pattern — two root partitions, boot the
  one that verified — is what makes an unattended device safe to update.
  systemd-boot already supports it; the build needs to emit two slots.
- **Signed images.** Secure Boot plus dm-verity if the device leaves your desk.

### Hardware

The image carries a generic kernel and Mesa. What it does *not* handle:

- Wi-Fi needs `wpasupplicant` or `iwd`, plus a UI to pick a network. There is
  no networking app in the shell yet.
- Suspend/resume, battery, brightness, audio: all present in the kernel,
  none surfaced in the shell.
- Touchscreen calibration and on-screen keyboard (`squeekboard`) if the target
  is a tablet.

**Cost:** weeks to months, solo, and genuinely achievable.

## Tier 3 — a kernel from scratch

Bootloader → protected mode → GDT/IDT → interrupts → paging → scheduler →
syscalls → drivers → filesystem → userspace → libc → port a toolchain.

The early milestones are encouraging and fast: a booting "hello world" in
QEMU in a day or two, interrupts and paging within a few weeks, preemptive
multitasking a month or two in. `os.phil-opp.com` and the OSDev wiki will take
you that far.

Then it stops. The wall is never the kernel — it is drivers and userspace. USB
is an enormous stack. Wi-Fi is worse. A GPU driver alone is out of reach for
one person. And to run *this* shell you would need a browser engine, which
needs POSIX, threads, sockets, fonts and GPU underneath it. SerenityOS took
years and dozens of contributors to reach a browser that renders modern pages
passably.

**Cost:** years, and none of the code in this repository survives the trip.

**Worth doing anyway** — as a separate project, for the education. Just do not
expect it to converge with this one, because it will not.

## The actual recommendation

Take Linux for the boring half. The kernel is a solved commodity that is free
and better than anything you would write in a decade of evenings. The app
roster, the theming and the interaction design are the original work, and
those already exist.

Tier 2 is where the remaining value is.
