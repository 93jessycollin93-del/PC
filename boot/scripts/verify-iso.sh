#!/bin/bash
# Structural checks on a built image, before you spend a USB stick on it.
#
#   sudo ./boot/scripts/verify-iso.sh [image.iso]
#
# Confirms the ISO carries what a live boot needs: both boot paths, the casper
# payload, and -- when run as root, so the squashfs can be mounted -- the
# services and binaries the kiosk depends on.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ISO="${1:-${HERE}/../out/jackies-pc.iso}"

PASS=0
FAIL=0
SKIP=0

ok()   { printf '  \033[1;32m✓\033[0m %s\n' "$*"; PASS=$((PASS + 1)); }
bad()  { printf '  \033[1;31m✗\033[0m %s\n' "$*"; FAIL=$((FAIL + 1)); }
skip() { printf '  \033[1;33m–\033[0m %s\n' "$*"; SKIP=$((SKIP + 1)); }
head_() { printf '\n\033[1;36m%s\033[0m\n' "$*"; }

[[ -f "${ISO}" ]] || { echo "no such image: ${ISO}" >&2; exit 1; }

head_ "Image"
printf '  %s (%s)\n' "${ISO}" "$(du -h "${ISO}" | cut -f1)"

if [[ -f "${ISO}.sha256" ]]; then
    if ( cd "$(dirname "${ISO}")" && sha256sum -c "$(basename "${ISO}").sha256" >/dev/null 2>&1 ); then
        ok "checksum matches ${ISO}.sha256"
    else
        bad "checksum does NOT match ${ISO}.sha256"
    fi
else
    skip "no .sha256 alongside the image"
fi

head_ "Boot records"
if command -v xorriso >/dev/null 2>&1; then
    REPORT="$(xorriso -indev "${ISO}" -report_el_torito plain 2>&1)"
    grep -q 'El Torito' <<<"${REPORT}" && ok "El Torito catalogue present (BIOS)" \
        || bad "no El Torito boot catalogue -- will not boot on legacy BIOS"
    grep -qi 'UEFI\|efi' <<<"${REPORT}" && ok "EFI boot image present (UEFI)" \
        || bad "no EFI boot image -- will not boot on UEFI firmware"
else
    skip "xorriso not installed; cannot inspect boot records"
fi

# An isohybrid MBR is what makes `dd` to a USB stick bootable at all.
if [[ "$(head -c 2 "${ISO}" | xxd -p 2>/dev/null)" == "33ed" ]] \
   || head -c 512 "${ISO}" | grep -qa 'isohybrid\|GRUB' 2>/dev/null; then
    ok "hybrid MBR present (dd to USB will boot)"
else
    skip "could not confirm hybrid MBR (grub-mkrescue normally writes one)"
fi

head_ "Payload"
LIST="$(xorriso -indev "${ISO}" -find / -type f 2>/dev/null | sed 's/^ *//')"
for want in /casper/vmlinuz /casper/initrd /casper/filesystem.squashfs /boot/grub/grub.cfg; do
    if grep -qF "${want}" <<<"${LIST}"; then
        ok "${want}"
    else
        bad "${want} MISSING"
    fi
done


# ---------------------------------------------------------- root filesystem --
#
# Two ways in, because loop devices are often unavailable (containers, CI):
# mount the squashfs directly when we can, otherwise extract it out of the ISO
# and read the table of contents with unsquashfs. The extract path needs scratch
# space roughly the size of the image.

head_ "Root filesystem"

MODE=""
MNT_ISO=""
MNT_SQ=""
SQ_FILE=""
LISTING=""

cleanup_fs() {
    [[ -n "${MNT_SQ}"  ]] && mountpoint -q "${MNT_SQ}"  && umount "${MNT_SQ}"
    [[ -n "${MNT_ISO}" ]] && mountpoint -q "${MNT_ISO}" && umount "${MNT_ISO}"
    [[ -n "${MNT_SQ}"  ]] && rmdir "${MNT_SQ}"  2>/dev/null
    [[ -n "${MNT_ISO}" ]] && rmdir "${MNT_ISO}" 2>/dev/null
    [[ -n "${SQ_FILE}" && -f "${SQ_FILE}" ]] && rm -f "${SQ_FILE}"
    [[ -n "${LISTING}" && -f "${LISTING}" ]] && rm -f "${LISTING}"
    return 0
}
trap cleanup_fs EXIT

if [[ ${EUID} -eq 0 ]]; then
    MNT_ISO="$(mktemp -d)"
    MNT_SQ="$(mktemp -d)"
    if mount -o loop,ro "${ISO}" "${MNT_ISO}" 2>/dev/null \
       && mount -t squashfs -o loop,ro "${MNT_ISO}/casper/filesystem.squashfs" "${MNT_SQ}" 2>/dev/null; then
        MODE="mount"
    else
        cleanup_fs
        MNT_ISO=""; MNT_SQ=""
    fi
