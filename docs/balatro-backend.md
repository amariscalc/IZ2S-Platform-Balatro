# Balatro backend — diagnostic integration

This integration lives **inside the original IZ2S tree** at `engines/iz2s-core/runtime/installer/engine/switch2/balatro/`, leaving the existing SmileBASIC backend unchanged.

## Current capability

Balatro's Lua RPC accepts **one Lua chunk per TCP connection**, terminated by a write half-close. This backend sends a fixed, read-only capability probe and returns structured JSON. It performs no native calls, memory access, save writes, IPC or privilege changes.

It does **not** make IZ2S ready: `iz2s.ready`, `nativeOperationsVerified`, and `privilegedSessionVerified` are **always false**. It is not yet a replacement for the native bridge.

## Run

With Balatro's RPC already listening, from the repository root:

```powershell
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/diagnose.cjs 192.168.1.232
```

Use your console's current IP; the default TCP port is 9026. A custom port can be supplied as a second argument.

To exercise the simulated TCP protocol and fail-closed behavior without contacting a console:

```powershell
node --test test/balatro-diagnostics.test.cjs
```

## Known boundaries

- The upstream `engine/shared/rpc.cjs` expects local HTTP JSON calls and session-specific `connection.json`.
- The original switch2 native bridge relies on verified code bytes, memory mapping and an acquired privileged session.
- LuaJIT, `love.ffi.declare`, `love.ffi.invoke`, and `sdk_base` presence are *capability observations*, not confirmation of privileges.
- The new transport is not wired into a native-operation dispatch. No output may be passed off as an acquired/privileged session.
- Balatro RPC is unauthenticated. Use only on a trusted LAN and close the game when finished.

## Integrated panel lifecycle

The experimental Balatro mode is available on the IZ2S **Connection** page. Its read-only backend tracks `idle`, `checking`, `connected` and `unavailable`, and the local panel now provides an authenticated `GET /api/balatro/status` snapshot (no console request). The explicit `POST /api/balatro/diagnose` endpoint performs the fixed Lua diagnostic using TCP 9026. The authenticated `POST /api/balatro/disconnect` resets only the server-side diagnostic lifecycle and invalidates the pending diagnostic result; it does **not** close Balatro or terminate the console RPC listener. All lifecycle snapshots retain `ready: false`.

The view is isolated by a same-origin CSS file allowed under the panel CSP; the technical JSON is hidden in a collapsible panel. Selecting Balatro does not alter saved IZ2S loader settings.

## Next engineering milestone

Develop and verify a genuinely compatible, unprivileged session protocol for Balatro and assess limitations before connecting any native operations. Keep the original SmileBASIC IPC and all qualification checks untouched. Avoid treating Lua FFI availability as proof of elevated access.

## UI selection and session cleanup

The original IZ2S panel continues to mark SmileBASIC selected internally. Balatro's diagnostic view overrides the SmileBASIC styling while Balatro is selected, without changing the original launcher. This release also adds an explicit local diagnostic reset. A reset during an outstanding request prevents a stale successful reply from changing the session phase.

## Game switching (regression fix)

The Balatro panel is visible **only** while the Balatro experimental view is active. Clicking SmileBASIC or Civilization VII explicitly closes the diagnostics details element and removes the experimental mode. A stylesheet guard hides diagnostics in all non-Balatro views, even if the details element was previously expanded. The selection is visual only; native launcher settings remain owned by the original IZ2S application.

## Fixed Lua execution smoke test

`app-smoke.cjs` executes a bounded Lua application inside the already-running Balatro title via port 9026. The reply is parsed strictly; the result never claims native IZ2S launch or privilege access. Run `node engines/iz2s-core/runtime/installer/engine/switch2/balatro/app-smoke.cjs <console-ip>`.

The SmileBASIC selector explicitly restores `izlauncher` when switching from Civilization VII, rather than inheriting a stale variant.

## Fixed application-level command protocol (v1)

