#!/bin/bash
# Runs INSIDE the debootstrapped chroot, invoked by build-iso.sh.
# Everything here shapes the system that the USB stick will boot into.
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive
export LC_ALL=C

KIOSK_USER="${KIOSK_USER:-jackie}"
SUITE="${SUITE:-noble}"

echo "==> configuring apt sources"
cat >/etc/apt/sources.list <<EOF
deb http://archive.ubuntu.com/ubuntu ${SUITE} main restricted universe multiverse
deb http://archive.ubuntu.com/ubuntu ${SUITE}-updates main restricted universe multiverse
deb http://security.ubuntu.com/ubuntu ${SUITE}-security main restricted universe multiverse
EOF

# Keep the image from starting daemons while we are still building it.
cat >/usr/sbin/policy-rc.d <<'EOF'
#!/bin/sh
exit 101
EOF
chmod +x /usr/sbin/policy-rc.d

echo "==> installing packages"
apt-get update -qq
mapfile -t PACKAGES < <(grep -vE '^\s*(#|$)' /tmp/packages.list)
apt-get install -y --no-install-recommends "${PACKAGES[@]}"

echo "==> locale and hostname"
locale-gen en_US.UTF-8
update-locale LANG=en_US.UTF-8
echo "jackies-pc" >/etc/hostname
cat >/etc/hosts <<'EOF'
127.0.0.1   localhost jackies-pc
::1         localhost ip6-localhost ip6-loopback
EOF

echo "==> creating kiosk user ${KIOSK_USER}"
if ! id -u "${KIOSK_USER}" >/dev/null 2>&1; then
    adduser --disabled-password --gecos "Jackie" "${KIOSK_USER}"
fi
# Live image: no password prompt to get to a console for troubleshooting.
passwd -d "${KIOSK_USER}"
# Which of these exist depends on what the package set pulled in -- netdev in
# particular is absent from a minbase chroot -- and usermod fails the whole
# build on the first missing one, so add only the groups that are really there.
for group in sudo video audio input netdev plugdev; do
    if getent group "${group}" >/dev/null 2>&1; then
        usermod -aG "${group}" "${KIOSK_USER}"
    else
        echo "    skipping absent group: ${group}"
    fi
done
echo "${KIOSK_USER} ALL=(ALL) NOPASSWD: ALL" >/etc/sudoers.d/90-jackie
chmod 0440 /etc/sudoers.d/90-jackie

echo "==> casper live-session identity"
# Without this casper invents its own live user at boot, alongside the one we
# just baked in, and the kiosk service would be running as the wrong account.
cat >/etc/casper.conf <<EOF
export USERNAME="${KIOSK_USER}"
export USERFULLNAME="Jackie"
export HOST="jackies-pc"
export BUILD_SYSTEM="Ubuntu"
# FLAVOUR must be set and non-empty. Otherwise casper overwrites USERNAME and
# HOST with the first whitespace-separated word of /cdrom/.disk/info,
# lowercased -- which silently invents a live user that is not the one baked
# into this image, and every chown against it then fails at boot.
export FLAVOUR="${KIOSK_USER}"
EOF

echo "==> allowing X to start outside a seat session"
# jackie-kiosk.service launches xinit directly, which Xwrapper blocks by default.
install -d /etc/X11
cat >/etc/X11/Xwrapper.config <<'EOF'
allowed_users=anybody
needs_root_rights=yes
EOF

echo "==> installing kiosk binaries"
install -m 0755 /tmp/kiosk/jackie-kiosk.py         /usr/local/bin/jackie-kiosk.py
install -m 0755 /tmp/kiosk/jackie-kiosk-session    /usr/local/bin/jackie-kiosk-session
install -m 0755 /tmp/kiosk/jackie-firewall         /usr/local/sbin/jackie-firewall

echo "==> installing systemd units"
install -m 0644 /tmp/systemd/jackie-pc.service       /etc/systemd/system/jackie-pc.service
install -m 0644 /tmp/systemd/jackie-kiosk.service    /etc/systemd/system/jackie-kiosk.service
install -m 0644 /tmp/systemd/jackie-firewall.service /etc/systemd/system/jackie-firewall.service

systemctl enable jackie-firewall.service
systemctl enable jackie-pc.service
systemctl enable jackie-kiosk.service
systemctl set-default graphical.target

# The kiosk owns tty1; getty there would fight it for the terminal.
systemctl disable getty@tty1.service 2>/dev/null || true

echo "==> app ownership"
install -d -o "${KIOSK_USER}" -g "${KIOSK_USER}" /opt/jackie-pc/data
chown -R "${KIOSK_USER}:${KIOSK_USER}" /opt/jackie-pc
install -d /etc/jackie-pc
cat >/etc/jackie-pc/env <<'EOF'
# Drop API keys here to light up the online AI features, e.g.
#   GEMINI_API_KEY=...
# The workspace runs fine without them; those panels just stay offline.
EOF
chmod 0600 /etc/jackie-pc/env

echo "==> node sanity check"
node --version
node -e 'process.exit(0)'

echo "==> rebuilding initramfs with casper hooks"
# casper is what teaches the initrd to find and mount /casper/filesystem.squashfs.
update-initramfs -u -k all

echo "==> cleaning up"
apt-get clean
rm -f /usr/sbin/policy-rc.d
rm -rf /tmp/packages.list /tmp/kiosk /tmp/systemd
rm -rf /var/lib/apt/lists/*
rm -rf /var/cache/apt/archives/*.deb
find /var/log -type f -exec truncate -s 0 {} + 2>/dev/null || true

echo "==> chroot setup complete"
