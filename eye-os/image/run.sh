#!/usr/bin/env bash
#
# Boots the built image in QEMU.
#
# Default is direct kernel boot against rootfs.ext4: no bootloader, no
# firmware, so a failure here is always the system's fault and never the
# boot chain's. Pass --disk to exercise the real UEFI path instead.
#
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$HERE/out"

MODE="kernel"
GRAPHICS="gtk"
MEM="${MEM:-2048}"
CPUS="${CPUS:-2}"

usage() {
  cat <<'EOF'
run.sh [options]

  --disk        boot out/eye-os.img through UEFI instead of the kernel
  --serial      no window; console on this terminal (for CI and headless checks)
  --vnc :N      expose the display over VNC on port 5900+N
  --mem MB      guest RAM (default 2048)

Ctrl-A X quits when running with --serial.
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --disk) MODE="disk" ;;
    --serial) GRAPHICS="serial" ;;
    --vnc)
      GRAPHICS="vnc:$2"
      shift
      ;;
    --mem)
      MEM="$2"
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

command -v qemu-system-x86_64 >/dev/null || {
  echo "missing qemu-system-x86_64 (apt-get install qemu-system-x86)" >&2
  exit 1
}

# shellcheck disable=SC2054  # the commas belong to QEMU's own option syntax
QEMU=(
  qemu-system-x86_64
  -machine q35
  -m "$MEM"
  -smp "$CPUS"
  # virtio-gpu gives the guest a KMS device, which is what cage needs to find
  # an output. Without it wlroots has nothing to open and the session dies.
  -device virtio-gpu-pci
  -device virtio-tablet-pci
  -device virtio-keyboard-pci
  -netdev user,id=net0
  -device virtio-net-pci,netdev=net0
)

# KVM when the host offers it; without it this still runs, just slowly.
if [ -w /dev/kvm ]; then
  QEMU+=(-enable-kvm -cpu host)
else
  echo "note: /dev/kvm unavailable — emulating, expect a slow boot" >&2
  QEMU+=(-cpu max)
fi

case "$MODE" in
  kernel)
    [ -f "$OUT/rootfs.ext4" ] || {
      echo "no out/rootfs.ext4 — run build.sh first" >&2
      exit 1
    }
    QEMU+=(
      -kernel "$OUT/vmlinuz"
      -initrd "$OUT/initrd.img"
      -drive "file=$OUT/rootfs.ext4,format=raw,if=virtio"
      -append "root=/dev/vda rw console=tty0 console=ttyS0,115200 loglevel=4 vt.global_cursor_default=0"
    )
    ;;
  disk)
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
    QEMU+=(
      -drive "if=pflash,format=raw,readonly=on,file=$OVMF"
      -drive "file=$OUT/eye-os.img,format=raw,if=virtio"
    )
    ;;
esac

case "$GRAPHICS" in
  serial) QEMU+=(-nographic -serial mon:stdio) ;;
  vnc:*) QEMU+=(-display "vnc=${GRAPHICS#vnc:}" -serial mon:stdio) ;;
  *) QEMU+=(-display gtk -serial mon:stdio) ;;
esac

echo "booting: ${QEMU[*]}" >&2
exec "${QEMU[@]}"
