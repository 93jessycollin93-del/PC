# eYe OS — build entry points.
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

# Globbed, not listed. This was a hand-written list and it went stale the
# first time a tool was added — which is the whole argument against writing
# one. Everything in bin/ is a Python tool except eye-kiosk, which is sh.
BIN_DIR := $(IMAGE_DIR)/overlay/opt/eye-os/bin
PY_TOOLS := $(filter-out $(BIN_DIR)/eye-kiosk,$(wildcard $(BIN_DIR)/*))
SH_SCRIPTS := $(IMAGE_DIR)/build.sh $(IMAGE_DIR)/run.sh $(IMAGE_DIR)/smoke-test.sh \
              $(BIN_DIR)/eye-kiosk

check:
	cd $(SHELL_DIR) && npm run typecheck
	shellcheck $(SH_SCRIPTS)
	python3 -m py_compile $(PY_TOOLS)
	@# The unit files are what make this an appliance; a typo in one is a
	@# service that silently never starts.
	@for unit in $(IMAGE_DIR)/overlay/etc/systemd/system/*.service; do \
		grep -q '^\[Unit\]' "$$unit" && grep -q '^\[Service\]' "$$unit" \
			|| { echo "malformed unit: $$unit" >&2; exit 1; }; \
	done
	@echo "checks passed"

clean:
	rm -rf $(SHELL_DIR)/dist $(IMAGE_DIR)/out $(IMAGE_DIR)/overlay/opt/eye-os/bin/__pycache__
