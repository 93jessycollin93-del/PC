#!/usr/bin/env bash
#
# Builds a bootable Jackie OS image.
#
# The result is a Debian system whose entire purpose is to start the shell:
# no display manager, no desktop environment, no login prompt on tty1. It
# boots, brings up the host agent, and hands the framebuffer to a compositor
# that hosts exactly one window.
#
# Two artefacts come out of out/:
#
#   rootfs.ext4 + vmlinuz + initrd.img
#       For QEMU via run.sh. Boots the kernel directly, so no bootloader is
#       involved and nothing about the host's firmware matters.
#
#   jackie-os.img
#       A GPT disk with an EFI system partition and systemd-boot. This is the
#       one you write to a USB stick. Built only with --disk, because it needs
#       loop devices that some build environments do not provide.
#
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT="$(cd "$HERE/.." && pwd)"
OUT="$HERE/out"
ROOTFS="$OUT/rootfs"

# Debian and Ubuntu both work; they differ in three places, so the suite
# selects the whole set rather than making you line them up by hand.
#
# The browser is the awkward one. Debian ships a real chromium .deb. Ubuntu
# ships only a snap wrapper, which cannot run inside a bootstrapped rootfs at
# all, so an Ubuntu image gets Epiphany (WebKitGTK) instead. That costs
# nothing here: cage is what makes the session a kiosk, and it hosts whichever
# browser is installed.
SUITE="${SUITE:-noble}"
case "$SUITE" in
  bookworm | trixie | sid | bullseye)
    MIRROR="${MIRROR:-http://deb.debian.org/debian}"
    COMPONENTS="${COMPONENTS:-main}"
    KERNEL_PACKAGE="${KERNEL_PACKAGE:-linux-image-amd64}"
    BROWSER_PACKAGE="${BROWSER_PACKAGE:-chromium}"
    ;;
  *)
    MIRROR="${MIRROR:-http://archive.ubuntu.com/ubuntu}"
    COMPONENTS="${COMPONENTS:-main,universe}"
    KERNEL_PACKAGE="${KERNEL_PACKAGE:-linux-image-generic}"
    BROWSER_PACKAGE="${BROWSER_PACKAGE:-epiphany-browser}"
    ;;
esac
HOSTNAME_="${IMAGE_HOSTNAME:-jackie-os}"
KIOSK_USER="jackie"
KIOSK_UID=1000
# Slack over the measured rootfs size, so first boot has somewhere to write.
SLACK_MB="${SLACK_MB:-900}"

BUILD_DISK=0
SKIP_SHELL=0
for arg in "$@"; do
  case "$arg" in
    --disk) BUILD_DISK=1 ;;
    --skip-shell) SKIP_SHELL=1 ;;
    -h | --help)
      sed -n '2,30p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "unknown option: $arg" >&2
      exit 2
      ;;
  esac
done

log() { printf '\n\033[1;36m==>\033[0m %s\n' "$*"; }
die() {
  printf '\033[1;31mfatal:\033[0m %s\n' "$*" >&2
  exit 1
}

[ "$(id -u)" -eq 0 ] || die "run as root — mmdebstrap and mkfs need it"
for tool in mmdebstrap mkfs.ext4 chroot; do
  command -v "$tool" >/dev/null || die "missing $tool (apt-get install mmdebstrap e2fsprogs)"
done

# ---------------------------------------------------------------- 1. shell

if [ "$SKIP_SHELL" -eq 0 ]; then
  log "Building the shell"
  command -v npm >/dev/null || die "missing npm — install Node.js, or pass --skip-shell"
  (
    cd "$PROJECT/shell"
    [ -d node_modules ] || npm install --no-audit --no-fund
    npm run build
  )
fi
[ -f "$PROJECT/shell/dist/index.html" ] || die "shell/dist is empty — build it first"

# ---------------------------------------------------------------- 2. rootfs

log "Bootstrapping Debian $SUITE (this pulls a few hundred MB)"
rm -rf "$ROOTFS"
mkdir -p "$ROOTFS" "$OUT"

# Everything the kiosk needs and nothing that assumes a human at a desk:
#   cage       single-window Wayland compositor — the session itself
#   chromium   the renderer
#   seatd      seat management for wlroots when logind is not driving it
#   mesa DRI   software and virtio GL, so it paints without a real GPU
#   python3    the host agent
PACKAGES=(
  "$KERNEL_PACKAGE"
  "$BROWSER_PACKAGE"
  # Not pulled in by --variant=important on Ubuntu, and without it there is no
  # initramfs to rebuild — the kernel then cannot find the root device.
  initramfs-tools
  systemd-sysv
  systemd-boot-efi
  udev
  dbus
  cage
  python3
  seatd
  libgl1-mesa-dri
  libegl-mesa0
  fonts-dejavu-core
  fonts-noto-color-emoji
  ca-certificates
  curl
  iproute2
  nano
  less
)

