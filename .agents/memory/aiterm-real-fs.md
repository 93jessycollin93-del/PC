---
name: AiTerm real filesystem + Jackie gating
description: How AiTerm's home directory became a real disk-backed filesystem, and the access model used to restrict who can reach it.
---

AiTerm's home directory (`ls`/`cd`/`cat`/`mkdir`/`touch`/`rm`/`echo >`) is backed by real files under a server-side sandboxed root, exposed via `/api/term-fs/*` endpoints — not an in-memory fake tree.

**Access model:** a persisted on/off toggle (user-controlled "FS ON/OFF" button in the terminal header) gates all real-fs endpoints, and a shared client token restricts which callers may use them at all — AiTerm itself, plus Jackie's mini-PC `terminal` action, but only while `MiniPCManager.state.globalModeActive` is true.

**Why:** this is a single-tenant personal container, not a multi-tenant service — the token is a consistency/organization boundary ("only these two callers, and only when the feature is deliberately on"), not a hardened auth system. Path traversal must still use strict containment (`resolved === root || resolved.startsWith(root + path.sep)`), not a bare `startsWith(root)` prefix check — the latter allows sibling-directory bypass.

**How to apply:** if adding more real-fs-backed features (or letting other pods/apps touch real files), reuse this same pattern — sandboxed root + token + user-visible toggle — rather than inventing per-feature auth.
