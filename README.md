# IZ2S Platform — Balatro experimental fork

## Balatro experimental backend (fork)

> **Development branch only.** This fork adds a Balatro Lua application-layer connection mode with a diagnostic interface to the IZ2S panel. It is **not** a usable IZ2S native launcher and must not be confused with an acquired privileged session. The original SmileBASIC and Civilization VII flows remain unchanged.

### Verified and unverified features

| Feature | Status |
| --- | --- |
| Balatro Lua RPC over TCP 9026 | Verified on Switch 2 FW 23.0.1 |
| Lua 5.1 / LuaJIT 2.1 and FFI availability | Verified by real RPC introspection |
| IZ2S panel diagnostics, experimental Balatro selection | Integrated; user-tested |
| Separate Balatro diagnostic lifecycle (idle / checking / connected / unavailable) | Implemented; requires regression verification for this revision |
| Local authenticated GET status snapshot | Implemented; read-only |
| Clear local Balatro diagnostic session | Implemented; does not close the game or change console state |
| Exclusive Balatro highlight in panel | Updated to override the original SmileBASIC selection while in Balatro view; awaiting browser verification |
| Hide Balatro dashboard when selecting SmileBASIC or Civilization VII | Fixed via explicit close and same-origin CSS guard; awaiting browser verification |
| SmileBASIC selection after Civilization VII | Handler now explicitly requests `izlauncher`; browser verification pending |
| Native memory read/write, Horizon IPC, privileged access | **Not implemented or verified** |
| Fixed unprivileged Lua code execution in Balatro | **Verified on physical Switch 2** using `app-smoke.cjs` |
| Whitelisted application RPC (`ping`, `runtime`, `math`) | **Verified on physical Switch 2**; 44/44 tests reported passing |
| Static native startup compatibility report | Added; identifies current native readiness blockers without probing privileged memory |
| Display an IZ2S application-layer banner on Switch 2 | **Verified on physical Switch 2 and in PowerShell** via `app-display.cjs` |
| Persistent, title-local IZ2S Lua lifecycle (`start/status/step/stop`) | **Verified on physical Switch 2:** start → status → step 5 → status → stop; 57/57 tests passing |
| Balatro Lua app controls in the IZ2S web panel | Implemented; on-console RPC evidence observed, UI verification pending |
| On-console graphical IZ2S Lua app overlay | **Verified on physical Switch 2 screen:** overlay rendered and displayed `STEPS: 5`; `overlay: attached` confirmed in PowerShell |
| Five-item Lua menu and reversible gamepad input | **Implemented; awaiting Switch controller test** |
| Menu-client JavaScript syntax | Missing comma fixed; Lua extracted to `app-menu.lua` with explicit CI syntax check |
| Loading the IZ2S native core from Balatro | **Not implemented** |

### Test the fork from source

From your checkout of `feature/balatro-diagnostics-backend`, with Node.js 22+:

```powershell
node --test test/balatro-*.test.cjs
node start.cjs --preview
```

Open the local panel, select **Balatro (experimental)**, enter your Switch's LAN IP and click **Check Balatro RPC**. The new **IZ2S Lua application** panel exposes Start, Status, menu navigation (Up/Down/Select/Back), Step +5 and Stop controls, each forwarded through an authenticated, allowlisted local HTTP endpoint. The dedicated view shows capability cards. Technical JSON is collapsible. The original launcher controls are hidden in this view, not removed from the original applications. On switching back to SmileBASIC or Civilization VII, the Balatro panel closes and is hidden by CSS even if previously expanded. **Clear RPC session** resets only local diagnostic state; it does not close Balatro or invalidate its Lua RPC listener.

For a **single real application-level Lua execution test** inside Balatro (not the native IZ2S core), run:

```powershell
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/app-smoke.cjs 192.168.1.232
```

The output confirms whether the fixed Lua application completed in the title. This test does not invoke FFI, use memory primitives or access privileged IPC.

Run the whitelisted, non-privileged Lua application command protocol:

```powershell
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/app-runtime.cjs 192.168.1.232 ping
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/app-runtime.cjs 192.168.1.232 math 12
```

Run the persistent IZ2S **Lua component** in Balatro. Start once, query from a new TCP connection, execute a step, then stop:

```powershell
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/app-session.cjs 192.168.1.232 start
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/app-session.cjs 192.168.1.232 status
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/app-session.cjs 192.168.1.232 step 5
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/app-session.cjs 192.168.1.232 stop
```

On **Start**, the component additionally tries to wrap Balatro's existing `bl.console.draw` method to show a live **IZ2S / BALATRO** graphical panel. **Step +5** changes the counter shown on that panel. **Stop** restores the original `console.draw` handler if our wrapper is still installed. The RPC result includes `overlay: attached|unavailable|none`; `attached` means that the drawing callback was installed, **not** that display output has been confirmed. The user has confirmed `overlay: attached` for `start`, `step 5`, and `status` on physical Switch 2. If graphical rendering fails, the Lua RPC session remains usable. The on-console overlay and step counter have been visually verified on physical Switch 2 hardware. Visual removal after Stop has not yet been independently documented.

The component is stored only in Balatro's running Lua global state, survives individual RPC connections but **not** game termination. It records start, step and stop events to the existing on-screen logger. It does not load hbmenu/NRO, call native SDK operations or modify privilege state. Check the output and the Switch screen before marking it verified.

Show an IZ2S application-layer status on the **Balatro console screen** (does not start the native core):

```powershell
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/app-display.cjs 192.168.1.232
```

The command uses Balatro's own `bl.log` display. **Confirmed on a physical Switch 2:** the two `[IZ2S]` lines appeared on screen and PowerShell reported the expected success response. It performs no native calls and does not alter game saves.

Inspect the actual native-core requirements without running an exploit or touching the console:

```powershell
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/compatibility.cjs
```

The report classifies the Lua transport as verified and all native startup requirements as **not verified**. The program does not claim the native core is ready.

A CLI alternative, with the RPC listener already active:

```powershell
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/diagnose.cjs 192.168.1.232
```

Use your console's actual address. Balatro's RPC is unauthenticated and unencrypted: use a trusted private LAN only. The panel checks private IPv4 addresses and requires its normal token. No credentials or save files belong in Git.

**Current limitation:** `ready: false` is intentional. An available FFI function does not prove that the process can perform the privileged operations IZ2S requires.

This fork deliberately does **not** implement a native call bridge, kernel exploit, or a replacement for the required IZ2S privilege checks. The next engineering focus is explicit session lifecycle behavior and a verified compatibility matrix for any unprivileged operations.

See [Balatro backend technical notes](docs/balatro-backend.md). Changes to this fork's Balatro backend should update this README in the same commit or push, keeping verified features and limitations accurate.

---


IZ2S is a Homebrew launcher for Nintendo Switch.

## Upstream IZ2S 0.25 downloads