fi

if [[ -z "${MODE}" ]] && command -v unsquashfs >/dev/null 2>&1 && command -v xorriso >/dev/null 2>&1; then
    echo "  (loop mount unavailable -- reading the table of contents instead)"
    SQ_FILE="$(mktemp -t filesystem-XXXXXX.squashfs)"
    if xorriso -osirrox on -indev "${ISO}" \
         -extract /casper/filesystem.squashfs "${SQ_FILE}" >/dev/null 2>&1; then
        LISTING="$(mktemp)"
        # -lls prints symlink targets too, which is how enablement is checked.
        if unsquashfs -lls "${SQ_FILE}" >"${LISTING}" 2>/dev/null; then
            MODE="listing"
        fi
    fi
fi

# have_path <relative-path>
have_path() {
    if [[ "${MODE}" == "mount" ]]; then
        [[ -e "${MNT_SQ}/$1" ]]
    else
        grep -qE "(^|[[:space:]])squashfs-root/$1( -> |$)" "${LISTING}"
    fi
}

# link_points_to <relative-path> <substring>
link_points_to() {
    if [[ "${MODE}" == "mount" ]]; then
        [[ -L "${MNT_SQ}/$1" ]] && [[ "$(readlink -f "${MNT_SQ}/$1")" == *"$2"* ]]
    else
        grep -E "squashfs-root/$1 -> " "${LISTING}" | grep -q "$2"
    fi
}

is_symlink() {
    if [[ "${MODE}" == "mount" ]]; then
        [[ -L "${MNT_SQ}/$1" ]]
    else
        grep -qE "^l.*squashfs-root/$1 -> " "${LISTING}"
    fi
}

if [[ -z "${MODE}" ]]; then
    skip "cannot read the root filesystem (need root for loop mount, or xorriso + unsquashfs)"
else
    for unit in jackie-pc jackie-kiosk jackie-firewall; do
        have_path "etc/systemd/system/${unit}.service" \
            && ok "unit installed: ${unit}.service" \
            || bad "unit MISSING: ${unit}.service"
    done

    # Enablement is a symlink in a .wants directory. A unit file that is present
    # but not enabled boots to a black screen, so check the link, not the file.
    for want in multi-user.target.wants/jackie-pc.service \
                graphical.target.wants/jackie-kiosk.service \
                multi-user.target.wants/jackie-firewall.service; do
        is_symlink "etc/systemd/system/${want}" \
            && ok "enabled: ${want##*/} (via ${want%%/*})" \
            || bad "NOT enabled: ${want}"
    done

    link_points_to "etc/systemd/system/default.target" "graphical.target" \
        && ok "default.target -> graphical.target" \
        || bad "default.target does not point at graphical.target"

    # nft lives in sbin, not bin -- the firewall unit calls it by absolute path.
    for bin in usr/local/bin/jackie-kiosk.py \
               usr/local/bin/jackie-kiosk-session \
               usr/local/sbin/jackie-firewall \
               usr/bin/node usr/bin/X usr/bin/openbox usr/sbin/nft usr/bin/python3; do
        have_path "${bin}" && ok "present: /${bin}" || bad "MISSING: /${bin}"
    done

    have_path "opt/jackie-pc/server.cjs" \
        && ok "app server: /opt/jackie-pc/server.cjs" || bad "app server MISSING"
    have_path "opt/jackie-pc/index.html" \
        && ok "app frontend: /opt/jackie-pc/index.html" || bad "app frontend MISSING"
    have_path "opt/jackie-pc/node_modules/express" \
        && ok "runtime deps present (express)" \
        || bad "runtime deps MISSING -- server.cjs is bundled --packages=external"

    # Without the typelib the WebKitGTK kiosk cannot import its browser widget.
    have_path "usr/lib/x86_64-linux-gnu/girepository-1.0/WebKit2-4.1.typelib" \
        && ok "WebKitGTK typelib present" \
        || bad "WebKit2-4.1.typelib MISSING -- kiosk cannot start"

    have_path "etc/casper.conf" \
        && ok "casper.conf present (live user identity)" \
        || bad "casper.conf MISSING"
    have_path "etc/X11/Xwrapper.config" \
        && ok "Xwrapper.config present (X starts outside a seat)" \
        || bad "Xwrapper.config MISSING -- X will refuse to start"
fi

head_ "Result"
printf '  %d passed, %d failed, %d skipped\n\n' "${PASS}" "${FAIL}" "${SKIP}"
[[ ${FAIL} -eq 0 ]] || exit 1
