#!/bin/bash
# Write a Jackie's PC ISO to a USB stick.
#
#   sudo ./boot/scripts/write-usb.sh boot/out/jackies-pc.iso /dev/sdX
#
# THIS ERASES THE TARGET DEVICE. It refuses obvious mistakes (partitions,
# non-removable disks, mounted filesystems) but it cannot read your mind --
# check `lsblk` yourself before running it.
set -euo pipefail

die() { printf '\033[1;31m[error]\033[0m %s\n' "$*" >&2; exit 1; }

ISO="${1:-}"
DEV="${2:-}"

if [[ -z "${ISO}" || -z "${DEV}" ]]; then
    cat <<'EOF'
Usage: sudo write-usb.sh <image.iso> <device>

Find your USB stick first:
    lsblk -o NAME,SIZE,TYPE,RM,MOUNTPOINT,MODEL

Pass the whole disk (/dev/sdb), not a partition (/dev/sdb1).
EOF
    exit 2
fi

[[ ${EUID} -eq 0 ]] || die "must run as root"
[[ -f "${ISO}" ]]   || die "no such image: ${ISO}"
[[ -b "${DEV}" ]]   || die "not a block device: ${DEV}"

# /dev/sdb1 is a partition; writing the ISO there produces an unbootable stick.
if [[ "${DEV}" =~ [0-9]$ && "${DEV}" =~ ^/dev/(sd|vd|hd) ]]; then
    die "${DEV} looks like a partition. Pass the whole disk, e.g. ${DEV%%[0-9]*}"
fi

BASE="$(basename "${DEV}")"
REMOVABLE="$(cat "/sys/block/${BASE}/removable" 2>/dev/null || echo 0)"
SIZE_BYTES=$(blockdev --getsize64 "${DEV}")
SIZE_GB=$(( SIZE_BYTES / 1000 / 1000 / 1000 ))
MODEL="$(cat "/sys/block/${BASE}/device/model" 2>/dev/null || echo unknown)"

if [[ "${REMOVABLE}" != "1" ]]; then
    printf '\033[1;33m[warn]\033[0m %s is not flagged removable -- this may be an internal disk.\n' "${DEV}"
    printf '       Model: %s, size: %sGB\n' "${MODEL}" "${SIZE_GB}"
    read -r -p "Type YES-I-AM-SURE to continue: " confirm
    [[ "${confirm}" == "YES-I-AM-SURE" ]] || die "aborted"
fi

if lsblk -nro MOUNTPOINT "${DEV}" | grep -q .; then
    echo "Mounted filesystems on ${DEV}:"
    lsblk -o NAME,SIZE,MOUNTPOINT "${DEV}"
    read -r -p "Unmount them and continue? [y/N] " un
    [[ "${un}" =~ ^[Yy]$ ]] || die "aborted"
    while read -r part; do
        [[ -n "${part}" ]] && umount "${part}" || true
    done < <(lsblk -nro PATH,MOUNTPOINT "${DEV}" | awk '$2 != "" {print $1}')
fi

ISO_SIZE=$(stat -c %s "${ISO}")
(( ISO_SIZE < SIZE_BYTES )) || die "image (${ISO_SIZE} bytes) is larger than ${DEV} (${SIZE_BYTES} bytes)"

cat <<EOF

  About to ERASE and overwrite:
      Device : ${DEV}  (${MODEL}, ${SIZE_GB}GB, removable=${REMOVABLE})
      Image  : ${ISO}  ($(( ISO_SIZE / 1024 / 1024 ))MB)

  Everything currently on ${DEV} will be destroyed.

EOF
read -r -p "Type the device path again to confirm: " confirm_dev
[[ "${confirm_dev}" == "${DEV}" ]] || die "confirmation did not match; aborted"

echo "Writing…"
dd if="${ISO}" of="${DEV}" bs=4M conv=fsync status=progress
sync

echo "Verifying…"
if command -v sha256sum >/dev/null 2>&1; then
    EXPECT=$(sha256sum "${ISO}" | cut -d' ' -f1)
    ACTUAL=$(head -c "${ISO_SIZE}" "${DEV}" | sha256sum | cut -d' ' -f1)
    if [[ "${EXPECT}" == "${ACTUAL}" ]]; then
        echo "  checksum OK"
    else
        die "checksum mismatch -- the write did not land correctly, do not boot this stick"
    fi
fi

cat <<EOF

Done. Boot it by restarting the machine and choosing the USB stick from the
firmware boot menu (usually F12, F11, Esc or the Mac Option key).

If it is skipped, Secure Boot is the likely reason -- see boot/README.md.
EOF