| System | Download |
| --- | --- |
| Linux x64 / ARM64 | [Linux installation archive](https://github.com/byizmysh/IZ2S-Platform/releases/download/v0.25.0/IZ2S-Platform-0.25-linux.tar.gz) |
| Windows x64 | [Windows installation ZIP](https://github.com/byizmysh/IZ2S-Platform/releases/download/v0.25.0/IZ2S-Platform-0.25-windows-x64.zip) |
| File checksums | [SHA256SUMS.txt](https://github.com/byizmysh/IZ2S-Platform/releases/download/v0.25.0/SHA256SUMS.txt) |

Use the installation archives above. GitHub's automatic **Source code** downloads are for development, not the packaged installers.

## Screenshots

### IZ2S Platform panel

![IZ2S Platform App library in English](docs/images/iz2s-panel-0.25.png)

### IZ2S console launcher

![IZ2S 0.25 launcher showing the SD library and FTP shortcut](docs/images/iz2s-launcher-0.25.png)

## Before installation

Extract the entire archive into a new folder. Keep the folder structure intact. Installation creates a separate per-user copy; do not extract over an existing installation. Network access is required when the installer needs to download host dependencies.

## Linux x64 / ARM64 installation

Open a terminal in the extracted folder and run this single command:

```sh
sh ./install.sh --launch
```

Setup installs the missing prerequisites, verifies the installation, creates desktop and application-menu shortcuts and opens the panel automatically. Your package manager may request your password. No manual Node.js or Python setup is required on supported Linux systems.

The installer checks Python 3, Pillow, curl, tar, xz and SSH; it can install system prerequisites with your package manager and prepare Node.js 24 if needed. The installer prints the final destination.

For later launches, choose **IZ2S Platform** from the application menu, or open the installed folder and run:

```sh
./start.sh
```

The default location is a new versioned folder under:

```text
~/.local/share/iz2s-platform/releases/
```

The installer does not require an existing Node.js installation if it can download the private runtime. To choose a destination without system package changes or desktop shortcuts:

```sh
./install.sh --prefix /absolute/path/iz2s-platform --no-system-packages --no-desktop
```

## Windows x64 installation

Extract the complete ZIP with **Extract All**, then double-click:

```text
Install.cmd
```

Wait until setup prints **Installed** and opens the panel automatically. For later launches, use the **IZ2S Platform** desktop or Start-menu shortcut, or open the printed destination folder and double-click:

```text
Start.vbs
```

The desktop and Start-menu shortcuts include the IZ2S icon and open the panel without a console window. For an existing installation, use those shortcuts or Start.vbs in the installed folder. Start.cmd is retained as a console diagnostic entry point; do not start files from the downloaded ZIP. Setup prepares private Node.js, Python and Pillow, and an SSH client if missing. Windows x64 is required; Windows ARM64 and 32-bit systems are not supported. The panel and console packages are included; the Linux PC media hosts and Civ7 Wi-Fi setup are not Windows-supported features.

Windows may show its standard firewall permission dialog for Node.js. Allow access on your private network when connecting a console; the local panel itself works without opening incoming network access.

## Opening the panel and checking the installation

The panel normally opens at:

```text
http://127.0.0.1:39524
```

PC Link uses port **39525**. Installation verifies the packaged files automatically. The following optional commands use the private runtime from the installed folder; global Node.js/npm is not required.

Preview on Linux (does not establish a console session):

```sh
./preview.sh
```

Preview on Windows:

```powershell
.\data\runtime\node\node.exe .\start.cjs --preview --no-open
```

Use the URL printed by the Preview process. To repeat the release-content checks on Linux:

```sh
./tools/node distribution/verify.cjs
```

On Windows:

```powershell
.\data\runtime\node\node.exe .\distribution\verify.cjs
```

## Included applications

| Application | Version | Purpose | Restrictions |
| --- | --- | --- | --- |
| [BlitBun](https://github.com/byizmysh/BlitBun) | 1.15.8 | PC video/audio streaming | Only Linux |
| Book Reader | 0.1.0 | TXT/EPUB reader | |
| Foldrift | 0.3.3 | Autonomous SD file manager | |
| [IZ2S Cheese](https://github.com/byizmysh/iz2s-cheese) | 0.8.0 | Homebrew application catalog | |
| [VacooTube](https://github.com/byizmysh/VacooTube) | 1.5.7 | Video player with PC source | Only Linux |
| [IZPSX emulator](https://github.com/byizmysh/IZPSX-emulator) | 0.5.2 | PlayStation emulator | |

Open **App library** in the panel and install the selected application to the paired console. For a mounted SD card, use the platform's SD installation/export action. The installed entry is:

```text
SD:/iz2s/modules/<id>/launcher.iza
```

Keep every exported companion resource, manifest and signature beside the executable.

For Foldrift:

```text
SD:/iz2s/modules/foldrift/launcher.iza
```

For IZ2S Cheese:

```text
SD:/iz2s/modules/iz2s-cheese/launcher.iza
```

A PC download may be a package containing resources; do not simply rename that package to `launcher.iza`.

BlitBun uses its panel tab to select a browser share or a PC window. Native window/audio capture uses Linux, FFmpeg, X11/XWayland and PulseAudio/PipeWire (`pactl`/`parec`). Browser sharing requires an explicit selection in the browser. VacooTube includes its PC application source, streaming server and, in the Linux archive, clean Electron runtimes for x64/ARM64. No browser profile or login is included. These Linux media helpers are not supported on Windows; application files remain available for installation to Switch. Book Reader imports TXT/EPUB through its panel settings. IZ2S Cheese uses a configured catalog and its own download interface.

## IZPSX BIOS and games

BIOS and game images are not included. Add your own **512 KiB (524,288-byte)** BIOS at:

```text
SD:/iz2s/modules/izpsx/bios/bios.bin
```

Put games in:

```text
SD:/iz2s/modules/izpsx/games/<game name>/
```

Keep each CUE file with all referenced BIN/IMG tracks; put PBP files in the same per-game layout.

When updating, preserve settings and these folders:

```text
bios/
games/
saves/
```

The updated 0.5.2 native image and PC file interface both use these paths.

## Connections and local state

Select the input device and network adapters in the panel. Automatic discovery depends on a reachable local network; enter the device's displayed address when discovery is unavailable. Use the port actually shown in the console's FTP indicator; older installed runtimes can differ from the current **default of 1425**. Reopening the console menu is required to activate a newly installed native runtime.

Personal settings, pairing keys and logs are created on first use under:

```text
data/
```

Or in the owning module's state directory. No credentials, Nintendo keys, BIOS, games, save files or previous sessions are supplied. Civ7 currently has no filesystem access; its Wi-Fi setup requires Linux networking tools. No delivery date is promised by this release.

## Authors, upstream work and licenses

**IZMYSH (@byizmysh)** authors and maintains IZ2S integration and the application adaptations. This project relies on work by many other authors; renaming an interface does not remove their authorship or license terms.

- **BermTheSequel, pepsipu and kurumuz**: the ns2jb family and inherited console connection work. Exact retained origins/revisions are in the engine provenance and installer notices: [ns2jb2](https://gitlab.com/BermTheSequel/ns2jb2), [pepsipu/ns2jb](https://gitlab.com/pepsipu/ns2jb/), [kurumuz/ns2jb](https://gitlab.com/kurumuz/ns2jb).
- **ouncebrew and contributors**: kaiHEN, libkaihen, libounce and related runtime components. Original names and notices are preserved for attribution in `engines/iz2s-core/runtime/package/licenses/` and runtime provenance. [kaiHEN](https://github.com/ouncebrew/kaihen).
- **OunceVK, Mesa/NVK/Zink, devkitPro, switchbrew and their contributors**: graphics, native runtime and homebrew components. Individual component licenses apply; bundled texts include Mesa, libounce, libnx, nx-hbloader and nx-hbmenu.
- **Gezine and the CivSwitch/LDN contributors**: Civilization VII integration. See `engines/CivSwitch/LICENSE` and `engines/CivSwitchLDN/LICENSES/`. [CivSwitch](https://github.com/Gezine/CivSwitch).
- **misshexa66 and OunceCake contributors**: filesystem tooling. [OunceCake](https://github.com/misshexa66/OunceCake); original GPL notice retained in `core/filesystem/ouncecake/`.
- **shy / shy1132 and VacuumTube contributors**: the MIT-licensed application underlying VacooTube. Its source copyright and license remain in `modules/VacooTube/app/`. [VacuumTube](https://github.com/shy1132/VacuumTube).
- **hyln9 and nxhid contributors**: the Switch keyboard base. Firmware includes its MIT license, libnx and font notices. [nxhid](https://github.com/hyln9/nxhid).
- **M5Stack, lovyan03, Benoit Blanchon, Ha Thach, Espressif and Arduino contributors**: Cardputer firmware dependencies, including M5Cardputer, M5Unified, M5GFX/LovyanGFX, ArduinoJson, TinyUSB, ESP-IDF, Arduino-ESP32 and IRremote. Versions and texts are retained with the firmware.
- **DejaVu/Bitstream font authors, Monocypher authors, GitHub Octicons authors**, and the authors of Terser, Acorn, source-map, jridgewell mapping libraries and buffer-from: typography, signature verification, artwork and runtime JavaScript processing. Original notices remain beside their components.
- **PCSX2, PCSX-ReARMed and their contributors**, plus VIXL, cubeb, SoundTouch, libchdr, fmt, ImGui, libzip, cpuinfo, simpleini, rcheevos, discord-rpc, plutosvg and plutovg authors: inherited statically linked runtime code. IZPSX is included; associated native dependency license texts are retained in `LICENSES/native-linked/`. Native source coverage is described in [SOURCES.md](SOURCES.md).
- **Electron/Chromium, Node.js, Python, uv, Pillow, OpenSSH, FFmpeg and audio-stack contributors**: bundled or separately installed host dependencies. Electron's complete third-party HTML notice is preserved in each bundled runtime. Downloaded tools retain their own license terms.

`LICENSE` and `COPYRIGHT` cover independently authored IZMYSH code under **GPL-2.0-or-later**. Explicit MIT components (including Foldrift and IZ2S Cheese), third-party code, fonts and prior grants retain their own licenses. This is not a blanket relicensing. See [LICENSE-SCOPE.md](LICENSE-SCOPE.md), [THIRD_PARTY.json](THIRD_PARTY.json), [AUTHORS.md](AUTHORS.md) and [LICENSES/INDEX.md](LICENSES/INDEX.md).

The native runtime contains additional previously linked components, whose notices remain applicable. Their notices must be preserved. See [SOURCES.md](SOURCES.md) for the scope of the available native sources and [COMPATIBILITY.md](COMPATIBILITY.md) for platform support.

### Interactive Lua menu on Switch 2 (experimental)

The Balatro graphical overlay now shows five options: **ADD +1**, **ADD +5**, **STATUS**, **ABOUT**, and **STOP LUA APP**. It intercepts D-pad Up/Down plus **A** (select) / **B** (back) through a reversible wrapper of the existing LÖVE gamepad event dispatcher. Keyboard Up/Down/Enter/Escape is supported when available. The original event handlers receive unrelated input and are restored if they still belong to IZ2S at stop. It does not overwrite `love.draw`, call FFI or install an NRO. Hardware controller input is **not yet verified**. The same navigation can be exercised over RPC or the browser:

```powershell
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/app-session.cjs 192.168.1.232 stop
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/app-session.cjs 192.168.1.232 start
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/app-session.cjs 192.168.1.232 down
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/app-session.cjs 192.168.1.232 select
```

The stop/start pair upgrades the previous graphical overlay to this menu; the RPC reply still reports Lua application state, not native IZ2S readiness.

### 2026-11-18 syntax regression

The first interactive-menu release contained a missing JavaScript comma immediately after `app.inputActive=attachInput()`. This caused `SyntaxError: Unexpected string` in `app-session.cjs` before any network operation. To prevent recurrence, the fixed Lua application has been moved to a separate `app-menu.lua` source file; `app-session.cjs` now substitutes only a validated operation from its eight-action allowlist and a bounded numeric step count. The CI workflow explicitly runs `node --check` before the Balatro suite. The new menu has not yet been tested on hardware; the previously confirmed graphical overlay is unaffected by this PC-side syntax regression.

### Read-only Balatro native bridge preflight (2026-11-18)

Run from the repository root with Balatro RPC already connected:

```powershell
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/native-preflight.cjs 192.168.1.232
node --test test/balatro-native-preflight.test.cjs
```

The preflight checks only the presence and types of `love.ffi.declare`, `love.ffi.invoke`, and the title-local `bl.app.info.sdk_base`. It performs **no** FFI calls, SDK instruction verification, IPC requests, memory changes, service acquisition, or NRO loads. All native-launch qualification flags remain false. A reported bridge and SDK base are insufficient evidence for `ldr:ro` compatibility or native IZ2S startup. The preflight needs a hardware RPC run before any result can be claimed for this Switch.

### Static native-loader compatibility audit (2026-11-18)

Run from the repository root:

```powershell
node --test test/balatro-static-compatibility.test.cjs
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/static-compatibility.cjs > balatro-static-compatibility.json
```

The static audit reads existing source files only. It inventories nine groups of textual requirements in the Balatro Lua transport, original native RPC, session verification, `ldr:ro` loader and privileged core startup. A present source marker demonstrates only that the referenced code path exists, **not** that Balatro can execute it. The report always sets `ready: false`, `contactedConsole: false`, and `executedNativeCalls: false`. The preflight's four positive FFI interface checks do not establish native memory transport, executable mapping permissions, IPC services or a privilege acquisition channel. No changes are made to the original backends.

### Offline Balatro/native RPC contract diff (2026-11-18)

This audit compares eight interface-contract categories, including request framing, return types, native-call dispatch, memory operations, SDK verification, resource ownership, `ldr:ro` IPC and privileged core prerequisites. It only reads local source files and never contacts the console or executes native operations.

```powershell
node --test test/balatro-contract-diff.test.cjs
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/contract-diff.cjs > balatro-contract-diff.json
```

A successful test means source-contract markers are consistent, **not** that the native loader is compatible. The report intentionally retains `nativeCompatibilityVerified: false` and `ready: false`. This is separate from the live FFI-presence preflight. Original native modules and the other input backends remain unchanged.

### Isolated native transport contract simulation (2026-11-18)

This experiment tests response shapes, buffer-copy semantics, error handling, transfer limits and cleanup **entirely inside Node.js**, with no live console connectivity. It does not implement a native Balatro transport.

```powershell
node --test test/balatro-mock-native-contract.test.cjs
```

`mock-native-contract.cjs` uses a 4 KiB synthetic buffer and permits transfers of up to 256 bytes. Its only simulated call is `mock:add-u32`; service IPC, `ldr:ro`, native instruction verification, arbitrary calls, native stores and native batches are rejected. `nativeCompatible` and `ready` always remain false. A passing test confirms simulated interface behavior, not any real Switch privilege or native execution capability.

### Live title-local Balatro RPC roundtrip (2026-11-18)

This experiment is intentionally limited to an isolated Lua global in the running Balatro title. It sends three fixed commands across separate TCP connections: set a harmless integer (42), read it back, and clear it. No FFI, memory access, save modifications, privileged service, or NRO is involved.

```powershell
node --test test/balatro-rpc-roundtrip.test.cjs
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/rpc-roundtrip.cjs 192.168.1.232
```

The response parser rejects unexpected framing or state and no command is automatically retried. A best-effort clear command is sent after any attempted begin, including when its response is ambiguous. Success proves only Lua state persistence across Balatro RPC connections. It does not prove native transport compatibility or IZ2S core readiness.

### Live Balatro Lua menu navigation smoke test (2026-11-18)

The isolated smoke test checks that the Lua menu starts, retains the selected item across TCP RPC connections, increments the title-local step counter through menu selection, opens the status page, returns home and cleans up. It does **not** execute the native IZ2S menu or any native/FFI operation. It refuses to modify an already-running Lua menu.

```powershell
node --test test/balatro-menu-navigation.test.cjs
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/menu-navigation.cjs 192.168.1.232
```

Run only with Balatro's RPC server active. The script starts a temporary Lua overlay and stops it in a finally block. On an ambiguous timeout or error, do not retry blindly; first inspect the current application state with `app-session.cjs <ip> status`. A passing test demonstrates title-local menu navigation and RPC persistence only; `nativeCoreLaunched` and `ready` stay false.

### Observe physical controller / overlay state in Balatro (2026-11-18)

With Balatro RPC running, first execute the local tests and start the title-local Lua menu:

```powershell
node --test test/balatro-controller-observe.test.cjs
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/app-session.cjs 192.168.1.232 start
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/controller-observe.cjs 192.168.1.232
```

Check the Switch screen visually. Then press **D-pad Down** once on the physical controller and run `controller-observe.cjs` again. Repeat after **A**; compare `menu`, `steps` and `page` between observations. Use **B** to return from a detail page, then observe again. Finally run:

```powershell
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/app-session.cjs 192.168.1.232 stop
```

The observer only reads the Lua menu's state and whether its wrapper functions remain installed in `love.handlers` and `bl.console.draw`. `overlay: true` indicates the draw wrapper is attached, **not** that a frame is visibly rendered. `gamepad: true` indicates the handler wrapper is installed, **not** that physical button events reached it. `drawFault: false` means no drawing exception was recorded by the wrapper; it is not visual proof. An actual on-screen observation and button-driven state transition are still necessary. This experiment makes no native or FFI calls.

### Balatro backend provider integration (2026-11-18)

The Balatro input route now has a dedicated provider at `switch2/balatro/backend.cjs` rather than just ad-hoc Lua test clients. The panel application controller delegates its existing allowlisted menu actions to this provider. It keeps the other input backends unchanged.

The provider supports the verified Lua capability audit, menu RPC and input/overlay observation. Native-call, memory, service IPC, NRO and core-startup methods are represented as explicit **unsupported** operations with error code `BALATRO_NATIVE_UNAVAILABLE`; they do not silently fall back to another backend or claim native readiness.

```powershell
node --test test/balatro-backend.test.cjs test/balatro-backend-panel.test.cjs
node --test test/balatro-*.test.cjs
```

This change integrates the application-level Balatro backend into the Platform's panel route. Native IZ2S startup from Balatro is **not** functional yet: the required native transport and acquisition/service prerequisites still have no verified implementation. Do not run native startup scripts against the Lua-only RPC endpoint.

### Balatro FFI signature discovery without native invocation (2026-11-18)

The next compatibility prerequisite is understanding the **Lua wrapper interface** for `love.ffi.declare` and `love.ffi.invoke`. The backend now exposes `inspectFfi()` and a CLI to inspect function metadata through `debug.getinfo` inside Balatro. This does not call either FFI method or touch native memory.

```powershell
node --test test/balatro-ffi-profile.test.cjs test/balatro-backend.test.cjs
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/ffi-profile.cjs 192.168.1.232
```

`implementation` is `Lua`, `C`, `missing` or `unknown`. `parameters` and `varargs` come from the game's Lua debug metadata, when available; LuaJIT/5.1 C wrappers may report no reliable argument count. Profile success is **not** proof of a callable SDK ABI, code execution, memory access, IPC or loader privileges. `ready` remains false.

### Typed, symbolic Balatro FFI transport contract (2026-11-18)

`switch2/balatro/ffi-contract.cjs` adds an independent, **data-only** declaration validator. It describes the candidate Lua wrapper contract `declare(returnType, argumentTypes, address)` and `invoke(...args)`, using symbolic `sdk:...` references instead of raw addresses. Invalid types, arbitrary fields, addresses expressed as numbers/hex pointers, and oversized argument lists are rejected.

The Balatro backend now offers `planFfi(host, declaration)`, which first retrieves the real console's read-only FFI signature profile and produces a planning report. It intentionally does **not** resolve symbols, call `declare`, call `invoke`, or grant an executable transport. All native methods still return `BALATRO_NATIVE_UNAVAILABLE`.

```powershell
node --test test/balatro-ffi-contract.test.cjs test/balatro-backend.test.cjs
node --test test/balatro-*.test.cjs
```

The descriptor counts integer/pointer and float/double register classes separately (up to 8 each, 16 mixed total), matching the limits documented for the upstream Balatro RCE 1.1.0 ABI: https://github.com/Luminger/balatro-switch-rce/releases/tag/v1.1.0 . No function is invoked.\n\nThe allowed type labels are an **unverified candidate vocabulary** for adapting contracts in Node.js: they are not proof that Balatro accepts those exact spellings. A match between the observed Lua wrapper arity and the candidate signature does not verify the native ABI, actual SDK targets, memory operations, service IPC, permissions or startup. Keep `ready=false`.

### Inspect actual Lua FFI wrapper parameter names (2026-11-18)

A new read-only probe, `switch2/balatro/ffi-names.cjs`, retrieves parameter names using `debug.getlocal(function, index)` and counts lexical upvalues using `debug.getupvalue`, **without reading their values**. This is a diagnostic probe only; it does not call `love.ffi.declare` or `love.ffi.invoke`.

```powershell
node --test test/balatro-ffi-names.test.cjs test/balatro-backend.test.cjs
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/ffi-names.cjs 192.168.1.232
```

The Balatro backend also provides `inspectFfiNames(host)`. Depending on LuaJIT debug availability, the probe may return `unavailable` or unnamed arguments. Parameter names are informative, not a proof of their meaning, native ABI support, memory access, service permissions or native core startup. `ready` remains false.

### Source-backed Balatro FFI ABI mapping (2026-11-18)

Reviewed upstream `Luminger/balatro-switch-rce/src/bl/call.lua` and `src/bl/ffi_call.lua`. The actual Lua wrappers are `declare(ret,args,address)` and `invoke(target,...)`. Upstream `declare` returns an ordinary Lua function, while the legacy `invoke` returns a result table with `raw`, `int32` and `int64`. For source and usage details see https://github.com/Luminger/balatro-switch-rce/blob/main/src/bl/call.lua and https://github.com/Luminger/balatro-switch-rce/blob/main/src/bl/ffi_call.lua .

The data-only `ffi-contract.cjs` validator now translates internal descriptor labels to the upstream C type vocabulary, e.g. `u32 -> uint32_t`, `pointer -> void *`, `f64 -> double`, and accepts selected pointer spellings and scalar C types. It enforces at most 8 GP and 8 FP register arguments, rejects structures and variadics, and only accepts symbolic `sdk:...` targets.

**No native call is made.** The source mapping does not prove that a specific console image supports any target address or that `ldr:ro`, service IPC or IZ2S startup is available. Avoid directly invoking LuaJIT cdata function pointers on this title; upstream documents a fatal interpreter bug. The backend continues to report `ready:false`.

```powershell
node --test test/balatro-ffi-contract.test.cjs test/balatro-backend.test.cjs
```

### Upstream native bridge byte verification (2026-11-18)

The Balatro backend now exposes `inspectNativeBridge(host)` using `native-bridge-check.cjs`. It calls only the **upstream preflight** `love.ffi.native_ready()` and the pure `bl.ffi_call.compile({ret="double",args={"double","double"}})` signature planner. Upstream `native_ready` inspects the native bridge's known SDK instruction bytes before allowing a future native transfer. On an unknown binary image or missing compiler, it produces a blocked result. This differs materially from simply checking whether `declare` and `invoke` exist.

```powershell
node --test test/balatro-native-bridge-check.test.cjs test/balatro-backend.test.cjs
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/native-bridge-check.cjs 192.168.1.232
```

The response reports `state` (unavailable/error/blocked/verified), `abi` (unavailable/rejected/accepted), `bridgeCodeBytesVerified` and `signatureCompilerAccepted`. No SDK function is called; `nativeOperationExecuted=false`, `nativeCoreReady=false` and `ready=false` by design. A verified bridge is **not** evidence that privileged services, Horizon IPC, executable allocation or the IZ2S NRO loader are available. Never substitute this report for the startup acquisition and session checks.

Upstream reference: https://github.com/Luminger/balatro-switch-rce/blob/main/src/bl/ffi_call.lua (the `preflight` function). Unknown images must remain blocked; the upstream project warns about fatal LuaJIT cdata-call defects.

### Guarded SDK declaration proof (2026-11-18)

The experimental backend also exposes `inspectNativeDeclaration(host)`, implemented by `native-declare-check.cjs`. This **does call `love.ffi.declare`** only to construct a Lua closure for the known-image `socket(int,int,int)` SDK export identified by Balatro's own `app.info.off.socket`. It calls `love.ffi.native_ready()` **first** and refuses unknown image profiles and missing offsets. It describes the resulting closure and discards it. **It never invokes the declared function or opens a socket**. This verifies declaration creation, not native function execution.

```powershell
node --test test/balatro-native-bridge-check.test.cjs test/balatro-native-declare-check.test.cjs test/balatro-backend.test.cjs
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/native-bridge-check.cjs 192.168.1.232
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/native-declare-check.cjs 192.168.1.232
```

If the bridge preflight is blocked or reports an error, **do not** run the declaration probe. An unknown binary or absent image offsets must fail closed. Successful closure construction does not imply the application possesses the privilege to open restricted services, allocate executable memory or start the original IZ2S NRO.

### One-command guarded native bridge staging (2026-11-18)

`native-stage.cjs` now orchestrates **two real Balatro RPC checks** in order: first the upstream code-byte verification and pure ABI compiler, then (only on success) construction and description of a Lua closure for a known SDK `socket(int,int,int)` symbol. **No declared function is called**.

```powershell
node --test test/balatro-native-bridge-check.test.cjs test/balatro-native-declare-check.test.cjs test/balatro-native-stage.test.cjs test/balatro-backend.test.cjs
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/native-stage.cjs 192.168.1.232
```

Expected `phase: "declared-only"` indicates the source-backed native bridge has passed the title's byte preflight and built a Lua closure. `phase: "blocked"` is an intentional refusal on unknown binary versions, unavailable ABI compiler or failed declaration. In either case, this **does not launch native IZ2S**; the service access, memory contract and privileged core-start prerequisites remain unverified. This stage never calls a native function or launches an NRO.

### Real, limited Balatro SDK call + self-owned FFI buffer (2026-11-18)

The backend now includes two real RPC experiments:

- `native-call-smoke.cjs` checks the upstream byte preflight, declares the **fixed** SDK socket error getter (no parameters) using the title's own `info.off.sock_error`, and invokes it once. The upstream launcher already calls this getter in `src/bl/socket.lua`. No user-supplied function address, memory pointer, service handle or arbitrary signature is accepted. A failed/ambiguous response is never retried automatically.
- `owned-memory-smoke.cjs` writes, checks and clears exactly 16 bytes of an FFI `uint8_t[16]` array owned by that Lua RPC chunk. It does not inspect other process mappings or provide arbitrary memory access.

`native-validation.cjs` runs a guarded sequence: verified bridge + declaration, owned buffer, then the fixed SDK getter. On any rejection, it stops; the response names the blocker. These checks exercise title-local capabilities only, **not** privileged acquisition, Horizon IPC or `ldr:ro`.

Run the relevant tests first:

```powershell
node --test test/balatro-native-bridge-check.test.cjs test/balatro-native-declare-check.test.cjs test/balatro-native-stage.test.cjs test/balatro-owned-memory-smoke.test.cjs test/balatro-native-call-smoke.test.cjs test/balatro-native-validation.test.cjs test/balatro-backend.test.cjs
```

With Balatro RPC already active on the known working image, execute the single guarded live validation:

```powershell
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/native-validation.cjs 192.168.1.232
```

`phase: limited-userland-verified` means the fixed getter and local buffer succeeded. Even then `ready:false`, `ipcVerified:false`, `nroLoaderVerified:false` and `nativeCoreReady:false` remain. If timeout, unexpected restart or hang occurs, do not blindly rerun the native call; inspect title health first.

### Native SDK memcpy on two self-owned FFI arrays (2026-11-18)

The fixed `switch2/balatro/native-memcpy-smoke.cjs` experiment uses the upstream `love.ffi.native_ready()` exact-image byte check, then declares the SDK's known `memcpy` export from `bl.app.info.off.memcpy` with `void (void *, const void *, size_t)`. It copies exactly **16 bytes** between two `ffi.new("uint8_t[16]")` arrays owned by the current Lua RPC chunk, verifies their expected contents (checksum `2040`), and zeros both arrays. It accepts no user-supplied pointer, address, signature, service handle or buffer size. On unrecognized code bytes, missing SDK offsets or any mismatch it fails closed.

The Balatro backend exposes this experiment through `inspectNativeMemcpy(host)`. Even success proves only a fixed SDK copy between two owned arrays: **not** arbitrary process memory access, executable mappings, Horizon IPC, `ldr:ro`, privileged acquisition, or an IZ2S NRO launch.

```powershell
cd C:\NintendoSwitch\balatro\IZ2S-Platform-Balatro
git pull
node --test test/balatro-native-memcpy-smoke.test.cjs test/balatro-backend.test.cjs
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/native-memcpy-smoke.cjs 192.168.1.232
```

The expected live response is `state: "verified"`, `copyVerified: true`, `clearVerified: true`, and `ready: false`. This is a native function call on the console, unlike offline contract tests. If the title hangs or the RPC times out, stop and inspect its health instead of repeating the call automatically. The existing `native-validation.cjs` still tests the original getter and local buffer independently.

### Scoped LuaJIT-owned buffer lifecycle (2026-11-18)

`switch2/balatro/owned-lifecycle.cjs` probes a bounded **64-byte** memory lifecycle within one Balatro RPC chunk: allocate two `ffi.new("uint8_t[64]")` arrays, fill with known bytes, copy with `ffi.copy`, verify both arrays, zero both with `ffi.fill`, and let the local references leave scope. It does **not** request native SDK heap allocation, `free`, arbitrary address reads/writes, service IPC or executable memory. Releasing local references is not proof that a native heap allocation has been freed, and the report explicitly sets `nativeHeapFreeVerified:false`.

The `createBalatroBackend()` instance now exposes `inspectOwnedLifecycle(host)`, alongside the previously verified bounded `inspectNativeMemcpy(host)`. The existing `read/write/query/store64/batch` methods continue to reject with `BALATRO_NATIVE_UNAVAILABLE`.

Run from the Windows checkout while Balatro's RPC is available:

```powershell
cd C:\NintendoSwitch\balatro\IZ2S-Platform-Balatro
git pull
node --test test/balatro-owned-lifecycle.test.cjs test/balatro-backend.test.cjs
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/owned-lifecycle.cjs 192.168.1.232
```

Expected `state:"verified"` means this Lua-owned buffer lifecycle succeeded; `ready:false` and `nativeTransportReady:false` remain. The next genuine IZ2S transport gap is not ordinary Lua arrays, but the original session's controlled resource ownership plus mapping verification and IPC/loader prerequisites. Never treat this test as native NRO readiness.

### One-command bounded owned-memory handle and SDK memcpy suite (2026-11-18)

The Balatro backend now includes `owned-handles.cjs`, a bounded title-local Lua FFI handle registry exercised entirely within **one RPC request**. Each handle is a monotonically increasing integer, not a raw memory pointer. The test allocates two 32-byte arrays, writes and reads a predictable pattern, copies data between them, verifies the contents, rejects reads/writes beyond bounds, refuses copies within the same buffer, rejects stale and double-released handles, creates a replacement handle without recycling the old ID, and zeroes arrays on release.

The handle registry is **local to that one diagnostic RPC chunk**; handles cannot be reused between RPC calls. `release` zeroes bytes and drops Lua references, which does not establish an explicit native heap `free()` call. This does not expose the unrestricted `read/write/query/store64` operations required by the original IZ2S native transport.

For fewer separate tests, `memory-suite.cjs` now chains the previously verified 64-byte owned lifecycle, scoped handle guard tests and actual SDK `memcpy` between two self-owned 16-byte arrays. Each stage fails closed and prevents later probes on failure. The Balatro backend exposes `inspectOwnedHandles(host)` and `verifyMemorySuite(host)`. Both report `ready:false`, regardless of success.

```powershell
cd C:\NintendoSwitch\balatro\IZ2S-Platform-Balatro
git pull
node --test test/balatro-owned-handles.test.cjs test/balatro-memory-suite.test.cjs test/balatro-backend.test.cjs
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/memory-suite.cjs 192.168.1.232
```

Expected completion is `phase:"scoped-memory-verified"`, while `nativeTransportReady:false`, `ipcVerified:false`, `nroLoaderVerified:false`, and `nativeCoreReady:false` remain. This suite verifies owned, bounded buffers only. In case of an RPC timeout, title crash, or unexpected response, stop rather than blindly rerunning calls.

### Persistent bounded buffers across Balatro RPC connections (2026-11-18)

`switch2/balatro/owned-registry.lua` is a LuaJIT-FFI buffer registry held in the title's `_G.__IZ2S_OWNED_REGISTRY_V1` state across separate TCP RPC requests. The exposed protocol takes only **opaque integer handle IDs, bounded offsets and byte values**, never raw addresses or arbitrary memory access. The registry allows at most four live buffers, each 1–128 bytes, and at most 512 bytes total. Handle IDs increase monotonically within the registry, and released IDs are never recycled. `release` zeroes the buffer and drops the Lua reference; `clear` zeroes all owned buffers and removes the registry. **Neither operation establishes native heap deallocation**.

The `owned-registry.cjs` client supports `init`, `status`, `alloc`, `write`, `read`, `copy`, `release` and `clear`; reads/writes/copies are bounds checked and copies within the same buffer are refused. The test suite `persistent-memory-suite.cjs` exercises all these operations across separate RPC connections, including stale-handle rejection, out-of-range accesses, double release, non-recycled IDs, explicit rejection of a 129-byte allocation and a fifth live handle, and cleanup. A failed `init` (for example, an already initialized registry) **does not clear someone else's registry**. Following a successful `init`, test cleanup is best-effort on error; an RPC timeout must be investigated before retrying.

```powershell
cd C:\NintendoSwitch\balatro\IZ2S-Platform-Balatro
git pull
node --test test/balatro-owned-registry.test.cjs test/balatro-persistent-memory-suite.test.cjs test/balatro-backend.test.cjs
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/persistent-memory-suite.cjs 192.168.1.232
```

Expected successful phase: `"verified"` with `persistentAcrossRpcConnections:true`, `boundsVerified:true`, `registryCleared:true`. This confirms **title-local allocated data persistence** only: no native transport support is unlocked by these tests. `nativeTransportReady:false`, `ipcVerified:false`, `nativeCoreReady:false` remain. Existing IZ2S `read/write/query/store64` and loader methods remain blocked with `BALATRO_NATIVE_UNAVAILABLE`. This is not a native NRO launcher.

### Fix: persistent registry quota error on live Balatro (2026-11-18)

A real Switch 2 test reported `Registry expectation failed: alloc expected blocked/quota` even though the offline suite passed. Root cause: the registry attempted to use `(quota|stale_handle|...)` as a **Lua pattern**, but Lua patterns do not have regex-style `|` alternatives. Thus a correct quota rejection was reported generically as `operation_failed` instead of `quota`.

The Lua registry now recognizes a finite allowlist of error labels from the suffix of a Lua error message, accounting for an optional `chunk:line:` prefix. The PC suite also includes the **actual** reported response in assertion failures and tests that the Lua error classifier does not regress. No memory limits or native permissions were changed.

```powershell
git pull
node --test test/balatro-owned-registry.test.cjs test/balatro-persistent-memory-suite.test.cjs test/balatro-backend.test.cjs
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/persistent-memory-suite.cjs 192.168.1.232
```

If `init` reports `already_initialized`, **do not clear the registry blindly**; determine ownership first. The integrated test clears only the registry after its own successful initialization. If an RPC hangs or the title restarts, investigate rather than retrying automatically. Until the live suite confirms, `persistentAcrossRpcConnections` must not be treated as verified on this console.

### Follow-up fix: default `status` template (2026-11-18)

A live attempt returned `Invalid Lua registry script` after the quota parser fix. This was caused by the Node template builder rejecting an **unchanged** script. `status` with zero arguments legitimately uses the default `owned-registry.lua` source, so the client now validates that the five expected substitution anchors are present, permits unchanged `status`, and still enforces the 8192-byte request limit. Regression coverage verifies `script('status', []) === TEMPLATE`.

The line `No raw address ingress or egress` visible on the Switch 2 is a **source-code comment** in `owned-registry.lua`, not a console error code. If code or logs appear on screen, that alone does not establish a new memory capability.

```powershell
git pull
node --test test/balatro-owned-registry.test.cjs test/balatro-persistent-memory-suite.test.cjs test/balatro-backend.test.cjs
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/persistent-memory-suite.cjs 192.168.1.232
```

The suite's `clear` is restricted to the registry it successfully initialized; if the command returns `already_initialized`, do not blindly delete state.

### Verified persistent Lua handles vs. original IZ2S native-session requirements (2026-11-18)

On the owner's Switch 2, `persistent-memory-suite.cjs` completed with `phase:"verified"`, **39 checks**, five handle allocations, quota/bounds/stale-handle checks, cross-RPC persistence and `registryCleared:true`. This closes the **title-local persistent buffer** question, but does **not** establish native process-memory transport.

We inspected the original implementation paths `switch2/app/session.cjs`, `switch2/app/rpc.cjs`, `switch2/ro/nro.cjs`, and `switch2/ro/start-core.cjs`. The newly added static `readiness-gap.cjs` and its tests document these distinct requirements:

1. Live original native session and `status.ready` for platform 2.
2. Code-byte and executable-map validation for native `allocate`, `free`, `getService`, `send`, `close`, `memset`.
3. Validated writable scratch memory; mapped/aligned native allocation; original saved-slot restoration.
4. Address-based `read/write/query`, genuine mapping checks, and native free.
5. Owned service handles, Horizon IPC transport, and well-formed replies.
6. `ldr:ro` NRO mapping with RX/R/RW segment validation and subsequent unmapping.
7. The native core's retained FS acquisition, `pm:shell` / `pm:dmnt` sessions, notifier proof, loader handle export and bootstrap synchronization.

None of these prerequisites is implied by local Lua buffers or the verified Balatro `sock_error`/`memcpy` calls. The `createBalatroBackend().assessNativeReadiness()` helper returns a source-backed **offline**, fail-closed status summary. It does not call the console and is not an alternate loader. The native `read/write/query/store64/batch/openService/ipc/loadNro/startCore` backend operations deliberately remain `BALATRO_NATIVE_UNAVAILABLE`.

```powershell
cd C:\NintendoSwitch\balatro\IZ2S-Platform-Balatro
git pull
node --test test/balatro-readiness-gap.test.cjs test/balatro-backend.test.cjs
node -e "const {createBalatroBackend}=require('./engines/iz2s-core/runtime/installer/engine/switch2/balatro/backend.cjs'); console.log(JSON.stringify(createBalatroBackend().assessNativeReadiness(),null,2))"
```

This matrix is the grouped **next-stage checkpoint**: it prevents repeating the already-proven owned-memory experiments and defines the actual gaps before any claim of original NRO boot readiness.

### IZ2S launcher frontend within Balatro: grouped visual integration (2026-11-18)

A new **independent** title-local frontend `switch2/balatro/launcher-menu.lua` now draws the **IZ2S Platform / Balatro** overlay using the existing `bl.console.draw` hook. It does not replace the earlier, independently testable `app-menu.lua`. The launcher uses the controller's D-pad/A/B (and keyboard up/down/Enter/Escape) for six entries: Dashboard, Balatro RPC, Memory Status, Native Status, About, and Exit. Five informational pages show verified title-local capabilities and label unsupported process memory, privileged IPC and core launch as unavailable. No NRO is executed; the interface never claims native-core readiness.

`launcher-menu.cjs` offers the fixed `start|status|up|down|select|back|stop` RPC contract. `launcher-integration.cjs` is **one end-to-end test**: only if the frontend is initially idle, start it, verify overlay and input hooks, visit and return from each of the five information pages, verify both wrap-around directions, exit, and verify cleanup. If an unexpected response occurs, it attempts best-effort cleanup of the frontend it started; it refuses to take over an existing one. `createBalatroBackend()` exposes `launcher(host,op)` and `verifyLauncher(host)`. The original Balatro entry and native loader remain isolated.

```powershell
cd C:\NintendoSwitch\balatro\IZ2S-Platform-Balatro
git pull
node --test test/balatro-launcher-menu.test.cjs test/balatro-launcher-integration.test.cjs test/balatro-backend.test.cjs
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/launcher-integration.cjs 192.168.1.232
```

Expected: `phase:"verified"`, all five `pagesVerified`, `menuWrapVerified:true` and `cleanupVerified:true`, while `nativeCoreLaunched:false` and `ready:false`. To **leave the visual frontend visible** instead of running the auto-cleanup suite, use:

```powershell
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/launcher-menu.cjs 192.168.1.232 start
# Navigate with D-pad, A, B on Switch 2.
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/launcher-menu.cjs 192.168.1.232 status
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/launcher-menu.cjs 192.168.1.232 stop
```

The integration test **stops** the frontend on successful completion, so a blank overlay afterwards is expected. Do not run the integration suite while a manually started frontend is active; it will refuse to take ownership. This is an IZ2S-compatible **frontend presentation** on the Balatro Lua side, not the actual original IZ2S native process or privileged launcher.

### Launcher consolidation: dynamic dashboard + frontend ownership + grouped integration (2026-11-18)

The six-entry Balatro IZ2S frontend now shows **live title-local values**, rather than presenting prior test results as current system status. The Dashboard, RPC, Memory and Native panels read the live Lua `_G.__IZ2S_OWNED_REGISTRY_V1` registry (active buffer count and owned byte count, where present), display LuaJIT FFI-interface presence, and explicitly distinguish the unavailable native memory/IPC/NRO transport. These numbers reflect the **currently active owned registry**, not previously completed smoke tests. No native call is needed to render a panel.

To avoid two UI wrappers competing for controller and draw hooks, **starting the new launcher refuses when the previous `__IZ2S_BALATRO_APP_V1` menu is active**, returning `phase:"blocked";page:"legacy"`. The RPC client treats that status as a real conflict; it does not forcibly stop the previous menu. `launcher-telemetry.cjs` is an additional **read-only** RPC probe that reports active/idle states for both menus, FFI interface presence, and live registry count/bytes (strictly bounded by four buffers and 512 bytes).

`launcher-suite.cjs` is the **one-command, fail-closed aggregate check**: inspect state before changes, refuse an existing frontend, exercise the existing complete five-page navigation test with cleanup, inspect state after cleanup, and attach the seven-stage source-backed native-readiness gap. Its result intentionally distinguishes `visualRenderingObserved:false` and `controllerEventsObserved:false`: synthetic RPC navigation and the presence of hooks do not themselves prove the actual physical display or controller events. Check these manually when leaving the launcher open.

```powershell
cd C:\NintendoSwitch\balatro\IZ2S-Platform-Balatro
git pull
node --test test/balatro-launcher-*.test.cjs test/balatro-backend.test.cjs
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/launcher-suite.cjs 192.168.1.232
```

If the grouped check completes with `phase:"verified"`, launch the frontend **without automatic cleanup** for visual review:

```powershell
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/launcher-menu.cjs 192.168.1.232 start
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/launcher-telemetry.cjs 192.168.1.232
```

Use D-pad, A, B; the current title-local values should change if its registry is in use. Stop with `launcher-menu.cjs ... stop` once finished. Do not start both UI frontends simultaneously; the new one refuses a legacy session rather than stealing its hooks. No `read/write/query/ipc/loadNro/startCore` transport is implemented by this batch.

### Physical UI confirmation and live event counters (2026-11-18)

The owner confirmed that the Balatro IZ2S frontend **is visible on the Switch 2 display and responds to the physical controller**. This external observation establishes functional visual/gamepad use, beyond the previous synthetic RPC menu navigation. Do not confuse that user-observed fact with `launcher-suite.cjs`'s `visualRenderingObserved:false` / `controllerEventsObserved:false`: those fields only describe what that **automated suite** independently measured.

The launcher now tracks `drawFrames` (successfully rendered overlay callbacks), `drawErrors` (failed guarded drawing), `gamepadEvents` (recognized actual LOVE gamepad inputs) and `keyboardEvents` in its title-local state. The new fixed **read-only** `launcher-activity.cjs` reports these counters without synthesizing an input, changing the selection or claiming native readiness. The backend also exposes `inspectLauncherActivity(host)`. Counts reset when a new launcher session is started and are available only while the frontend is running. This does not diagnose native NRO boot.

One batch to test and observe physical events:

```powershell
cd C:\NintendoSwitch\balatro\IZ2S-Platform-Balatro
git pull
node --test test/balatro-launcher-*.test.cjs test/balatro-backend.test.cjs
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/launcher-menu.cjs 192.168.1.232 start
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/launcher-activity.cjs 192.168.1.232
# Press D-pad, A and B on the console, then read counters:
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/launcher-activity.cjs 192.168.1.232
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/launcher-menu.cjs 192.168.1.232 stop
```

A running frontend with increasing `renderedFrames`, increasing `physicalGamepadEvents` and zero `drawErrors` gives independent in-title evidence. If counters remain zero despite working visuals, inspect the actual draw/gamepad dispatch route rather than asserting success. Never run the auto-cleanup integration suite while the manually started menu is active. For all tests, `nativeCoreReady:false` remains unchanged.

### Canonical console menu requirement — shared by all entry methods (2026-11-19)

**Design correction:** The product goal is to display and operate the **same original IZ2S console launcher/menu**, regardless of entry method: SmileBASIC, Civilization VII, or Balatro. The Balatro `launcher-menu.lua` overlay built during preliminary RPC/graphics/input work is a **diagnostic only**, not that original menu. It must not be expanded into a separately invented application library or represented as success for this goal.

Canonical implementation identified in the existing repository:

- `core/console/sd-launcher/native/launcher.c` — actual native SD library/menu supervisor and input/display loop.
- `core/console/sd-launcher/native/build/launcher.bin` and `manifest.json` — built image and layout for the canonical native supervisor.
- `core/console/sd-launcher/bootstrap.cjs` and `runtime.cjs` — native supervisor preparation and runtime, with graphics and filesystem prerequisites.
- `core/console/sd-launcher/mixed-menu.cjs` — arbitration between native menu and host display.
- `engines/CivSwitch/launcher/app/shaders/launcher-layout.glsl` and `app-menu.glsl` — menu layout/navigation resources for that entry environment.

**Architecture requirement:** adapt Balatro's entry into the established native console-launcher lifecycle and its shared assets/state, rather than implementing a lookalike in LOVE Lua. Existing verified Balatro RPC, input and overlay capabilities only confirm that the entry can communicate and render a diagnostic UI. They do not provide the mapped native code, original render context, filesystem access or service/IPC ownership expected by the canonical launcher.

Next engineering gate: inventory the canonical launcher startup prerequisites and test which interfaces Balatro can satisfy *without* relying on raw-pointer guesses or adopting a different UI. Keep the authentic-launcher milestone blocked until the canonical binary/renderer is the thing actually displayed. Do not interpret the diagnostic `launcher-integration.cjs` result as the canonical IZ2S menu having launched.

### Authentic IZ2S native launcher audit — no Balatro lookalike (2026-11-19)

This implementation now targets the **canonical** `core/console/sd-launcher/native/build/launcher.bin` shared by the established IZ2S console launcher. The prior `switch2/balatro/launcher-menu.lua` overlay remains strictly a **diagnostic**, never the intended end-user menu.

The new `switch2/balatro/native-launch-gate.cjs` performs one **offline** source-backed audit: it checks the actual native image against `native/build/manifest.json` length and SHA-256; checks every hash recorded under `manifest.sources` against the repository's canonical native source files; and verifies the entry-related source files still contain the expected bootstrap/runtime/mixed-menu control points. This is not a loader, binary patcher, injection interface or GPU substitute. A passing artifact hash attests source/image consistency, **not** a live native supervisor or graphics session.

The original launcher initialization relies on `core/console/sd-launcher/bootstrap.cjs` (retained FS endpoint, session, native code mapping, graphics preparation and supervisor threading) and `core/console/sd-launcher/runtime.cjs`; `native/launcher.c` is the original menu implementation. The current Balatro backend has demonstrated title-local Lua and FFI calls, owned-memory persistence and live controller/rendering for the diagnostic UI. It has **not** demonstrated the addressable memory, service IPC, mapped executable and filesystem/graphics owner contracts needed by the canonical launcher. `canonicalMenuReady`, `nativeTransportReady`, `filesystemSessionReady`, and `originalGraphicsReady` therefore remain `false`.

One grouped offline command:

```powershell
cd C:\NintendoSwitch\balatro\IZ2S-Platform-Balatro
git pull
node --test test/balatro-native-launch-gate.test.cjs test/balatro-readiness-gap.test.cjs test/balatro-backend.test.cjs
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/native-launch-gate.cjs
```

This check does **not** require an active Switch 2 RPC connection and intentionally does not start the Lua diagnostic menu. It reports `phase:"artifacts-verified"` only when the original native launcher binary and source manifest match, while keeping `canonicalMenuReady:false`. Report any hash or source integrity failure as a blocker; do not bypass mismatches. Do not claim the actual IZ2S menu is running until the canonical code (not the Balatro diagnostic overlay) renders on the console.

### Canonical launcher fixture correction (2026-11-19)

The console owner's grouped verification found 10/12 local tests passing, with the two failures both using the simulated canonical launcher. The **real** offline audit succeeded: `phase:"artifacts-verified"`, 44 checked files, 43 manifest sources, zero hash failures, and no missing startup markers. The native `launcher.bin` and its manifest are not the cause of those two test failures.

The fixture previously hashed the placeholder string `source` for `native/launcher.c` and then **overwrote that same mocked path** with the expected source markers. The audit correctly rejected the resulting hash mismatch. The fixture now hashes the same marker source bytes it returns to the verifier and includes positive and negative integrity regressions. No native binary, service, memory or graphics path was changed.

```powershell
cd C:\NintendoSwitch\balatro\IZ2S-Platform-Balatro
git pull
node --test test/balatro-native-launch-gate.test.cjs test/balatro-readiness-gap.test.cjs test/balatro-backend.test.cjs
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/native-launch-gate.cjs
```

This remains an **offline artifact gate**. Even if all tests pass, `canonicalMenuReady:false` is correct until the native IZ2S launcher itself runs from the Balatro entry environment.

### Shared original-launcher entry contract (2026-11-19)

**Target:** exactly the same original `core/console/sd-launcher/native/build/launcher.bin` and `core/console/sd-launcher/bootstrap.cjs` from SmileBASIC, Balatro and Civilization. The existing Balatro graphical overlay remains a diagnostic, not the IZ2S console menu.

`core/console/sd-launcher/entry-contract.cjs` now defines the seven ownership prerequisites needed by the original native launcher: native address-aware RPC, validated mapped session, retained filesystem, original Vulkan renderer, verified SDK/HID/Vulkan functions, authorized RO code mapping, and a managed native thread lifecycle. The first implementation is an **evidence-only guard**; it does not and cannot certify a live launch merely because a caller reports `true`. The concrete resource ownership checks must be performed by the canonical bootstrap.

`switch2/balatro/canonical-entry.cjs` points to that shared contract. Its `inspect` command reports the same native artifact and known Balatro Lua capabilities without ever conflating them with native readiness. Its `launch` command deliberately returns `IZ2S_NATIVE_ENTRY_NOT_READY` **before any native operation** while the prerequisite evidence remains absent. Do not substitute a Lua-generated menu or skip the guard.

```powershell
cd C:\NintendoSwitch\balatro\IZ2S-Platform-Balatro
git pull
node --test test/balatro-canonical-entry.test.cjs test/balatro-native-launch-gate.test.cjs test/balatro-readiness-gap.test.cjs test/balatro-backend.test.cjs
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/canonical-entry.cjs inspect
```

This batch implements a shared startup **boundary**, not a working native Balatro loader. The real native launch will only be considered achieved when the original supervisor is executing and its native menu is visible on the console.

### Live Balatro ↔ canonical IZ2S bootstrap comparison (2026-11-19)

**No substitute UI is created or launched.** The original `core/console/sd-launcher/bootstrap.cjs` is still the target. The new `switch2/balatro/canonical-preflight.cjs` performs exactly one **read-only** RPC to inspect the actual Balatro title interfaces: presence of the `love.ffi` bridge and function entry points, SDK metadata, input handler and LOVE graphics. It invokes no FFI function, arbitrary pointer, native service or loader operation.

The new `canonical-live-comparison.cjs` combines that *live title observation* with the offline, SHA-checked authentic launcher artifact and compares them with the **seven native ownership requirements** of `bootstrap.cjs` and `runtime.cjs`. It distinguishes title-local graphics/input from the **original native Vulkan renderer**; seeing a LOVE graphics interface is not evidence of native display ownership. It likewise distinguishes a Lua SDK getter from arbitrary addressable native RPC. No privilege or readiness flag can be promoted based solely on a title-local interface.

```powershell
cd C:\NintendoSwitch\balatro\IZ2S-Platform-Balatro
git pull
node --test test/balatro-canonical-live-comparison.test.cjs test/balatro-canonical-entry.test.cjs test/balatro-native-launch-gate.test.cjs test/balatro-readiness-gap.test.cjs test/balatro-backend.test.cjs
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/canonical-live-comparison.cjs 192.168.1.232
```

Run with the **existing Balatro RPC server** active on TCP 9026. This does not start/stop an overlay or change its state. A current expected outcome is `phase:"entry-observed-native-blocked"`, `firstBlockingStage:"native-rpc"`, seven `missingNativePrerequisites` and `canonicalMenuReady:false`. The original launcher binary itself is not executed by this diagnostic. A successful bootstrap requires concrete resource-ownership verification from the canonical path, not simply changing the reported flags.

### Real Balatro Lua RPC boundary, without spoofing original native RPC (2026-11-19)

`switch2/balatro/native-rpc-boundary.cjs` is the first concrete entry adapter for the canonical launcher integration. Its `status()` performs exactly one bounded, **read-only Lua RPC** to inspect presence of Balatro's FFI-ready function and SDK-base metadata. All address-based native operations required by the original `switch2/app/rpc.cjs` (including `read`, `write`, `query`, `call`, `verifyFunction`, and native service/IPC/loader operations) reject **locally before sending a request** with `IZ2S_NATIVE_TRANSPORT_UNAVAILABLE`.

The canonical entry now provides `live <switch-ip>` using that real transport boundary alongside the existing offline image integrity check. This avoids treating title-local Lua access, the observed socket getter, or the 16-byte owned-FFI smoke test as a substitute for arbitrary address-aware native RPC. No executable memory allocation, privileged IPC, code mapping, supervisor thread or original display ownership is attempted. The diagnostic Balatro menu is not involved.

```powershell
cd C:\NintendoSwitch\balatro\IZ2S-Platform-Balatro
git pull
node --test test/balatro-native-rpc-boundary.test.cjs test/balatro-canonical-live-comparison.test.cjs test/balatro-canonical-entry.test.cjs test/balatro-native-launch-gate.test.cjs test/balatro-readiness-gap.test.cjs test/balatro-backend.test.cjs
node engines/iz2s-core/runtime/installer/engine/switch2/balatro/canonical-entry.cjs live 192.168.1.232
```

The live command requires an active Balatro RPC connection on TCP 9026 and **does not** start the original IZ2S menu. Passing checks establish the behavior and limits of the real Balatro entry adapter; native launcher readiness remains blocked until an authorized native transport can satisfy the original bootstrap contract with verified ownership.
