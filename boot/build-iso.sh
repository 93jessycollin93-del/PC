#!/bin/bash
# Build a bootable Jackie's PC live image (hybrid BIOS + UEFI ISO).
#
#   sudo ./boot/build-iso.sh
#
# Produces boot/out/jackies-pc.iso, which boots straight into the workspace.
# See boot/README.md for the full story.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "${HERE}/.." && pwd)"
WORK="${HERE}/work"
OUT="${HERE}/out"
CHROOT="${WORK}/chroot"
ISODIR="${WORK}/iso"

SUITE="${SUITE:-noble}"
MIRROR="${MIRROR:-http://archive.ubuntu.com/ubuntu}"
KIOSK_USER="jackie"
IMAGE_NAME="jackies-pc.iso"
SKIP_APP=0
KEEP_WORK=0
# xz gives the smallest image but dominates build time; zstd trades ~15% size
# for a several-times-faster compress, which is what you want while iterating.
SQUASH_COMP="xz"

log()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[error]\033[0m %s\n' "$*" >&2; exit 1; }

usage() {
    cat <<'EOF'
Usage: sudo ./boot/build-iso.sh [options]

  --skip-app     Reuse the existing dist/ instead of rebuilding the web app.
  --keep-work    Leave boot/work/ in place afterwards (for debugging).
  --fast         Compress with zstd instead of xz: much quicker, ~15% bigger.
  --suite NAME   Ubuntu suite to debootstrap (default: noble).
  --output NAME  ISO filename (default: jackies-pc.iso).
  -h, --help     This message.
EOF
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --skip-app)  SKIP_APP=1; shift ;;
        --keep-work) KEEP_WORK=1; shift ;;
        --fast)      SQUASH_COMP="zstd"; shift ;;
        --suite)     SUITE="${2:?}"; shift 2 ;;
        --output)    IMAGE_NAME="${2:?}"; shift 2 ;;
        -h|--help)   usage; exit 0 ;;
        *)           die "unknown option: $1 (try --help)" ;;
    esac
done

# ---------------------------------------------------------------- preflight --

log "preflight"
[[ ${EUID} -eq 0 ]] || die "must run as root (debootstrap and mount need it)"

MISSING=()
for tool in debootstrap mksquashfs xorriso grub-mkrescue mkfs.vfat node npm; do
    command -v "${tool}" >/dev/null 2>&1 || MISSING+=("${tool}")
