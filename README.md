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
git switch feature/balatro-original-book-reader
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

### Verified original Book Reader handoff (PC to IZ2S SD layout)

After `prepare` returns `phase: "prepared-on-pc"`, reuse its exact `packageFile` and `packageSha256`; do not rebuild the reader.

```powershell
$reader = "data/build-cache/balatro-original-book-reader/book-reader-20BvuW/launcher.iza"
$sha = "7f205e66829bd8788d68dfd6f4c2e8a6f640cb20e3a53ef021dbc5a1a37747e6"
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/original-book-reader-handoff.cjs verify $reader $sha
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/original-book-reader-handoff.cjs stage $reader $sha
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/original-book-reader-handoff.cjs live 192.168.1.232 $reader $sha
```

The handoff verifies the genuine `IZSDAPP1` ABI2 image and the original `sd-bundle.json` companion identities using the canonical package/asset decoders. `stage` writes a **PC-local export** beneath `data/build-cache/balatro-original-book-reader/sd-exports/<digest>/iz2s/modules/book-reader/` with `launcher.iza` and its immutable `.izdata` companion. It never mounts or writes the Switch SD card. `live` queries only Balatro's read-only RPC boundary and reports any missing native prerequisites.

**Neither `stage` nor `live` installs or executes the application on Switch 2.** A verified FS/IPC/native supervisor must be established separately before the original application's execution can be confirmed. Do not interpret files on the PC as files installed on the console. This is not a general-purpose native process launcher.

Run `node --test test/balatro-original-book-reader-handoff.test.cjs` to validate identity, fail-closed behavior, companion hashes and local staging.

### Original native loader interface preflight

Use the fixed, read-only Balatro loader-surface inspection to distinguish **exposed Lua/SDK symbols** from an actual authorized IZ2S native execution session:

```powershell
node --test test/balatro-native-loader-surface.test.cjs test/balatro-native-evidence.test.cjs
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/native-loader-surface.cjs 192.168.1.232
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/native-evidence.cjs 192.168.1.232
```

`native-loader-surface.cjs` queries only the presence of Balatro's FFI declaration API, known SDK metadata, LÖVE graphics and filesystem wrappers, and potential IZ2S module registrations. It performs no native function calls, memory access or writes. The result is included under `evidence.loaderSurface` in `native-evidence.cjs`.

**The mere presence of a LÖVE filesystem API does not mean SD storage is available; FFI and SDK metadata do not grant native IPC or executable mappings.** Book Reader cannot be executed via the current title-local transport without those verified prerequisites, and `native-rpc-boundary.cjs` deliberately rejects unsupported operations. Do not infer execution from a successful preflight.

### Latest loader-surface hardware result — 2026-11-19

The operator ran the `native-loader-surface.cjs` and updated `native-evidence.cjs` probes on the physical Switch 2. All **7/7 Node tests passed**. The fixed read-only loader-surface RPC returned:

- Present: `ffiDeclaration`, `sdkBaseMetadata`, `sdkGetterOffset`, `sdkMemcpyOffset`, `loveGraphicsPresent`, and `loveFilesystemPresent`.
- Not registered under the checked Lua module names: `iz2sNroModuleReported: false`, `iz2sNativeModuleReported: false`.
- No verified native session, console SD access, addressable native RPC, service IPC, executable code mapping, or supervisor thread.
- Integrated `native-evidence.cjs` returned `phase: title-local-characterized`, all six observations true (including `loaderSurfaceInventoried`), and `issues: []`.

**Interpretation:** LÖVE's filesystem API is not proof of console SD filesystem access. The FFI declaration API and SDK offsets are not a verified original IZ2S native transport. Missing registrations under the two checked Lua names do not rule out other modules, but do not provide a ready native loader. The Book Reader application is still *not executed*. The next milestone is a separately established, explicitly owned native IZ2S session with verified FS/IPC, executable mappings, rendering, and thread lifecycle; more title-local byte round trips do not satisfy those prerequisites.

### Switch 2 hardware evidence — 2026-11-19

