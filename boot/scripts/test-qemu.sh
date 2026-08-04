#!/bin/bash
# Boot the built ISO in QEMU so you can check it without touching hardware.
#
#   ./boot/scripts/test-qemu.sh              # BIOS
#   MODE=uefi ./boot/scripts/test-qemu.sh    # UEFI
#
# With no DISPLAY (a container, an SSH session) it falls back to a serial
# console on stdout, which pairs with the "serial console" GRUB entry.
#
# Needs: qemu-system-x86_64, plus ovmf for the UEFI path.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ISO="${1:-${HERE}/../out/jackies-pc.iso}"
MODE="${MODE:-bios}"     # bios | uefi
MEM="${MEM:-4096}"
HEADLESS="${HEADLESS:-auto}"   # auto | 1 | 0

die() { printf '\033[1;31m[error]\033[0m %s\n' "$*" >&2; exit 1; }

command -v qemu-system-x86_64 >/dev/null 2>&1 \
    || die "qemu-system-x86_64 not found (apt-get install qemu-system-x86)"
[[ -f "${ISO}" ]] || die "no such image: ${ISO} (build it with boot/build-iso.sh)"

ARGS=(-m "${MEM}" -smp 2 -cdrom "${ISO}" -boot d)

# KVM makes this usable rather than glacial; fall back if it is unavailable.
if [[ -w /dev/kvm ]]; then
    ARGS+=(-enable-kvm -cpu host)
else
    echo "[warn] /dev/kvm not available -- running without acceleration (slow)"
fi

if [[ "${HEADLESS}" == "auto" ]]; then
    [[ -n "${DISPLAY:-}" ]] && HEADLESS=0 || HEADLESS=1
fi

if [[ "${HEADLESS}" == "1" ]]; then
    echo "[info] no display -- using serial console (pick the serial GRUB entry)"
    ARGS+=(-display none -serial mon:stdio)
else
    ARGS+=(-vga virtio -display gtk)
fi

if [[ "${MODE}" == "uefi" ]]; then
    # Ubuntu ships the split 4M firmware; older/other distros use other names.
    CODE=""
    for candidate in \
        /usr/share/OVMF/OVMF_CODE_4M.fd \
        /usr/share/OVMF/OVMF_CODE.fd \
        /usr/share/ovmf/OVMF.fd \
        /usr/share/edk2/x64/OVMF_CODE.fd
    do
        [[ -f "${candidate}" ]] && CODE="${candidate}" && break
    done
    [[ -n "${CODE}" ]] || die "OVMF firmware not found (apt-get install ovmf)"

    VARS_TEMPLATE=""
    for candidate in \
        /usr/share/OVMF/OVMF_VARS_4M.fd \
        /usr/share/OVMF/OVMF_VARS.fd \
        /usr/share/edk2/x64/OVMF_VARS.fd
    do
        [[ -f "${candidate}" ]] && VARS_TEMPLATE="${candidate}" && break
    done

    ARGS+=(-drive "if=pflash,format=raw,unit=0,readonly=on,file=${CODE}")
    if [[ -n "${VARS_TEMPLATE}" ]]; then
        # The variable store must be writable, so hand QEMU a scratch copy
        # rather than the read-only system template.
        VARS="$(mktemp -t ovmf-vars-XXXXXX.fd)"
        trap 'rm -f "${VARS}"' EXIT
        cp "${VARS_TEMPLATE}" "${VARS}"
        ARGS+=(-drive "if=pflash,format=raw,unit=1,file=${VARS}")
    fi
fi

echo "Booting ${ISO} (${MODE}, ${MEM}MB)…"
exec qemu-system-x86_64 "${ARGS[@]}"