done
if [[ ${#MISSING[@]} -gt 0 ]]; then
    die "missing tools: ${MISSING[*]}
Install them with:
  apt-get install -y debootstrap squashfs-tools xorriso grub-pc-bin grub-efi-amd64-bin mtools dosfstools"
fi

AVAIL_KB=$(df -Pk "${HERE}" | awk 'NR==2 {print $4}')
if (( AVAIL_KB < 12 * 1024 * 1024 )); then
    warn "only $((AVAIL_KB / 1024 / 1024))GB free here; the build wants ~12GB"
fi

# Unmount cleanly no matter how we exit, or the next run inherits stale binds.
cleanup() {
    set +e
    for mp in dev/pts dev proc sys run; do
        mountpoint -q "${CHROOT}/${mp}" && umount -lf "${CHROOT}/${mp}"
    done
    set -e
}
trap cleanup EXIT INT TERM

rm -rf "${WORK}"
mkdir -p "${CHROOT}" "${ISODIR}" "${OUT}"

# ------------------------------------------------------------- build the app --

STAGE="${WORK}/app"
mkdir -p "${STAGE}"

if [[ ${SKIP_APP} -eq 0 ]]; then
    log "building the web app"
    ( cd "${REPO}" && npm install --no-audit --no-fund && npm run build )
else
    log "skipping app build (--skip-app)"
fi

[[ -f "${REPO}/dist/server.cjs" ]] || die "dist/server.cjs missing -- run without --skip-app"
[[ -f "${REPO}/dist/index.html" ]] || die "dist/index.html missing -- run without --skip-app"

log "staging app + production dependencies"
cp -a "${REPO}/dist/." "${STAGE}/"
# server.cjs is bundled with --packages=external, so its runtime deps have to
# ship alongside it. Install production-only to keep the image lean.
cp "${REPO}/package.json" "${STAGE}/package.json"
# Not `[[ -f x ]] && cp`: under `set -e` a false test would abort the build.
if [[ -f "${REPO}/package-lock.json" ]]; then
    cp "${REPO}/package-lock.json" "${STAGE}/package-lock.json"
    ( cd "${STAGE}" && npm ci --omit=dev --no-audit --no-fund )
else
    ( cd "${STAGE}" && npm install --omit=dev --no-audit --no-fund )
fi
du -sh "${STAGE}" | awk '{print "    staged app: " $1}'

# ------------------------------------------------------------ base system ----

log "debootstrapping ubuntu ${SUITE} (this takes a while)"
debootstrap --arch=amd64 --variant=minbase \
    --include=ca-certificates,gnupg \
    "${SUITE}" "${CHROOT}" "${MIRROR}"

log "mounting pseudo-filesystems"
mount --bind /dev      "${CHROOT}/dev"
mount --bind /dev/pts  "${CHROOT}/dev/pts"
mount -t proc  proc    "${CHROOT}/proc"
mount -t sysfs sysfs   "${CHROOT}/sys"
mount -t tmpfs tmpfs   "${CHROOT}/run"
cp /etc/resolv.conf "${CHROOT}/etc/resolv.conf"

log "copying config and app into the chroot"
install -d "${CHROOT}/tmp/kiosk" "${CHROOT}/tmp/systemd" "${CHROOT}/opt/jackie-pc"
cp "${HERE}/config/packages.list"   "${CHROOT}/tmp/packages.list"
cp "${HERE}/config/kiosk/."   -r    "${CHROOT}/tmp/kiosk/"
cp "${HERE}/config/systemd/." -r    "${CHROOT}/tmp/systemd/"
cp -a "${STAGE}/." "${CHROOT}/opt/jackie-pc/"
cp "${HERE}/config/chroot-setup.sh" "${CHROOT}/tmp/chroot-setup.sh"
chmod +x "${CHROOT}/tmp/chroot-setup.sh"

log "provisioning the chroot"
chroot "${CHROOT}" /usr/bin/env \
    KIOSK_USER="${KIOSK_USER}" SUITE="${SUITE}" \
    /bin/bash /tmp/chroot-setup.sh

# Unmount before squashing rather than leaving it to the exit trap: /dev is a
# bind mount of the host's, so compressing with it still mounted bakes the
# build machine's device nodes into the image.
log "unmounting pseudo-filesystems"
cleanup
rm -f "${CHROOT}/etc/resolv.conf"
# casper/NetworkManager generate the real one at boot; a dangling copy of the
# build host's resolver would otherwise ship with the image.
ln -sf ../run/systemd/resolve/stub-resolv.conf "${CHROOT}/etc/resolv.conf"

# ------------------------------------------------------------- image build ---

log "extracting kernel and initrd"
install -d "${ISODIR}/casper" "${ISODIR}/boot/grub" "${ISODIR}/.disk"
VMLINUZ="$(find "${CHROOT}/boot" -name 'vmlinuz-*' | sort -V | tail -1)"
INITRD="$(find "${CHROOT}/boot" -name 'initrd.img-*' | sort -V | tail -1)"
[[ -n "${VMLINUZ}" ]] || die "no kernel found in the chroot"
[[ -n "${INITRD}"  ]] || die "no initrd found in the chroot"
cp "${VMLINUZ}" "${ISODIR}/casper/vmlinuz"
cp "${INITRD}"  "${ISODIR}/casper/initrd"

log "compressing the root filesystem (slowest step)"
mksquashfs "${CHROOT}" "${ISODIR}/casper/filesystem.squashfs" \
    -comp "${SQUASH_COMP}" -b 1M -noappend -wildcards \
    -e 'proc/*' 'sys/*' 'dev/pts/*' 'run/*' 'tmp/*' \
       'var/cache/apt/archives/*.deb' 'var/lib/apt/lists/*'
printf '%s' "$(du -sx --block-size=1 "${CHROOT}" | cut -f1)" \
    >"${ISODIR}/casper/filesystem.size"

log "assembling the ISO tree"
cp "${HERE}/config/grub/grub.cfg" "${ISODIR}/boot/grub/grub.cfg"
# First word only, no apostrophe: casper lowercases it into a username and
# hostname when FLAVOUR is unset. casper.conf pins FLAVOUR so this no longer
# decides anything, but a value that would still work is cheap insurance.
echo "Jackie PC - live workspace" >"${ISODIR}/.disk/info"

( cd "${ISODIR}" && find . -type f -not -path './md5sum.txt' -print0 \
    | xargs -0 md5sum >md5sum.txt )

log "building the hybrid ISO"
# grub-mkrescue emits both an El Torito BIOS image and an EFI System Partition,
# so one file works on legacy and UEFI machines alike.
grub-mkrescue --output="${OUT}/${IMAGE_NAME}" "${ISODIR}" \
    -- -volid "JACKIES_PC"

( cd "${OUT}" && sha256sum "${IMAGE_NAME}" >"${IMAGE_NAME}.sha256" )

if [[ ${KEEP_WORK} -eq 0 ]]; then
    log "removing work tree (--keep-work to preserve)"
    cleanup
    rm -rf "${WORK}"
fi

log "done"
ls -lh "${OUT}/${IMAGE_NAME}"
cat <<EOF

  Image:  ${OUT}/${IMAGE_NAME}
  Verify: sha256sum -c ${OUT}/${IMAGE_NAME}.sha256

  Try it without hardware:
      ./boot/scripts/test-qemu.sh

  Write it to a USB stick (destroys the target disk):
      sudo ./boot/scripts/write-usb.sh ${OUT}/${IMAGE_NAME} /dev/sdX
EOF