The fork now includes `app-runtime.cjs`, a **whitelisted, stateless Lua application protocol** that executes fixed commands in Balatro over the verified TCP Lua RPC transport. Supported commands are `ping`, `runtime`, and `math` (a bounded integer computation). Replies use `IZ2S_APP_V1` with strict command matching.

```powershell
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/app-runtime.cjs 192.168.1.232 ping
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/app-runtime.cjs 192.168.1.232 math 12
```

The expected math result for 12 is 145. This only verifies application-level command dispatch. No native IZ2S core or privileged IPC is involved.

## Native IZ2S startup: concrete compatibility requirements

The user has verified **44/44 local tests** and physical Balatro replies for `ping`, `runtime` and `math 12` (result 145). Those are meaningful evidence of a working Lua RPC path, but do not imply native readiness.

Run `node engines/iz2s-core/runtime/installer/engine/switch2/balatro/compatibility.cjs` for a source-grounded requirements report. In particular:

- `switch2/app/rpc.cjs` requires `call3`, `call4`, `read`, `write`, `query`, `verifyFunction`, `store64` and `batch`, which are not supplied by the title-local Lua diagnostic protocol.
- `switch2/app/session.cjs` checks executable code bytes/mappings and owned scratch allocation before native operations.
- `switch2/ro/start-core.cjs` depends on current privileged acquisition evidence, a verified FS notifier, retained memory and service sessions `pm:shell` and `pm:dmnt` before attempting staging/launch.

No report, address, handle, or privilege state should be synthesized to satisfy these checks. The next architectural step is separating portable, application-level functionality from the native core's protected process dependencies.

## On-console IZ2S application-layer display

The upstream Balatro savedata launcher renders its own on-console status/log view in `bl.console` and records messages using `bl.log.log`. The new `app-display.cjs` sends a fixed Lua request to append an IZ2S application-layer banner and native-readiness warning to this existing display. Run `node engines/iz2s-core/runtime/installer/engine/switch2/balatro/app-display.cjs <console-ip>` and check the physical Switch screen. This is **not** an NRO loader, a native core launch or an elevated session; the output explicitly says so. No save, memory or IPC operations occur.

## Hardware verification: on-console display

On 2026-11-18, the user confirmed that `app-display.cjs` produced the expected results **both on the Switch 2 display and in PowerShell**. This verifies that a Lua RPC request can write to the existing Balatro RCE launcher console via `bl.log.log`. It does not establish that a separate NRO process, hbmenu, native IZ2S core, or privileged IPC service started. The next implementation milestone is an application-layer lifecycle with explicit start/status/stop controls, not further connectivity smoke tests.

## Persistent Lua application lifecycle

`app-session.cjs` now implements a fixed four-command lifecycle: `start`, `status`, `step` and `stop`. Instead of writing a banner and exiting, the code stores the application model in Balatro's process-local `_G.__IZ2S_BALATRO_APP_V1` table. The upstream `bl.repl.evaluate` runs each RPC chunk in the title's main Lua state and its environment delegates global lookups to `_G`. Each new TCP request therefore reads the same table while the Balatro game process remains running. Commands return a strict `IZ2S_SESSION_V1` response and write lifecycle events using `bl.log.log`. No native worker, game save modification or automatic frame loop is installed. A running status means **a Lua component table exists**, not that a native executable is running.

Hardware verification of persistence across separate RPC requests is the next milestone.

## Physical Lua session verification and panel integration

The user confirmed 57/57 Node tests passing and physical Switch 2 outputs for `start`, `status`, `step 5`, `status`, `stop`, yielding running 0, running 0, running 5, running 5 and idle 0 respectively. This verifies title-local state persistence across RPC connections.

The IZ2S panel now exposes four buttons that call authenticated `POST /api/balatro/app`. The server validates a private LAN address, the exact operation allowlist and the fixed step count, and serializes requests to the existing Balatro Lua session executor. Neither this endpoint nor its UI can invoke arbitrary Lua, native memory or kernel services. Browser confirmation is still pending.
