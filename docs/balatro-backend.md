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
