# IZ2S Platform — Balatro experimental fork

This fork adds a **Balatro Lua/LÖVE entry method** to IZ2S Platform on Nintendo Switch 2. The current result is a working, **partial Lua port of the original IZ2S ORBIT FOCUS menu layout**. It is not the native IZ2S supervisor and cannot yet load or install IZ2S applications.

The upstream **SmileBASIC** and **Civilization VII** entry methods remain separate and unchanged. The original native launcher is still located at `core/console/sd-launcher/native/build/launcher.bin`; Balatro does **not** execute that binary.

## Current status

**Confirmed on a physical Switch 2 running firmware 23.0.1:**

- Balatro's Lua RPC listener is reachable over TCP **9026**, and LuaJIT/FFI interfaces are available.
- The **ORBIT FOCUS** Lua view is visible on the Switch 2 screen. It displays the IZ2S title, **ADD** card and **BROWSE** screen, using layout geometry and colors derived from the upstream shaders.
- The gamepad works with the Lua view: a live session recorded **16 controller events** and successfully navigated from **HOME** to **BROWSE**.
- The same session reported **9,401 rendered frames**, **9,401 draw callbacks**, **0 draw errors** and **0 console draw failures**.
- The original native launcher binary and its manifest-listed sources pass offline integrity checks. **This does not mean the binary has executed.**

BROWSE first reads verified PC package previews through IZ2S's existing repository. If that inventory is empty, it falls back to matching local `module.json` descriptors against the repository's official app-version receipts. **Source entries are not verified package files**: their displayed SHA-256 identifies the descriptor, not a downloadable IZA. A selected entry opens read-only details. This expanded catalog still requires physical Switch confirmation and does not represent installed SD applications. Native launching, installation, SD access and privileged service operations are not implemented through the Balatro entry method.

### Verified and unverified features

| Feature | Status |
| --- | --- |
| Balatro Lua RPC (TCP 9026) | **Verified on Switch 2** |
| LuaJIT/FFI, limited SDK calls and title-owned buffers | **Verified within Balatro's existing process**; not a native IZ2S transport |
| ORBIT FOCUS Lua/LÖVE display | **Verified on screen**; partial port, not pixel-perfect |
| Controller input and HOME → BROWSE navigation | **Verified on Switch 2**; new package-details navigation pending hardware verification |
| Draw callbacks and rendering | **Verified:** 9,401 frames; 0 draw errors in the recorded session |
| Original native launcher and source integrity | **Verified offline**; never executed by Balatro |
| Verified PC package preview in BROWSE | **Implemented**; real PC inventory observed empty on Switch test (0 entries) |
| Official-version-matched local source descriptor fallback | **Implemented**; hardware verification pending, never installable |
| Read-only catalog details | **Implemented**; hardware verification pending |
| Installed SD app catalog, original icons and artwork | **Not connected** |
| Application installation and native execution from Balatro | **Not implemented** |
| Native addressable RPC, process memory mapping, service IPC and supervisor thread | **Not verified or implemented** |
| Full parity with the original IZ2S menu | **Not achieved** |
| Balatro selection and diagnostics in the local web panel | **Integrated**; full browser regression verification pending |

## Run the current Lua menu

Requirements: Switch 2 with the existing Balatro Lua RPC listener running on the same **trusted local network**; Windows or another host with Node.js and this repository checked out on `feature/balatro-orbit-focus-catalog`. Replace the example IP with your console's address.

```powershell
git fetch origin
git switch --track origin/feature/balatro-orbit-focus-catalog
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/canonical-focus.cjs 192.168.1.232 stop
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/canonical-focus.cjs 192.168.1.232 start
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/canonical-catalog.cjs 192.168.1.232
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/canonical-focus.cjs 192.168.1.232 status
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/canonical-focus.cjs 192.168.1.232 stop
```

Press **A** on ADD to open BROWSE, navigate with **left/right**, press **A** for read-only details and **B** to return. `availablePackages` counts only verified PC package previews; `sourceCatalogEntries` counts source-only descriptors; `installed` remains 0 unless SD apps are independently verified. Both catalog types are non-executable through Balatro. Do not run the older Lua diagnostic overlay in parallel. The view is title-local: it is lost when Balatro exits. The RPC service is not encrypted or authenticated; do not expose port 9026 to the internet.

To run the Balatro automated regression tests:

```powershell
node --test test/balatro-*.test.cjs
```

## Implementation

| Component | Role |
| --- | --- |
| `engines/iz2s-core/runtime/installer/engine/switch2/balatro/canonical-focus-model.lua` | Lua navigation state and layout geometry derived from the original shaders |
| `engines/iz2s-core/runtime/installer/engine/switch2/balatro/canonical-focus.lua` | LÖVE drawing, controller hooks and reversible lifecycle |
| `engines/iz2s-core/runtime/installer/engine/switch2/balatro/canonical-focus.cjs` | Lua model initialization and menu RPC: `start`, `status`, `left`, `right`, `select`, `back`, `stop` |
| `engines/iz2s-core/runtime/installer/engine/switch2/balatro/canonical-catalog.cjs` | Validated, read-only IZ2S PC library previews published as browse-only Lua rows |
| `engines/CivSwitch/launcher/app/shaders/` | Original ORBIT FOCUS layout, colors and navigation reference |
| `core/console/sd-launcher/` | Original native launcher and bootstrap, not executed from Balatro |

The Balatro native-entry adapter deliberately rejects unsupported native operations. Lua-side drawing and FFI presence must **not** be treated as evidence of arbitrary process memory access, service permissions or executable code mapping.

## Next priorities

1. Confirm the source-only fallback appears in BROWSE on physical hardware and remains distinct from verified PC packages and installed SD applications.
2. Reuse the original font atlas, artwork, transitions and layout details to improve visual fidelity.
3. Investigate supported Balatro capabilities independently before offering installation or application launching.

## Upstream and licenses

Original project: [byizmysh/IZ2S-Platform](https://github.com/byizmysh/IZ2S-Platform). Upstream installation instructions and packaged releases are maintained there. Balatro Lua entry work draws on [Luminger/balatro-switch-rce](https://github.com/Luminger/balatro-switch-rce).

Original authorship, component licenses and notices remain applicable. See [LICENSE](LICENSE), [LICENSE-SCOPE.md](LICENSE-SCOPE.md), [THIRD_PARTY.json](THIRD_PARTY.json), [AUTHORS.md](AUTHORS.md), [LICENSES/INDEX.md](LICENSES/INDEX.md) and [SOURCES.md](SOURCES.md).
