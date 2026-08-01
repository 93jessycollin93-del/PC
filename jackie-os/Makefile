# Jackie OS — build entry points.
#
#   make shell     build just the web shell (no root needed)
#   make dev       run the shell in a browser with hot reload
#   make image     bootable rootfs for QEMU            (needs root)
#   make disk      + a UEFI disk image for real hardware (needs root)
#   make rebuild   re-bake the image from the existing rootfs (needs root)
#   make run       boot the image in a QEMU window
#   make run-serial  boot headless, console on this terminal
#   make smoke     boot headless and assert the system came up
#   make smoke-disk  same, but through UEFI and systemd-boot
#   make check     typecheck the shell and lint the image scripts
#   make clean     remove build output

SHELL_DIR := shell
IMAGE_DIR := image

.PHONY: all shell dev image disk rebuild run run-serial smoke smoke-disk check clean

all: image

shell:
	cd $(SHELL_DIR) && npm install --no-audit --no-fund && npm run build

dev:
	cd $(SHELL_DIR) && npm run dev

image:
	$(IMAGE_DIR)/build.sh

disk:
	$(IMAGE_DIR)/build.sh --disk

# Re-lays the shell and overlay onto the rootfs from the last build and
# re-bakes the images. Roughly a minute instead of ten, which is what you
# want while iterating on the shell.
rebuild: shell
	$(IMAGE_DIR)/build.sh --skip-shell --reuse-rootfs --disk

run:
	$(IMAGE_DIR)/run.sh

run-serial:
	$(IMAGE_DIR)/run.sh --serial

smoke:
	$(IMAGE_DIR)/smoke-test.sh

smoke-disk:
	$(IMAGE_DIR)/smoke-test.sh --disk

check:
	cd $(SHELL_DIR) && npm run typecheck
	shellcheck $(IMAGE_DIR)/build.sh $(IMAGE_DIR)/run.sh $(IMAGE_DIR)/smoke-test.sh $(IMAGE_DIR)/overlay/opt/jackie-os/bin/jackie-kiosk
	python3 -m py_compile $(IMAGE_DIR)/overlay/opt/jackie-os/bin/jackie-hostd
	@echo "checks passed"

clean:
	rm -rf $(SHELL_DIR)/dist $(IMAGE_DIR)/out
