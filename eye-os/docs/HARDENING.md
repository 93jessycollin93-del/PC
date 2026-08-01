# eYe OS against the field

What twenty widely-used operating systems do about hardening, where eYe OS
already matches them, and where it does not.

The comparison is here because "powerful security foundation" is not a
checklist you can self-assess. The useful question is which of these controls
a given machine actually has in force, which is why every row eYe OS claims is
checked by `eye-audit` against live kernel and service state rather than
against a config file.

## The eleven controls

| # | Control | Why it matters |
|---|---|---|
| 1 | Verified boot | Firmware refuses a modified kernel or root |
| 2 | Immutable / read-only root | A compromise does not survive reboot |
| 3 | A/B updates + rollback | A bad update does not brick the machine |
| 4 | Encryption at rest | A stolen machine is not a data breach |
| 5 | Mandatory access control | Confinement the process cannot opt out of |
| 6 | App sandboxing | One app's compromise is not the machine's |
| 7 | Default-deny **egress** | Malware cannot phone home |
| 8 | No remote access by default | No sshd, no console login |
| 9 | Kernel hardening (sysctl/KSPP) | Removes standard exploit primitives |
| 10 | Module lockdown / minimal drivers | Less kernel attack surface |
| 11 | Runtime attestation | You can check posture on the machine |

Note the distinction in 7: nearly every OS ships a default-deny *inbound*
firewall. Almost none restricts **outbound** traffic. That is the control that
stops a compromised dependency exfiltrating, and outside Tails, Whonix and
Qubes essentially nothing does it by default.

## The field

`Y` in force by default · `~` available but not default, or partial · `-` no

| OS | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| iOS / iPadOS | Y | Y | Y | Y | Y | Y | - | Y | Y | Y | Y |
| Android | Y | Y | Y | Y | Y | Y | - | Y | Y | Y | Y |
| ChromeOS | Y | Y | Y | Y | Y | Y | - | Y | Y | Y | Y |
| macOS | Y | Y | ~ | ~ | Y | Y | - | ~ | Y | Y | ~ |
| Windows 11 | Y | - | ~ | ~ | ~ | Y | - | ~ | Y | Y | ~ |
| Bottlerocket | Y | Y | Y | ~ | Y | Y | - | Y | Y | Y | ~ |
| Talos Linux | Y | Y | Y | ~ | Y | ~ | - | Y | Y | Y | ~ |
| Flatcar | Y | Y | Y | ~ | Y | ~ | - | ~ | Y | ~ | - |
| SteamOS 3 | ~ | Y | Y | ~ | - | ~ | - | ~ | ~ | - | - |
| Fedora Silverblue | ~ | Y | ~ | ~ | Y | Y | - | ~ | ~ | - | - |
| openSUSE MicroOS | ~ | Y | Y | ~ | Y | ~ | - | ~ | ~ | - | - |
| RHEL / Rocky | ~ | - | - | ~ | Y | ~ | - | ~ | ~ | ~ | ~ |
| Ubuntu | ~ | - | - | ~ | Y | ~ | - | ~ | ~ | - | - |
| Debian | ~ | - | - | ~ | ~ | ~ | - | ~ | ~ | - | - |
| Arch | - | - | - | ~ | - | - | - | ~ | - | - | - |
| Alpine | - | ~ | - | ~ | - | - | - | Y | ~ | Y | - |
| FreeBSD | ~ | - | - | ~ | ~ | Y | - | ~ | ~ | ~ | - |
| OpenBSD | ~ | - | - | ~ | Y | Y | - | Y | Y | Y | - |
| Qubes OS | ~ | ~ | - | Y | Y | Y | Y | Y | Y | Y | - |
| Tails | - | Y | - | Y | Y | ~ | Y | Y | Y | ~ | - |
| Whonix | - | - | - | ~ | Y | ~ | Y | Y | Y | ~ | - |
| **eYe OS** | **-** | **-** | **-** | **-** | **-** | **~** | **Y** | **Y** | **Y** | **Y** | **Y** |

## Where eYe OS already stands with the best of them