mmdebstrap \
  --variant=important \
  --components="$COMPONENTS" \
  --include="$(
    IFS=,
    echo "${PACKAGES[*]}"
  )" \
  --aptopt='Acquire::Retries "3"' \
  "$SUITE" "$ROOTFS" "$MIRROR"

# ------------------------------------------------------------- 3. overlay

log "Installing the shell and overlay"
install -d -m 0755 "$ROOTFS/opt/jackie-os"
cp -a "$HERE/overlay/." "$ROOTFS/"
rm -rf "$ROOTFS/opt/jackie-os/shell"
cp -a "$PROJECT/shell/dist" "$ROOTFS/opt/jackie-os/shell"
chmod 0755 "$ROOTFS/opt/jackie-os/bin/jackie-hostd" "$ROOTFS/opt/jackie-os/bin/jackie-kiosk"

echo "$HOSTNAME_" >"$ROOTFS/etc/hostname"
cat >"$ROOTFS/etc/hosts" <<EOF
127.0.0.1	localhost
127.0.1.1	$HOSTNAME_
::1		localhost ip6-localhost ip6-loopback
EOF

# ext4 root on the first virtio/NVMe disk; the label keeps it independent of
# whether the firmware enumerates it as vda, sda or nvme0n1.
cat >"$ROOTFS/etc/fstab" <<'EOF'
LABEL=jackie-root  /          ext4  errors=remount-ro,noatime  0 1
LABEL=JACKIE-ESP   /boot/efi  vfat  umask=0077,noauto          0 2
EOF

# --------------------------------------------------------- 4. configure

log "Configuring the kiosk session"
cat >"$ROOTFS/tmp/configure.sh" <<CONFIGURE
set -eu
export DEBIAN_FRONTEND=noninteractive

# The kiosk user owns the framebuffer and the input devices, and nothing else.
# 'render' and 'video' are what let cage open the DRM node; 'seat' is what
# seatd checks. No sudo, no shell login.
useradd --uid $KIOSK_UID --create-home --shell /usr/sbin/nologin $KIOSK_USER || true
for group in video render input seat tty; do
  getent group "\$group" >/dev/null || groupadd "\$group"
  usermod -aG "\$group" $KIOSK_USER
done

install -d -o $KIOSK_USER -g $KIOSK_USER -m 0755 /var/lib/jackie-os /var/lib/jackie-os/files

# Locked root account with no password: there is no console login on this
# image, so leaving one enabled would be a credential nobody manages.
passwd -l root || true

systemctl enable seatd.service || true
systemctl enable jackie-hostd.service
systemctl enable jackie-kiosk.service
systemctl set-default graphical.target

# Nothing on this image needs the network to start the UI. Not waiting for it
# is the difference between a two-second boot and a thirty-second one.
systemctl disable systemd-networkd-wait-online.service 2>/dev/null || true
systemctl mask systemd-networkd-wait-online.service 2>/dev/null || true

# Rebuild the initramfs so the virtio and DRM modules needed to find the root
# device and light up the display are present at boot.
update-initramfs -u -k all
CONFIGURE

# update-initramfs reads /proc/modules and /sys to decide what to bundle, and
# quietly produces a broken initramfs without them. Mount the pseudo
# filesystems for the chroot and make sure they come back out — an image built
# over a live /dev is not an image.
umount_pseudo() {
  for mountpoint in dev/pts dev sys proc; do
    umount -l "$ROOTFS/$mountpoint" 2>/dev/null || true
  done
}
trap umount_pseudo EXIT

mkdir -p "$ROOTFS"/{proc,sys,dev/pts}
mount -t proc proc "$ROOTFS/proc"
mount -t sysfs sys "$ROOTFS/sys"
mount --bind /dev "$ROOTFS/dev"
mount --bind /dev/pts "$ROOTFS/dev/pts"

chroot "$ROOTFS" /bin/sh /tmp/configure.sh
rm -f "$ROOTFS/tmp/configure.sh"

umount_pseudo
trap - EXIT