**Latest live original Book Reader SDK memcpy — verified on Switch 2 (2026-11-19):** The operator ran `node --test test/balatro-owned-binary.test.cjs test/balatro-native-book-reader-copy.test.cjs` (**8/8 passing**) and then the new `native-book-reader-copy.cjs` command against Balatro RPC at `192.168.1.232`. The response reported `phase: original-book-reader-sdk-memcpy-verified`, `bytesNativeCopied: 512`, `nativeSdkMemcpyVerified: true`, `identical: true`, and `ownedBuffersReleased: true`. Both the original header and post-copy SHA-256 were `0d40524c96f00380768f1f94b39c37f9a864ca887e65d9a955a4c06557ad3fce`, using the verified original `launcher.iza` SHA-256 `7f205e66829bd8788d68dfd6f4c2e8a6f640cb20e3a53ef021dbc5a1a37747e6`.

**Boundary:** This verifies native SDK memcpy on two separate *title-owned data buffers only*. The actual response still reports `nativeTransportReady: false`, `nativeSupervisorRunning: false`, `installedOnConsole: false`, `executedOnConsole: false`, and `ready: false`. The original entry contract additionally requires independently verified original native RPC, mapped session ownership, SD filesystem, original renderer, validated SDK/HID/Vulkan functions, authorized executable mapping, and supervisor thread lifecycle. Increasing the transferred byte count alone does not satisfy these requirements or imply execution.

Verified from the operator's live Balatro RPC session on Switch 2:

- **10/10 regression tests passed** for the owned-binary transport, native evidence aggregation and original Book Reader transfer.
- **64-byte owned-memory round trip** passed with allocation, write/read comparison, and release; `owned-binary.cjs check` reported `phase: verified`.
- **512 genuine Book Reader package bytes** passed an exact round trip (`phase: original-bytes-verified-in-title`). Both SHA-256 values matched: `0d40524c96f00380768f1f94b39c37f9a864ca887e65d9a955a4c06557ad3fce`. The original package SHA-256 remains `7f205e66829bd8788d68dfd6f4c2e8a6f640cb20e3a53ef021dbc5a1a37747e6`. The buffer was released; the Switch SD card was not written.
- `native-evidence.cjs` reported `phase: title-local-characterized` and all five bounded observations true: Lua RPC, fixed SDK getter, owned Lua memory, 16-byte native SDK memcpy, and PC-to-title binary round trip.
- **No native application launch**: `nativeTransportReady: false`, `originalLauncherReady: false`, `originalBookReaderExecuted: false`, no service IPC, NRO mapping, executable memory, or native supervisor ownership verified. The seven requirements enumerated by the original entry contract remain unverified.

These are real *title-local userland* results, not equivalent to an addressable IZ2S platform-2 RPC, filesystem session, native code mapping, or executing the original reader.

### Balatro title-owned binary transport and live capability evidence

A new scoped RPC transport supports an actual 64-byte PC-to-Balatro-to-PC binary round trip, with byte verification, strictly bounded allocations, session-token isolation and zero-on-release. It is **only** LuaJIT-owned RAM inside the Balatro title, not the original IZ2S native address/IPC transport.

```powershell
node --test test/balatro-owned-binary.test.cjs test/balatro-native-evidence.test.cjs
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/owned-binary.cjs 192.168.1.232 check
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/native-evidence.cjs 192.168.1.232
```

The first probe exercises real, bounded allocation, writes, reads, comparison and release using a fresh random ownership token. The second combines the existing upstream native bridge checks (SDK getter, owned memory, bounded native memcpy) with the binary round-trip. The result distinguishes **observed userland capability** from missing native requirements. It never calls executable mapping, service IPC or the supervisor. Run these tests while Balatro is open and TCP RPC is available; they do not stop the ORBIT FOCUS frontend.

The original Book Reader's **actual native package bytes** can also be tested across the title boundary. This uses the previously verified 2.4 MB `launcher.iza`, copies only its first 512 bytes into a newly allocated title-owned buffer in four bounded chunks, reads those exact bytes back, compares a SHA-256, releases the buffer and clears the session. It **does not load the native image**, install to SD, expose addresses or call the original supervisor.

```powershell
node --test test/balatro-book-reader-transfer.test.cjs
$reader = "data/build-cache/balatro-original-book-reader/book-reader-20BvuW/launcher.iza"
$sha = "7f205e66829bd8788d68dfd6f4c2e8a6f640cb20e3a53ef021dbc5a1a37747e6"
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/book-reader-transfer.cjs 192.168.1.232 $reader $sha
```

A successful result reports `phase: "original-bytes-verified-in-title"`, `identical: true`, `consoleSdWritten: false`, and `originalAppExecuted: false`.

