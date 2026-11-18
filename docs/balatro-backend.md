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

## Next engineering milestone

Add an explicit backend selector to application initialization and a read-only capability/status panel, while keeping native operations unavailable until they can be independently verified. Do not modify the original SmileBASIC IPC or weaken qualification checks.