# Trim what a kiosk will never read. Keeps the image roughly a third smaller.
chroot "$ROOTFS" apt-get clean
rm -rf "$ROOTFS"/var/lib/apt/lists/* "$ROOTFS"/usr/share/doc/* "$ROOTFS"/usr/share/man/*

# ------------------------------------------------------- 5. kernel/initrd

log "Extracting kernel and initramfs"
KERNEL="$(find "$ROOTFS/boot" -name 'vmlinuz-*' | sort | tail -1)"
INITRD="$(find "$ROOTFS/boot" -name 'initrd.img-*' | sort | tail -1)"
if [ -z "$KERNEL" ] || [ -z "$INITRD" ]; then
  die "no kernel in the rootfs"
fi
cp "$KERNEL" "$OUT/vmlinuz"
cp "$INITRD" "$OUT/initrd.img"

# --------------------------------------------------------- 6. filesystem

ROOTFS_MB=$(($(du -sm "$ROOTFS" | cut -f1) + SLACK_MB))
log "Creating rootfs.ext4 (${ROOTFS_MB}MB)"
rm -f "$OUT/rootfs.ext4"
truncate -s "${ROOTFS_MB}M" "$OUT/rootfs.ext4"
# -d populates the filesystem without mounting it, so no loop device is needed
# and this works inside an unprivileged container.
mkfs.ext4 -q -L jackie-root -d "$ROOTFS" "$OUT/rootfs.ext4"

log "Built $OUT/rootfs.ext4"
du -h "$OUT/rootfs.ext4" "$OUT/vmlinuz" "$OUT/initrd.img" | sed 's/^/    /'

# ------------------------------------------------------------- 7. disk

if [ "$BUILD_DISK" -eq 1 ]; then
  log "Building the UEFI disk image"
  command -v mkfs.vfat >/dev/null || die "missing mkfs.vfat (apt-get install dosfstools)"
  command -v sfdisk >/dev/null || die "missing sfdisk (apt-get install fdisk)"

  ESP_MB=260
  DISK="$OUT/jackie-os.img"
  rm -f "$DISK"
  truncate -s "$((ESP_MB + ROOTFS_MB + 2))M" "$DISK"

  sfdisk --label gpt "$DISK" >/dev/null <<EOF
size=${ESP_MB}M, type=uefi, name="JACKIE-ESP"
type=linux, name="jackie-root"
EOF

  # Build the ESP as its own file, then splice both partitions into the disk
  # with dd. Avoids losetup entirely, which many container runtimes forbid.
  ESP="$OUT/esp.img"
  rm -f "$ESP"
  truncate -s "${ESP_MB}M" "$ESP"
  mkfs.vfat -n JACKIE-ESP "$ESP" >/dev/null

  ESP_TREE="$OUT/esp-tree"
  rm -rf "$ESP_TREE"
  mkdir -p "$ESP_TREE/EFI/BOOT" "$ESP_TREE/loader/entries"

  BOOTX64="$ROOTFS/usr/lib/systemd/boot/efi/systemd-bootx64.efi"
  [ -f "$BOOTX64" ] || die "systemd-boot not in the rootfs (add systemd-boot-efi to PACKAGES)"
  cp "$BOOTX64" "$ESP_TREE/EFI/BOOT/BOOTX64.EFI"
  cp "$OUT/vmlinuz" "$ESP_TREE/vmlinuz"
  cp "$OUT/initrd.img" "$ESP_TREE/initrd.img"

  cat >"$ESP_TREE/loader/loader.conf" <<'EOF'
default jackie
timeout 0
console-mode max
EOF
  cat >"$ESP_TREE/loader/entries/jackie.conf" <<'EOF'
title   Jackie OS
linux   /vmlinuz
initrd  /initrd.img
options root=LABEL=jackie-root rw quiet loglevel=3 vt.global_cursor_default=0
EOF

  # mcopy ships with mtools and writes into a FAT image without mounting it.
  command -v mcopy >/dev/null || die "missing mcopy (apt-get install mtools)"
  (cd "$ESP_TREE" && mcopy -s -i "$ESP" ./* ::)

  ESP_START=$(sfdisk --json "$DISK" | grep -m1 '"start"' | tr -dc '0-9')
  ROOT_START=$(sfdisk --json "$DISK" | grep '"start"' | sed -n 2p | tr -dc '0-9')
  dd if="$ESP" of="$DISK" bs=512 seek="$ESP_START" conv=notrunc status=none
  dd if="$OUT/rootfs.ext4" of="$DISK" bs=512 seek="$ROOT_START" conv=notrunc status=none
  rm -f "$ESP"
  rm -rf "$ESP_TREE"

  log "Built $DISK"
  du -h "$DISK" | sed 's/^/    /'
  echo "    Write it with:  dd if=$DISK of=/dev/sdX bs=4M status=progress conv=fsync"
fi

log "Done. Boot it with: $HERE/run.sh"
