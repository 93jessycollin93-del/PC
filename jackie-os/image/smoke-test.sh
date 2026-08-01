#!/usr/bin/env bash
#
# Boots the image headless and asserts that it actually came up.
#
# "It builds" and "it boots" are different claims, and only the second one
# matters. This makes the second one checkable without a screen: the guest is
# booted with journald forwarded to the serial console, so the log this reads
# contains what the services themselves printed rather than an inference from
# the fact that QEMU did not crash.
#
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$HERE/out"
LOG="$OUT/smoke-serial.log"
# With KVM this boots in well under a minute. Under TCG emulation — no
# /dev/kvm, which is the normal case in a container or on a CI runner — the
# same boot takes many minutes, so the default has to follow the mode rather
# than fail the run for being slow.
if [ -w /dev/kvm ]; then
  TIMEOUT="${TIMEOUT:-180}"
else
  TIMEOUT="${TIMEOUT:-900}"
fi

# Default exercises the system; --disk additionally exercises the boot chain
# (GPT, ESP, systemd-boot) that real hardware actually uses.
MODE="kernel"
[ "${1:-}" = "--disk" ] && MODE="disk"

if [ "$MODE" = "disk" ]; then
  [ -f "$OUT/jackie-os.img" ] || {
    echo "no out/jackie-os.img — run build.sh --disk first" >&2
    exit 1
  }
  OVMF=""
  for candidate in \
    /usr/share/OVMF/OVMF_CODE_4M.fd \
    /usr/share/OVMF/OVMF_CODE.fd \
    /usr/share/ovmf/OVMF.fd; do
    [ -f "$candidate" ] && OVMF="$candidate" && break
  done
  [ -n "$OVMF" ] || {
    echo "no OVMF firmware found (apt-get install ovmf)" >&2
    exit 1
  }
else
  [ -f "$OUT/rootfs.ext4" ] || {
    echo "no out/rootfs.ext4 — run build.sh first" >&2
    exit 1
  }
fi

# Every marker is a line one component prints only once it has genuinely
# started: the target line is systemd's own, and the two jackie-* lines come
# from the units in the overlay.
#
# Matched case-insensitively, because systemd renders the target as "Reached
# target graphical.target - Graphical Interface" when journald is forwarded to
# the console and as "Reached target Graphical Interface" in its pretty
# output. Both are the same event and either one counts.
MARKERS=(
  "systemd[1]:"
  "jackie-hostd: serving"
  "Reached target graphical"
  "jackie-kiosk: starting"
)
# Only in kernel-direct mode, where this script sets the command line and
# leaves the loglevel at the default. The disk boots at loglevel=4 from the
# loader entry, which suppresses the kernel's own banner — and asserting on it
# there would mean letting the test dictate how chatty the shipped device is.
# PID 1 running is proof enough that the kernel came up.
if [ "$MODE" = "kernel" ]; then
  MARKERS=("Linux version" "${MARKERS[@]}")
fi
# Any of these means the boot is already lost; fail fast instead of idling
# until the timeout.
FATAL=(
  "Kernel panic"
  "Failed to start Jackie OS host agent"
  "Emergency mode"
  "You are in emergency mode"
)

rm -f "$LOG"
echo "booting (timeout ${TIMEOUT}s) — serial log: $LOG"

# shellcheck disable=SC2054  # the commas belong to QEMU's own option syntax
QEMU_ARGS=(
  qemu-system-x86_64
  -machine q35
  -m "${MEM:-2048}"
  -smp "${CPUS:-2}"
  -device virtio-gpu-pci
  -netdev user,id=net0
  -device virtio-net-pci,netdev=net0
  -nographic
  -no-reboot
)

if [ "$MODE" = "disk" ]; then
  # The kernel command line here comes from the loader entry on the ESP, not
  # from this script — which is exactly what makes this a test of the boot
  # chain rather than a second test of the same rootfs.
  QEMU_ARGS+=(
    -drive "if=pflash,format=raw,readonly=on,file=$OVMF"
    -drive "file=$OUT/jackie-os.img,format=raw,if=virtio"
  )
else
  QEMU_ARGS+=(
    -kernel "$OUT/vmlinuz"
    -initrd "$OUT/initrd.img"
    -drive "file=$OUT/rootfs.ext4,format=raw,if=virtio"
    -append "root=/dev/vda rw console=ttyS0,115200 systemd.journald.forward_to_console=1 systemd.log_level=info"
  )
fi
if [ -w /dev/kvm ]; then
  QEMU_ARGS+=(-enable-kvm -cpu host)
else
  QEMU_ARGS+=(-cpu max)
fi

"${QEMU_ARGS[@]}" >"$LOG" 2>&1 &
QEMU_PID=$!
# Kill the guest however this script exits, including on a failed assertion.
trap 'kill "$QEMU_PID" 2>/dev/null || true' EXIT

deadline=$((SECONDS + TIMEOUT))
last=""
while [ "$SECONDS" -lt "$deadline" ]; do
  # `kill -0` succeeds on a zombie, and an un-waited background child is
  # exactly that once it exits — so checking the process state too is the
  # difference between noticing a dead guest and spinning until the timeout.
  qemu_state="$(ps -o state= -p "$QEMU_PID" 2>/dev/null || true)"
  if [ -z "$qemu_state" ] || [ "$qemu_state" = "Z" ]; then
    echo "qemu exited early" >&2
    break
  fi
  for pattern in "${FATAL[@]}"; do
    if grep -qiF "$pattern" "$LOG" 2>/dev/null; then
      echo
      echo "FATAL: guest reported '$pattern'" >&2
      tail -40 "$LOG" >&2
      exit 1
    fi
  done
  if grep -qiF "${MARKERS[-1]}" "$LOG" 2>/dev/null; then
    break
  fi
  # One dot per marker reached, so a slow boot still shows progress. The
  # trailing `true` matters: under `set -e` this substitution would otherwise
  # inherit the failing exit status of the last grep and abort the run before
  # the guest has printed anything at all.
  reached="$(
    for pattern in "${MARKERS[@]}"; do
      grep -qiF "$pattern" "$LOG" 2>/dev/null && printf '.'
    done
    true
  )"
  if [ "${#reached}" -gt "${#last}" ]; then
    printf '%s' "${reached:${#last}}"
    last="$reached"
  fi
  sleep 2
done
echo

status=0
for pattern in "${MARKERS[@]}"; do
  if grep -qiF "$pattern" "$LOG" 2>/dev/null; then
    printf '  \033[32mPASS\033[0m  %s\n' "$pattern"
  else
    printf '  \033[31mFAIL\033[0m  %s\n' "$pattern"
    status=1
  fi
done

if [ "$status" -ne 0 ]; then
  echo
  echo "last 40 lines of the serial log:" >&2
  tail -40 "$LOG" >&2
fi
exit "$status"
