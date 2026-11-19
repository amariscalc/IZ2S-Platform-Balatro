# IZ2S Platform — Balatro experimental fork

This fork adds a **Balatro Lua/LÖVE entry method** to IZ2S Platform on Nintendo Switch 2. The current result is a working, **partial Lua port of the original IZ2S ORBIT FOCUS menu layout**. It is not the native IZ2S supervisor and cannot yet load or install IZ2S applications.

The upstream **SmileBASIC** and **Civilization VII** entry methods remain separate and unchanged. The original native launcher is still located at `core/console/sd-launcher/native/build/launcher.bin`; Balatro does **not** execute that binary.

## Current status

**Confirmed on a physical Switch 2 running firmware 23.0.1:**

- Balatro's Lua RPC listener is reachable over TCP **9026**, and LuaJIT/FFI interfaces are available.
- The **ORBIT FOCUS** Lua view is visible on the Switch 2 screen, with HOME, BROWSE, a selected-app hero panel, and read-only package details. The original CivSwitch type atlas currently renders its **IZlauncher** title.
- The gamepad works with the Lua view: a later session recorded **30 controller events**, and BROWSE visually displayed the six source-index entries with the first card highlighted.
- The same session reported **9,401 rendered frames**, **9,401 draw callbacks**, **0 draw errors** and **0 console draw failures**.
- The original native launcher binary and its manifest-listed sources pass offline integrity checks. **This does not mean the binary has executed.**

BROWSE first reads verified PC package previews through IZ2S's existing repository. If that inventory is empty, it falls back to matching local `module.json` descriptors against the repository's official app-version receipts. **Source entries are not verified package files**: their displayed SHA-256 identifies the descriptor, not a downloadable IZA. A selected entry opens read-only details. The six source-index cards and BlitBun 1.15.8 details page have been visually confirmed on physical Switch hardware. The richer scene, corrected BROWSE layout and all six original app icon textures are now visually confirmed on hardware; the source type-atlas title also renders. These entries do not represent installed SD applications. Native launching, installation, SD access and privileged service operations are not implemented through the Balatro entry method.

### Verified and unverified features

| Feature | Status |
| --- | --- |
| Balatro Lua RPC (TCP 9026) | **Verified on Switch 2** |
| LuaJIT/FFI, limited SDK calls and title-owned buffers | **Verified within Balatro's existing process**; not a native IZ2S transport |
| ORBIT FOCUS Lua/LÖVE display | **Verified on screen**; partial port, not pixel-perfect |
| Controller input and HOME → BROWSE navigation | **Verified on Switch 2**, including highlighted source-index cards and opening BlitBun details |
| Draw callbacks and rendering | **Verified:** 9,401 frames; 0 draw errors in the recorded session |
| Original native launcher and source integrity | **Verified offline**; never executed by Balatro |
| Verified PC package preview in BROWSE | **Implemented**; real PC inventory observed empty on Switch test (0 entries) |
| Official-version-matched local source descriptor fallback | **Verified visually on Switch 2:** six real metadata entries displayed; never installable |
| Read-only catalog details | **Verified visually on Switch 2** for BlitBun 1.15.8; returning with B not independently documented |
| Orbital scene, selected-app hero, compact BROWSE layout | **Verified visually on Switch 2**; transition animation timing not independently measured |
| Original CivSwitch type crops and six application icons | **15/15 resources loaded, six icons and original title verified on screen** |
| Installed SD app catalog and native application assets | **Not connected** |
| Application installation and native execution from Balatro | **Not implemented** |
| Native addressable RPC, process memory mapping, service IPC and supervisor thread | **Not verified or implemented** |
| Full parity with the original IZ2S menu | **Not achieved** |
| Balatro selection and diagnostics in the local web panel | **Integrated**; full browser regression verification pending |

## Run the current Lua menu

Requirements: Switch 2 with the existing Balatro Lua RPC listener running on the same **trusted local network**; Windows or another host with Node.js and this repository checked out on `feature/balatro-orbit-focus-catalog`. Replace the example IP with your console's address.

```powershell
git switch feature/balatro-orbit-focus-catalog
git pull --ff-only
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/canonical-orbit.cjs 192.168.1.232 stop
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/canonical-orbit.cjs 192.168.1.232 start
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/canonical-orbit.cjs 192.168.1.232 status
```