**Default-deny egress (7).** Three of twenty-one do this. `firewall.nft` sets
`policy drop` on input, output *and* forward, with egress permitted only to
addresses named in `allowed-egress.conf`, which ships empty. A machine that has
not been told where it may go, does not go anywhere. Neither ChromeOS nor
Android nor iOS does this — they restrict what apps may do, not where the
device may connect.

**No remote access (8).** No sshd, `ssh.service` masked so a later `apt-get`
cannot start one, no getty on any console including serial, root locked, no
account with a usable password. This matches Talos and Bottlerocket, which are
the strictest in the field on this point.

**Kernel hardening (9).** `sysctl.d/99-eye-hardening.conf` applies the KSPP and
CIS baseline: restricted kernel pointers and ring buffer, `ptrace_scope=2`,
unprivileged BPF off, kexec disabled, `perf_event_paranoid=3`, protected
symlinks and hardlinks, no core dumps from setuid processes, plus the network
stack settings.

**Minimal drivers (10).** `modprobe.d/eye-blacklist.conf` refuses about thirty
filesystem and protocol modules — the parsers reachable by inserting a USB
stick or receiving a crafted packet — using `install <mod> /bin/false` rather
than `blacklist`, which only stops alias-based loading. FireWire and
Thunderbolt go too, since both allow a device to DMA host memory.

**Runtime attestation (11).** This is the one where eYe OS is ahead of most of
the field, and it is the cheapest of the eleven. `eye-audit` reads the loaded
nftables ruleset, the open sockets, the running units and their confinement,
`/proc/sys`, `/proc/mounts` and `/etc/shadow`, and reports what is actually in
force. Nothing is inferred from configuration. Android and ChromeOS do
attestation to a server; eYe OS does it to you, on the machine, in one command.

**Partial app sandboxing (6).** The session runs under WebKit's own renderer
sandbox, and `eye-hostd` refuses the exec, build and filesystem routes ahead of
the session server. That is real, but it is not per-app confinement in the
sense iOS or Android mean, hence the `~`.

## Where it does not, and what each would take

**Verified boot (1)** — the largest single gap. Nothing checks the kernel or
root filesystem before running them. The path: emit a dm-verity hash tree at
build time, put the root hash in the loader entry, sign the image, enable
Secure Boot. Everything above `~` in column 1 does this; it is the difference
between "read-only by convention" and "read-only, enforced".

**Immutable root (2)** — the root filesystem is read-write, so a compromise
persists across reboot. Cheaper than (1) and worth doing first: mount `/` `ro`
and overlay `/etc` and `/var` onto the data partition. `eye-audit` already
reports this as a warning on every run.

**A/B updates (3)** — the image is baked once and has no update mechanism at
all. Two root slots plus a boot-counter is the pattern; systemd-boot supports
it natively.

**Encryption at rest (4)** — `/var/lib/eye-os` holds the session's files, the
browser profile and the provisioned token in the clear. The obstacle is not
LUKS, it is unlocking on a device with no keyboard, which means sealing the key
to a TPM with a PCR policy. Deliberately not half-implemented.

**Mandatory access control (5)** — no AppArmor or SELinux profiles. This is the
best value of anything remaining: the base image is Ubuntu, AppArmor is already
running, and profiles for `eye-hostd`, `eye-pc` and the browser would be a
contained piece of work. It also partly compensates for the missing syscall
filter on `eye-pc` (see `SECURITY.md`).

## What this comparison is not

eYe OS is a single-purpose appliance. Several rows the mainstream OSes need —
multi-user isolation, app stores, driver ecosystems, per-user encrypted
profiles — do not apply, and scoring `-` on them would be misleading rather
than modest. Equally, its strong columns are partly a consequence of doing one
thing: it is easy to deny all egress when you know the machine has exactly one
job.

The honest summary is that eYe OS is currently strong on **policy** controls
(what the machine is permitted to do) and absent on **integrity** controls
(proving the machine is what it should be). Columns 1–4 are all the same
project: knowing the disk has not been altered and cannot be read by someone
holding it. That is the next body of work, and `ROADMAP.md` sequences it.
