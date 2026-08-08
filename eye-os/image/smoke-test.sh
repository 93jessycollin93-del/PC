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
# With KVM this boots in well under a minute. Under TCG emulation — no
# /dev/kvm, which is the normal case in a container or on a CI runner — the
# same boot takes many minutes, so the default has to follow the mode rather
# than fail the run for being slow.
if [ -w /dev/kvm ]; then
  TIMEOUT="${TIMEOUT:-180}"
else
  TIMEOUT="${TIMEOUT:-900}"
fi

# Three modes, each exercising more of the real path than the last:
#
#   kernel  QEMU loads the kernel directly. No firmware, no bootloader, so a
#           failure here is always the system's own.
#   disk    UEFI firmware, GPT, ESP, systemd-boot, root on a virtio disk.
#   usb     the same, but the image is attached as a USB mass storage device
#           behind an xHCI controller — which is what a written USB stick
#           actually is. This is the only mode that proves the initramfs
#           carries the xhci and usb-storage drivers it needs to find root;
#           virtio never touches that code, so a virtio boot passing tells you
#           nothing about whether the stick will come up.
#
# --repeat N runs the whole thing N times and reports each. Boot ordering is
# not deterministic — device probe, seat acquisition and service start all
# race — so one green run is weaker evidence than it looks.
MODE="kernel"
REPEAT=1
while [ $# -gt 0 ]; do
  case "$1" in
    --kernel) MODE="kernel" ;;
    --disk) MODE="disk" ;;
    --usb) MODE="usb" ;;
    --repeat)
      REPEAT="$2"
      shift
      ;;
    *)
      echo "unknown option: $1" >&2
      exit 2
      ;;
  esac
  shift
done

# Each run gets its own log so a flaky failure is still there to read after
# the next run starts.
LOG="$OUT/smoke-$MODE.log"

# Repeats re-invoke this script rather than looping inside it, so every run is
# a genuinely fresh process, fresh firmware and fresh disk state.
if [ "$REPEAT" -gt 1 ]; then
  passes=0
  for run in $(seq 1 "$REPEAT"); do
    printf '\n══════════ run %d of %d (%s) ══════════\n' "$run" "$REPEAT" "$MODE"
    if "$0" "--$MODE"; then
      passes=$((passes + 1))
    else
      cp "$LOG" "$OUT/smoke-$MODE-fail-$run.log" 2>/dev/null || true
      echo "  (serial log kept at $OUT/smoke-$MODE-fail-$run.log)" >&2
    fi
  done
  printf '\n%d/%d runs passed (%s)\n' "$passes" "$REPEAT" "$MODE"
  [ "$passes" -eq "$REPEAT" ] || exit 1
  exit 0
fi

if [ "$MODE" = "kernel" ]; then
  [ -f "$OUT/rootfs.ext4" ] || {
    echo "no out/rootfs.ext4 — run build.sh first" >&2
    exit 1
  }
else
  [ -f "$OUT/eye-os.img" ] || {
    echo "no out/eye-os.img — run build.sh --disk first" >&2
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
fi

# Every marker is a line one component prints only once it has genuinely
# started: the target line is systemd's own, and the two eye-* lines come
# from the units in the overlay.
#
# Matched case-insensitively, because systemd renders the target as "Reached
# target graphical.target - Graphical Interface" when journald is forwarded to
# the console and as "Reached target Graphical Interface" in its pretty
# output. Both are the same event and either one counts.
MARKERS=(
  "systemd[1]:"
  # The security layer has to come up before the session, not alongside it.
  # If the firewall did not load, the session server's 0.0.0.0 bind is live
  # on the network, so a boot that skipped it is a failed boot.
  "eye-firewall: ruleset loaded"
  "eye-provision:"
  "eye-hostd: serving"
  "Reached target graphical"
  "eye-kiosk: starting"
  # The end-to-end one, and the reason the list does not stop above.
  #
  # "eye-kiosk: starting" only proves the launcher ran. Earlier boots reported
  # a healthy session on that marker while cage was dying on EGL immediately
  # after and restarting forever — green test, black screen.
  #
  # A GET for the page itself can only happen if the compositor came up, the
  # browser got a surface, and it loaded the session. That is the claim worth
  # testing.
  'eye-hostd: "GET / HTTP'
  # The security posture, asserted from the booted machine rather than from
  # the files that were supposed to produce it. eye-audit reads the loaded
  # ruleset, the open sockets, /proc/sys and /proc/mounts; "0 failed" means
  # every control this image claims is actually in force on this boot.
  "0 failed"
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
  "Failed to start eYe OS host agent"
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
  # -vga none matters, and cost a whole debugging cycle to find. q35 provides
  # a default VGA (1234:1111, bochs-drm) and adding virtio-gpu-pci on top of
  # it gives the guest TWO DRM devices. wlroots then takes its multi-GPU path
  # and tries to import buffers across them over DMA-BUF, which software
  # rendering cannot do — so the compositor dies with "Failed to import source
  # buffer into multi-GPU renderer" on a machine that has no GPU problem at
  # all. One GPU, like the hardware this image actually targets.
  -vga none
  -device virtio-gpu-pci
  -netdev user,id=net0
  -device virtio-net-pci,netdev=net0
  -nographic
  -no-reboot
)

case "$MODE" in
  disk)
    # The kernel command line here comes from the loader entry on the ESP, not
    # from this script — which is exactly what makes this a test of the boot
    # chain rather than a second test of the same rootfs.
    # shellcheck disable=SC2054  # commas belong to QEMU's option syntax
    QEMU_ARGS+=(
      -drive "if=pflash,format=raw,readonly=on,file=$OVMF"
      -drive "file=$OUT/eye-os.img,format=raw,if=virtio"
    )
    ;;
  usb)
    # A written USB stick, as faithfully as QEMU can present one: an xHCI
    # controller with a mass storage device on it, and firmware that has to
    # find the ESP there. Root is located by LABEL, so the initramfs must
    # load xhci_pci and usb-storage before it can mount anything.
    # shellcheck disable=SC2054  # commas belong to QEMU's option syntax
    QEMU_ARGS+=(
      -drive "if=pflash,format=raw,readonly=on,file=$OVMF"
      -device qemu-xhci,id=xhci
      -drive "if=none,id=usbstick,format=raw,file=$OUT/eye-os.img"
      -device usb-storage,bus=xhci.0,drive=usbstick,bootindex=0
    )
    ;;
  *)
    # shellcheck disable=SC2054  # commas belong to QEMU's option syntax
    QEMU_ARGS+=(
      -kernel "$OUT/vmlinuz"
      -initrd "$OUT/initrd.img"
      -drive "file=$OUT/rootfs.ext4,format=raw,if=virtio"
      -append "root=/dev/vda rw console=ttyS0,115200 systemd.journald.forward_to_console=1 systemd.log_level=info"
    )
    ;;
esac
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
  # Wait for *every* marker, not the last one in the array. Markers do not
  # complete in the order they are listed — the posture check and the
  # browser's first page request race, and whichever lands first used to end
  # the run and fail the other. Two consecutive runs disagreed about which,
  # which is what exposed it.
  missing=0
  for pattern in "${MARKERS[@]}"; do
    grep -qiF "$pattern" "$LOG" 2>/dev/null || {
      missing=1
      break
    }
  done
  if [ "$missing" -eq 0 ]; then
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
