# eYe OS security model

The point of building the OS rather than another app is that some things can
only be enforced underneath the app. This is what eYe OS enforces, what it
does not, and how to check which is which on a running machine.

Run `eye-audit` on the machine. Everything below is one of its checks, and
none of it is taken on trust from this file.

## What we are defending against

Concretely, in the order they are likely:

1. **A compromised renderer.** The session is a browser running a large
   application with many dependencies. Assume at some point something runs in
   that page that you did not write.
2. **A hostile network.** The machine is on wifi somewhere. Assume something
   on that network is scanning it.
3. **A dependency that phones home.** Assume a package in the tree wants to
   send something somewhere.
4. **Physical access to a powered-off machine.** Partially addressed; see
   the gaps.

Not defended against: someone with physical access to a *running,* unlocked
machine. That is a different project.

## What is enforced

### The network is closed by default

`/etc/eye-os/firewall.nft` sets `policy drop` on input, output *and* forward.
Egress is permitted only to addresses named in
`/etc/eye-os/allowed-egress.conf`, which ships empty.

An eYe OS machine that has not been told where it may go, does not go
anywhere. A dependency that wants to phone home cannot, unless its
destination is written down.

This is also what makes the next item safe.

### The session server binds `0.0.0.0`, and that is fine

The PC application's `server.ts` calls `app.listen(PORT, '0.0.0.0')`. That is
its author's business, and eYe OS does not patch it. The input chain drops
everything arriving from an interface, so the port is open on the socket and
unreachable from the wire.

This is the argument for OS-level security in one example. The application
did not have to change, cannot accidentally change back, and no future edit
to it can reopen the port.

`eye-audit` reports the bind as a warning rather than a pass, because the
firewall is the only thing standing between it and the network, and you
should know that.

### Secrets are per-machine and never reach the browser

`eye-provision` generates `JACKIE_API_TOKEN` on first boot into
`/etc/eye-os/session.env`, root-owned `0600`, created `0600` rather than
chmod-ed afterwards. A token baked into an image is the same token on every
machine flashed from it, which is worth nothing.

The session server uses that token to gate its shell, build and filesystem
routes. **eye-hostd holds the token and injects it on proxied requests**, so:

- the browser never has the credential, and script in the page cannot read it
- anything reaching port 5000 without it gets `403`

### Dangerous routes are refused ahead of the server

Injecting the token would otherwise hand the renderer full use of the routes
the token protects — a compromised page would simply ask the proxy to run the
command on its behalf. So `eye-hostd` refuses them outright:

```
EYE_BLOCKED_UPSTREAM=/api/shell/,/api/build/,/api/term-fs/
```

Three independent layers, verified:

| Attack | Stopped by | Observed |
|---|---|---|
| Reach `:5000` from the network | nftables input drop | dropped |
| Direct loopback request, no token | `JACKIE_API_TOKEN` | `403` |
| Same request *with* the injected token | proxy route policy | `403` |

The PC session's Terminal, Build and Shell apps will report errors while
those routes are blocked. That is the intended trade for an appliance. Remove
a prefix from `EYE_BLOCKED_UPSTREAM` if you want one back, and understand
that you are handing the renderer that capability.

### No compiler on the appliance

The image ships a bundled session server with `vite` aliased out
(`image/pc-vite-stub.mjs`). Vite brings a bundler, a transformer and native
code. A build toolchain on a locked-down machine gives anything that gets
code execution a way to build and load more.

`node_modules` does not ship either — the server is one 2.6MB file.

### No way in

- No sshd; `ssh.service` masked so a later `apt-get` cannot quietly start one
- No getty on any console — `getty@tty1` masked, `getty.target` disabled
- `root` locked, no account has a usable password
- Services confined: `NoNewPrivileges`, `ProtectSystem=strict`,
  `ProtectHome`, `PrivateDevices`, empty `CapabilityBoundingSet`, and a
  `@system-service` syscall filter on the one process holding API keys

## Gaps — the honest list

These are real and currently unaddressed. Do not assume otherwise.

**The root filesystem is read-write.** A compromise persists across reboot.
Read-only root with an overlay, plus dm-verity so the root hash is checked at
boot, is the fix. `eye-audit` reports this as a warning on every run, which is
correct until it is done.

**Data at rest is not encrypted.** `/var/lib/eye-os` holds the session's
files and browser profile in the clear. Someone with the powered-off machine
reads them. The fix is LUKS on the data partition; the awkward part is
unlocking it on a device with no keyboard, which means TPM sealing.
Half-implementing this would be worse than not, so it is not implemented.

**No Secure Boot.** The image is unsigned; firmware will boot a modified one.

**Egress allowlisting resolves names once.** nftables matches addresses.
A destination behind rotating IPs needs a CIDR or a periodic
`systemctl restart eye-firewall`. A large CDN will drift out from under it.

**The renderer is not sandboxed beyond the browser's own sandbox.** Chromium's
GPU sandbox is disabled under cage (`--no-sandbox`), because it has no working
path on a bare image. The site isolation the browser does natively still
applies; the OS adds nothing.

**No integrity measurement of the session bundle.** Nothing checks that
`/opt/eye-os/pc/server.cjs` is the file the build produced.

## Checking a machine

```sh
eye-audit          # human-readable
eye-audit --json   # for a health app or a cron job
```

Exit status is 0 when nothing failed, 1 otherwise. Warnings do not fail the
run; they are things worth knowing that are not yet wrong.

Run it after any change to `session.conf`, `allowed-egress.conf`, or the
firewall. Its output is the answer to "is this machine still configured the
way I think it is" — which is a question no README can answer.