The Book Reader original `launcher.iza` is already built and locally staged. A successful binary round-trip does **not** mean that the 2.4 MB package can execute: the original launcher still requires a separately verified filesystem, graphics, memory, executable mapping and thread ownership contract.

### Original Book Reader native load-plan audit

The original C supervisor at `core/console/sd-launcher/native/launcher.c` does **not** load the entire `launcher.iza` into a Lua buffer. It verifies the SD header; stages small code/shader/control sections in CPU memory; sends the private image prefix directly to a coherent GPU allocation; initializes its pipeline and input; and only then invokes the original native ABI2 application via its retained supervisor. A title-local `memcpy` verification cannot replace this loader.

The Balatro branch now has an **offline**, fail-closed audit of the unchanged original Book Reader package using the existing verified `launcher.iza`, companion identity checks and canonical section/CRC/SPIR-V decoder:

```powershell
$reader = "data/build-cache/balatro-original-book-reader/book-reader-20BvuW/launcher.iza"
$sha = "7f205e66829bd8788d68dfd6f4c2e8a6f640cb20e3a53ef021dbc5a1a37747e6"
node --test test/balatro-original-book-reader-load-plan.test.cjs
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/original-book-reader-load-plan.cjs $reader $sha
```

The report lists the original file's section source offsets, byte lengths, CRC values, CPU staging offsets, GPU-private allocation and initial prefix, native data allocation, companion asset hashes and exact missing entry prerequisites. `phase: package-layout-verified-native-entry-blocked` means **package layout was validated on the PC**, not that any console filesystem or native mapping was obtained. This audit sends **no RPC** and does not install, map, allocate Switch memory, start threads or execute the reader.

The remaining boundary is independent ownership of the original platform-2 addressable native session, native SD FS endpoint, shader/Vulkan rendering context, code mapping and original supervisor lifecycle. None are supplied by merely copying more bytes through Balatro.

### Live Book Reader title resource survey (read-only)

The original native load plan was verified against the actual prepared Book Reader 0.1.0 image on the PC (**6/6 tests passing**): `launcher.iza` was 2,422,612 bytes, original ABI2 native code was 6,664 bytes, CPU staging was 2,291,540 bytes, and the native-data allocation requirement was 16 MiB. This verifies package layout, **not** console execution or permissions.

The next diagnostic identifies which **title-local** filesystem, drawing and thread APIs Balatro exposes without calling an undocumented native loader:

```powershell
git switch feature/balatro-original-book-reader
git pull --ff-only
node --test test/balatro-book-reader-runtime-surface.test.cjs
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/book-reader-runtime-surface.cjs 192.168.1.232
```

With Balatro running and its RPC listener active, this makes **one** fixed read-only Lua request. It checks whether selected `love.filesystem`, `love.graphics` and `love.thread` functions exist; optionally uses `love.filesystem.getInfo` on the **fixed title-relative path** `iz2s/modules/book-reader/launcher.iza` and `love.graphics.getDimensions`. It never reads package bytes, enumerates or mounts the SD, writes files, creates images or threads, calls FFI, invokes native services, maps code, or launches anything.

`filesystem.titleVirtualPathObservation` distinguishes `file`, `directory`, `missing`, `unavailable`, `error`, or `other`. A `file` result is **not proof** of console SD access: LÖVE's virtual filesystem may refer only to title-owned storage. `graphics.titleCanvasDimensions` and exported functions likewise do **not prove ownership** of the original Vulkan device/queues/presentation. `threading.titleThreadFunctionExposed` is not evidence of the original IZ2S native supervisor.

All execution and native ownership fields remain false. Native Book Reader can only run after a separately verified owner satisfies the actual original platform-2 session, SD endpoint, Vulkan context, code-mapping and thread-lifecycle contract. Do not use this survey's presence flags as permission to call privileged services.

## Upstream and licenses

Original project: [byizmysh/IZ2S-Platform](https://github.com/byizmysh/IZ2S-Platform). Upstream installation instructions and packaged releases are maintained there. Balatro Lua entry work draws on [Luminger/balatro-switch-rce](https://github.com/Luminger/balatro-switch-rce).

Original authorship, component licenses and notices remain applicable. See [LICENSE](LICENSE), [LICENSE-SCOPE.md](LICENSE-SCOPE.md), [THIRD_PARTY.json](THIRD_PARTY.json), [AUTHORS.md](AUTHORS.md), [LICENSES/INDEX.md](LICENSES/INDEX.md) and [SOURCES.md](SOURCES.md).