The one-command `canonical-orbit.cjs start` stages the Lua model, original-layout visual scene, source-index catalog and original PNG artwork using Python 3 without third-party imaging packages. Visual-stage errors are reported under `visualStages` and do not prevent the proven text-only menu fallback from starting. The command reports image-loading failures while leaving the menu running with vector/text fallback. Use `start-no-art` for a graphics-only session without loading PNGs. Press **A** on ADD to open BROWSE, navigate with **left/right**, press **A** for read-only details and **B** to return. `availablePackages` counts only verified PC package previews; `sourceCatalogEntries` counts source-only descriptors; `installed` remains 0 unless SD apps are independently verified. Both catalog types are non-executable through Balatro. Do not run the older Lua diagnostic overlay in parallel. The view is title-local: it is lost when Balatro exits. The RPC service is not encrypted or authenticated; do not expose port 9026 to the internet.

To run the Balatro automated regression tests:

```powershell
node --test test/balatro-*.test.cjs
```

## Implementation

| Component | Role |
| --- | --- |
| `engines/iz2s-core/runtime/installer/engine/switch2/balatro/canonical-focus-model.lua` | Lua navigation state and layout geometry derived from the original shaders |
| `engines/iz2s-core/runtime/installer/engine/switch2/balatro/canonical-focus.lua` | LÖVE drawing, controller hooks and reversible lifecycle |
| `engines/iz2s-core/runtime/installer/engine/switch2/balatro/canonical-focus.cjs` | Lua model + visual staging, then menu RPC: `start`, `status`, `left`, `right`, `select`, `back`, `stop` |
| `engines/iz2s-core/runtime/installer/engine/switch2/balatro/canonical-visual-{base,scene}.lua` | Source-derived composition, animated cards, icons, details and fallback presentation |
| `engines/iz2s-core/runtime/installer/engine/switch2/balatro/canonical-visual-assets.cjs` | Optional read-only transfer of the repository's icon PNGs and CivSwitch type atlas crops |
| `engines/iz2s-core/runtime/installer/engine/switch2/balatro/canonical-orbit.cjs` | Single-command boot combining the read-only UI, catalog and original artwork |
| `engines/iz2s-core/runtime/installer/engine/switch2/balatro/canonical-catalog.cjs` | Validated, read-only IZ2S PC library previews published as browse-only Lua rows |
| `engines/CivSwitch/launcher/app/shaders/` | Original ORBIT FOCUS layout, colors and navigation reference |
| `core/console/sd-launcher/` | Original native launcher and bootstrap, not executed from Balatro |

The Balatro native-entry adapter deliberately rejects unsupported native operations. Lua-side drawing and FFI presence must **not** be treated as evidence of arbitrary process memory access, service permissions or executable code mapping.

## Next priorities

1. Verify all six original icons and source-atlas typography on Switch 2 and confirm the revised BROWSE panel no longer overlaps the heading or card row.
2. Refine visual fidelity using the upstream shaders after visual measurements on the Switch.
3. Investigate supported Balatro capabilities independently before offering installation or application launching.

## Original Book Reader: native package preparation

The Balatro menu now has an **independent native-package preparation workflow** for the unchanged original Book Reader 0.1.0. This uses IZ2S's existing `core/console/sd-launcher/reader/prepare.cjs` adapter and `core/console/sd-launcher/package.cjs` builder; it does **not** turn Book Reader into Lua or execute a native application.

```powershell
node --test test/balatro-original-book-reader.test.cjs
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/original-book-reader.cjs inspect
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/original-book-reader.cjs prepare
```

`inspect` verifies the original module, pinned GPU files, native ABI2 reader controller and its source hashes. `prepare` builds and reads back `launcher.iza` and its companion `.izdata` file using the **real native IZ2S build path**, under `data/build-cache/balatro-original-book-reader/book-reader-*/`. The default includes the original built-in welcome book; pass `--include-library` to include previously imported books.

These operations run **only on the PC**. An actual Book Reader launch requires a verified native IZ2S SD launcher and owned filesystem/Vulkan session. The Balatro Lua RPC does not currently provide that environment; no install, thread or native code execution is attempted or reported by this command.

## Upstream and licenses

Original project: [byizmysh/IZ2S-Platform](https://github.com/byizmysh/IZ2S-Platform). Upstream installation instructions and packaged releases are maintained there. Balatro Lua entry work draws on [Luminger/balatro-switch-rce](https://github.com/Luminger/balatro-switch-rce).

Original authorship, component licenses and notices remain applicable. See [LICENSE](LICENSE), [LICENSE-SCOPE.md](LICENSE-SCOPE.md), [THIRD_PARTY.json](THIRD_PARTY.json), [AUTHORS.md](AUTHORS.md), [LICENSES/INDEX.md](LICENSES/INDEX.md) and [SOURCES.md](SOURCES.md).
