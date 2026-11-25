# stop-tumpuk — Native migration checklist

**Version:** 3.0

**Status:** Native scaffold compatibility and source audit are verified; persistence and application tasks remain open. The root manifest/routes are prepared, but the root lockfile and installed dependency tree remain pending.

**Product authority:** [PRD.md](PRD.md)

**Architecture:** [SYSTEM_DESIGN.md](SYSTEM_DESIGN.md)

**Toolchain:** [TECH_STACK.md](TECH_STACK.md)

## How to use this checklist

Every task has a stable ID, PRD references, dependencies, a concrete deliverable, a verification method, and a completion condition. Check a task only when its implementation exists and its stated verification has passed. A historical web test, a browser simulation, or a document update never completes a native task. Keep failed or unrun checks open and record the limitation beside the task or in the release record.

Use a temporary directory for the initial Expo scaffold. Merge it deliberately after checking that the root documents and copied `src/` have not been overwritten. Keep `reference/web/` unchanged and outside native compilation, test discovery, runtime imports, and formatting.

The working sequencing assumption is Android first for implementation and validation, followed by iOS-specific gates. This affects order only; the product target remains Android and iOS.

## Milestone 0 — Foundation and feasibility

### NATIVE-001 — Resolve the native toolchain target

- [x] **FR references:** FR-15; [TECH_STACK.md](TECH_STACK.md).
- **Dependencies:** None.
- **Deliverable:** An Expo SDK 58 scaffold using pnpm, strict TypeScript, Expo Router, PanelUI Native with Uniwind and Tailwind CSS 4, `expo-sqlite`, `react-native-webview`, and `expo-sharing`; a root package/lockfile plan; documented Node and Android-first development-build requirements.
- **Verification:** Run Expo's dependency resolver and `expo-doctor`; inspect the resolved PanelUI/Uniwind peer versions, Metro/CSS entry, and root provider; compare them with official Expo and PanelUI compatibility references.
- **Complete when:** The chosen versions are mutually compatible, the resolved versions and PanelUI integration are recorded, and no NativeWind, Dexie, Vite, service-worker, or Headless UI dependency is part of the native target.

### NATIVE-002 — Run the early WebView feasibility check

- [ ] **FR references:** FR-08, FR-15.
- **Dependencies:** NATIVE-001.
- **Deliverable:** A small development-build reader probe against representative intended sources: a public article, a Medium/Substack-style article, a public YouTube video, and a login/paywall or blocked-embed example. Record navigation, loading, error, video/media, login, external-scheme, and external-browser fallback behavior on Android.
- **Verification:** Android emulator check followed by at least one Android physical-device check with network access. Capture source URLs and observed behavior without logging private content.
- **Complete when:** The team has a written allow/fallback matrix and confirms that the proposed WebView boundary is viable before building all reading screens. Unsupported sites are documented rather than promised.

**Implementation note (probe ready; validation open):** The development-build probe is available at
`/webview-probe`. It uses the pure policy in `src/application/webview-policy.ts`, records loading,
progress, redirects, media/access observations, errors, blocked schemes, external-scheme hand-offs,
and browser fallback in `src/features/reading/webview-feasibility.ts`. The source matrix and expected
observations are recorded in [SYSTEM_DESIGN.md](SYSTEM_DESIGN.md). Android emulator and Android
physical-device checks remain open; this task is intentionally not checked off until those checks
produce an evidence record.

### NATIVE-003 — Audit reusable logic and native assumptions

- [x] **FR references:** FR-03, FR-04, FR-07, FR-13, FR-15.
- **Dependencies:** NATIVE-001.
- **Deliverable:** A source audit mapping copied `src/` and historical web modules to reuse, adaptation, or rewrite. Cover UUID generation, URL parsing/normalization, fetch timeouts, subscriptions, file APIs, browser globals, timer intervals, Dexie imports, and service-worker assumptions.
- **Verification:** Review imports with `rg`, add or update an architecture note in [SYSTEM_DESIGN.md](SYSTEM_DESIGN.md), and ensure `reference/web/` remains untouched.
- **Complete when:** Every native runtime assumption has an adapter or replacement owner and pure domain/transfer code is clearly separated from platform code.

## Milestone 1 — Domain, SQLite persistence, and transfer foundation

### NATIVE-010 — Establish native domain and runtime validation boundaries

- [x] **FR references:** FR-03, FR-04, FR-05, FR-06, FR-07, FR-10, FR-13.
- **Dependencies:** NATIVE-003.
- **Deliverable:** Native source layout, strict types, runtime validators, and preserved pure functions for estimates, capacity, recommendations, URL handling, lifecycle, notes, and availability reminders.
- **Verification:** Focused and full root Vitest runs pass without React Native, Expo modules, SQLite, Dexie, or browser globals in the pure domain/validation modules; root dependency installation and lockfile are committed.
- **Complete when:** Domain tests pass without importing React Native, Expo modules, SQLite, Dexie, or browser globals.

### NATIVE-011 — Create SQLite schema and repository interfaces

- [x] **FR references:** FR-05, FR-09, FR-10, FR-13, FR-14.
- **Dependencies:** NATIVE-010.
- **Deliverable:** `expo-sqlite` connection boundary, initial native schema for materials, notes, settings, sessions, events, staged intake, and migration bookkeeping; typed repositories and transactional lifecycle commands.
- **Verification:** Automated repository tests create a fresh database, insert/read/update/delete records, enforce note foreign keys, persist timer state, and verify transaction rollback.
- **Complete when:** UI/application code can use repositories without SQL imports, and reopening the same database retains records without reset behavior.

### NATIVE-012 — Separate backup validation from storage

- [x] **FR references:** FR-13.
- **Dependencies:** NATIVE-010, NATIVE-011.
- **Deliverable:** Runtime-independent current-format web-backup parser, serializer, record validators, ID/reference checks, conflict preview model, and native transfer service that calls repositories. Remove any direct Dexie dependency from reusable transfer code.
- **Verification:** Automated tests cover malformed JSON, unsupported/future versions, invalid URLs/statuses/numbers/references, stable IDs, multiple notes, conflict counts, and no-write-on-validation-failure.
- **Complete when:** Transfer tests pass and the native transfer layer can be exercised with repository fakes and SQLite without importing `reference/web/` code.

### NATIVE-013 — Implement additive, atomic web-backup import/export

- [x] **FR references:** FR-10, FR-13, FR-14.
- **Dependencies:** NATIVE-012.
- **Deliverable:** Current web export envelope import into SQLite, preserving material/note IDs, associations, estimates, settings, sessions, and history; native export that omits disposable share intake and credentials.
- **Verification:** Automated round-trip, conflict-preview, duplicate-ID, interrupted-transaction, and unsupported-format tests. Confirm old browser IndexedDB is not accessed directly.
- **Complete when:** A valid backup imports additively and atomically, conflicts are visible, existing records are never overwritten or cleared, and every invalid/unsupported input leaves the database unchanged.

### NATIVE-014 — Verify migration and recovery policy

- [x] **FR references:** FR-13.
- **Dependencies:** NATIVE-011, NATIVE-013.
- **Deliverable:** Versioned migration runner, supported-schema policy, upgrade failure/recovery path, and fixture set for zero/unknown estimates, multiple notes, timer state, and event associations.
- **Verification:** Automated upgrades from each supported released schema, skipped-version upgrade, forced failure rollback, repeat-open persistence, and backup-before-risky-change checks.
- **Complete when:** No migration path deletes/recreates the database or silently switches to an empty store, and the first native schema baseline is recorded for future releases.

## Milestone 2 — Capture and destination-aware save

### NATIVE-020 — Port capture application services

- [ ] **FR references:** FR-02, FR-03, FR-04, FR-05, FR-13.
- **Dependencies:** NATIVE-011, NATIVE-012.
- **Deliverable:** Native capture service with HTTP(S) validation, conservative normalization, inferred title fallback, duplicate detection/retry, typed destination, save-first behavior, and bounded optional enrichment.
- **Verification:** Automated application tests with mocked metadata responses, provider timeout/offline/error cases, duplicate retry, manual-title/estimate preservation, and storage failure.
- **Complete when:** Capture succeeds without metadata, duration, availability, or installation and the selected destination/history is correct after reload.

### NATIVE-021 — Build the native capture form

- [ ] **FR references:** FR-02, FR-05, FR-12.
- **Dependencies:** NATIVE-020.
- **Deliverable:** Expo Router capture screen with URL/text input, visible Reading plan/Inbox choice defaulted per new capture, duplicate confirmation, validation/error states, and accessible touch targets.
- **Verification:** Automated/component checks for destination reset between captures, keyboard submission, duplicate retry, error preservation, and mobile layout on an Android emulator.
- **Complete when:** Paste-to-save works through the real SQLite repository and success copy accurately distinguishes committed Reading plan from Inbox.

### NATIVE-022 — Add optional metadata adapters

- [ ] **FR references:** FR-03, FR-04.
- **Dependencies:** NATIVE-020.
- **Deliverable:** Native-safe provider adapters with typed output, timeout/cancellation, provenance/completeness mapping, and retryable failures. No extraction server is added.
- **Verification:** Automated provider-fake tests and Android network/offline checks showing capture remains durable when enrichment fails.
- **Complete when:** Provider output cannot overwrite a manual correction or changed/deleted material, and unknown duration remains unknown until usable data exists.

## Milestone 3 — Availability, plan, recommendation, and lifecycle UI

### NATIVE-030 — Implement availability and settings persistence

- [ ] **FR references:** FR-01, FR-06, FR-15.
- **Dependencies:** NATIVE-011, NATIVE-010.
- **Deliverable:** Onboarding/settings screens for weekday/weekend minutes, skip-and-remind behavior, zero/unset states, and local persistence.
- **Verification:** Automated reminder/domain/repository tests plus Android emulator restart and offline checks.
- **Complete when:** Settings survive restart, skip suppresses prompts for three months, and unset and zero are rendered as distinct states.

### NATIVE-031 — Implement capacity view

- [ ] **FR references:** FR-06, FR-12.
- **Dependencies:** NATIVE-030, NATIVE-020.
- **Deliverable:** PanelUI/Uniwind dashboard capacity message and accessible meter using the pure capacity view model, with unknown count, headroom, overflow, and plain-language projection.
- **Verification:** Automated view-model tests and Android emulator checks for empty, under, full, overflow, unknown, zero, and unset states, including reduced-motion behavior.
- **Complete when:** The dashboard never divides by zero, hides overflow, or presents the meter as completion progress.

### NATIVE-032 — Implement one next recommendation and manual selection

- [ ] **FR references:** FR-07.
- **Dependencies:** NATIVE-031, NATIVE-020.
- **Deliverable:** 5/15/30/custom minute input, one fitting recommendation, Choose another, truthful no-match state, optional longer partial item, and unknown-estimate handling.
- **Verification:** Automated deterministic-ranking tests and emulator interaction checks for fitting, ties, no-match, partial, and manual unknown selection.
- **Complete when:** At most one item is presented as fitting and selection uses the same estimate function as capacity and editing.

### NATIVE-033 — Implement material lifecycle and management

- [ ] **FR references:** FR-05, FR-09, FR-12.
- **Dependencies:** NATIVE-020, NATIVE-031, NATIVE-032.
- **Deliverable:** Inbox, Reading plan, In Progress, Finished, and Archived views with search/filter, edit, commit, return, reopen, archive, delete, and transactional event history.
- **Verification:** Automated repository/application tests plus emulator checks for each transition, failed writes, delete cascades, and accessible action grouping.
- **Complete when:** Lifecycle changes update capacity and Read next immediately after a durable save and archive is never counted as completion.

## Milestone 4 — WebView reading and external fallback

### NATIVE-040 — Build the reading route around WebView feasibility results

- [ ] **FR references:** FR-08, FR-09, FR-15.
- **Dependencies:** NATIVE-002, NATIVE-032, NATIVE-033.
- **Deliverable:** Native reading route using `react-native-webview`, title/estimate header, back navigation, loading/progress, error/retry, and source URL display aligned with the feasibility matrix.
- **Verification:** Android emulator and physical-device checks against the representative source matrix; automated screen-state tests where practical.
- **Complete when:** Supported pages open in-app, known incompatible cases show recoverable UI, and the selected material remains easy to return to.

### NATIVE-041 — Enforce WebView isolation and external navigation policy

- [ ] **FR references:** FR-08, FR-15.
- **Dependencies:** NATIVE-040.
- **Deliverable:** Narrow origin/navigation policy, non-HTTP(S) handling, external-browser fallback, no privileged bridge, and untrusted-content boundary documentation.
- **Verification:** Automated navigation-policy tests plus Android emulator/physical-device checks for redirects, blocked schemes, login/paywall failure, external-browser opening, and user cancellation.
- **Complete when:** Remote content cannot access SQLite or app commands, arbitrary schemes are handled deliberately, and the fallback works when WebView cannot load.

### NATIVE-042 — Connect explicit finish without inferred reading state

- [ ] **FR references:** FR-08, FR-09, FR-12.
- **Dependencies:** NATIVE-033, NATIVE-040.
- **Deliverable:** Contextual Open source/Finish actions, explicit completion transaction, return navigation, and post-finish refresh without takeaway prompt.
- **Verification:** Automated lifecycle tests and emulator flow from recommendation to open to finish, including failed completion retry and no timer requirement.
- **Complete when:** Opening, navigating, scrolling, playback, or WebView failure never marks completion, while Finish updates the plan immediately after a successful save.

## Milestone 5 — Notes, timer, settings/data UI

### NATIVE-050 — Port independent note management

- [ ] **FR references:** FR-10, FR-12.
- **Dependencies:** NATIVE-011, NATIVE-033.
- **Deliverable:** Plain-text note list/editor with New note prominent and compact per-note Edit/Delete actions, available from active and Finished items.
- **Verification:** Automated repository/application tests and emulator checks adding two notes, editing/deleting one, searching, reload, and access after finish.
- **Complete when:** Notes remain independent and all tested operations preserve sibling records and material associations.

### NATIVE-051 — Port the fixed focus timer with native lifecycle recovery

- [ ] **FR references:** FR-09, FR-12, FR-14.
- **Dependencies:** NATIVE-011, NATIVE-033, NATIVE-040.
- **Deliverable:** Start/pause/resume/end 25-minute timer controller, persisted timestamps/state, AppState subscription, foreground recalculation, and recovery UI.
- **Verification:** Automated timer/application tests plus Android emulator and physical-device background/foreground, process-relaunch, pause, resume, end, and expiry checks; repeat on iOS simulator/physical device later.
- **Complete when:** Timer state survives interruptions, cleanup is leak-free, expiry never completes a material, and active controls remain reachable.

### NATIVE-052 — Add native import/export screens

- [ ] **FR references:** FR-13, FR-14.
- **Dependencies:** NATIVE-013, NATIVE-033.
- **Deliverable:** Document picker/export UI using native file APIs, validation/error preservation, conflict preview, Cancel/Import actions, and clear local-only/cross-device guidance.
- **Verification:** Automated transfer tests plus Android emulator file round-trip and failure checks; iOS file-provider check during the iOS gate.
- **Complete when:** Users can select a current-format web backup, preview conflicts, import atomically, export a valid backup, and recover from rejected files without data loss.

## Milestone 6 — Native sharing

### NATIVE-060 — Implement Android URL/text receiving

- [ ] **FR references:** FR-02, FR-05, FR-15.
- **Dependencies:** NATIVE-021, NATIVE-013, NATIVE-001.
- **Deliverable:** `expo-sharing` Android configuration, intent payload adapter, Expo Router native-intent handler, staged intake repository, consumed-intake protection, and destination-aware capture handoff.
- **Verification:** Automated payload/parser/intake tests, Android emulator intent checks, and Android physical-device share-menu tests from representative source apps for URL, text, duplicate, relaunch, and malformed payloads.
- **Complete when:** A configured installed Android build receives supported URL/text shares into the normal form without auto-commit, and paste remains available when receiving is unavailable.

### NATIVE-061 — Design and implement iOS share extension path

- [ ] **FR references:** FR-02, FR-15.
- **Dependencies:** NATIVE-060, iOS decision from NATIVE-003.
- **Deliverable:** Approved iOS share-extension/App Group configuration or a documented supported fallback, with native-intent routing and staged intake behavior matching Android.
- **Verification:** iOS simulator configuration check and physical-device share from Safari/representative apps, including cold launch, duplicate, cancellation, and malformed payloads. Record OS/device/build versions.
- **Complete when:** The team can state exactly which iOS share payloads are supported and has evidence for the chosen path; unsupported cases are communicated with URL-paste fallback.

## Milestone 7 — Android-first release validation and iOS release gates

### NATIVE-070 — Run the automated native suite

- [x] **FR references:** All implemented FRs; [AGENTS.md](AGENTS.md).
- **Dependencies:** NATIVE-050, NATIVE-051, NATIVE-052, NATIVE-060.
- **Deliverable:** Root scripts, unit/repository/transfer/component tests, typecheck, lint, formatting check, and test fixtures for the complete capture-to-finish workflow.
- **Verification:** Run only actual root scripts and record command/output, package versions, and failures. Mock provider responses and keep live websites out of core test pass/fail.
- **Complete when:** The required automated commands pass and the record distinguishes automated evidence from emulator, physical-device, and store work.

### NATIVE-071 — Validate Android emulator and physical device

- [ ] **FR references:** FR-01 through FR-15; acceptance criteria 1–14.
- **Dependencies:** NATIVE-070, NATIVE-060.
- **Deliverable:** Android validation record covering fresh install, restart persistence, offline local data, import/export, capture destinations, capacity/recommendation, WebView matrix/fallback, notes, timer interruptions, and native URL/text sharing.
- **Verification:** Android emulator checks followed by a configured physical Android device with exact OS, browser/source-app, Expo/build, and network conditions recorded. Switch device appearance while the app is open and verify tabs, forms, modals, and reader controls in both modes. Include a cold launch with and without Reduce Motion and a cold launch through a shared URL (FR-15).
- **Complete when:** All Android release-gate scenarios have evidence or a documented limitation, and no browser emulation is presented as physical share evidence.

### NATIVE-072 — Validate iOS simulator, physical device, and store gates

- [ ] **FR references:** FR-08, FR-09, FR-10, FR-13, FR-15.
- **Dependencies:** NATIVE-061, NATIVE-071.
- **Deliverable:** iOS simulator and physical-device record for layout/navigation, SQLite persistence, import/export, WebView fallback, AppState/timer recovery, share extension/App Group, signing/provisioning, privacy strings, and release configuration.
- **Verification:** Simulator tests, physical-device tests, archive/install check, and App Store/TestFlight readiness review with exact tool/device versions recorded. Switch device appearance while the app is open and verify tabs, forms, modals, and reader controls in both modes. Include a cold launch with and without Reduce Motion (FR-15).
- **Complete when:** iOS-specific gates pass or are explicitly marked as release blockers; no iOS share support is claimed without device evidence.

### NATIVE-073 — Establish the first native release baseline

- [ ] **FR references:** FR-13, FR-15.
- **Dependencies:** NATIVE-071, NATIVE-072.
- **Deliverable:** Released database schema version, export-format support policy, migration/recovery documentation, app identifiers, build provenance, and store-release checklist.
- **Verification:** Review against [PRD.md](PRD.md), [TECH_STACK.md](TECH_STACK.md), [SYSTEM_DESIGN.md](SYSTEM_DESIGN.md), signed build smoke test, and import/export recovery drill.
- **Complete when:** The first native release baseline is recorded and future changes are required to use data-preserving migrations; the old web prototype reset exception cannot recur.

## Current progress record

- **NATIVE-001:** Temporary Expo SDK 58 scaffold resolved with pnpm; `expo-doctor` passed 20/20 checks. Root `package.json`, `app.json`, `eas.json`, `tsconfig.json`, Expo Router routes, `vitest.config.ts`, and the active root `pnpm-lock.yaml` are committed, including `expo-dev-client` and EAS development/preview/production profiles. The read-only EAS project check verified `@arifsaqa/stop-tumpuk` (`5fd9e8b0-ae97-4302-a6c1-01d451b91806`), and current-HEAD `eas config --platform android --profile development` resolved SDK 58/internal distribution/development-client with remote credentials and no configured environment variables; built development-client and device validation remain open.
- **NATIVE-003:** The source audit and native runtime audit are captured in [SYSTEM_DESIGN.md](SYSTEM_DESIGN.md); copied pure logic and browser-specific rewrite boundaries are identified.
- **NATIVE-010:** Runtime validators and pure domain rules exist under `src/`; strict TypeScript and focused/full automated tests pass. Native screen/runtime adapter wiring is implemented for the current scope; native persistence/device checks remain open.
- **NATIVE-011:** The SQLite schema/migration metadata, typed repository interfaces, isolated `expo-sqlite` adapter, and mocked CRUD/transaction boundary tests exist under `src/storage/sqlite/`; native build/runtime persistence checks remain open.
- **NATIVE-012:** The dependency-free transfer validator, serializer, additive conflict preview, and repository-backed transactional import application exist under `src/application/data-transfer.ts`; focused transfer tests cover malformed input, conflicts, unsupported formats, interrupted rollback, and no-write guarantees.
- **NATIVE-002:** The `/webview-probe` development-build route, representative source matrix, policy evidence model, loading/error state, and browser fallback are committed; Android emulator and physical-device observations remain open.
- **NATIVE-040:** Native reading route, HTTP(S)-only URL boundary, title/estimate/source header, progress, storage-failure messaging, retry/error state, and browser fallback are committed; Android/iOS runtime behavior remains open.
- **NATIVE-041:** WebView navigation isolation, unsafe-scheme blocking, external-scheme handoff, browser fallback, and no-bridge boundary documentation are committed; emulator/physical-device navigation checks remain open.
- **NATIVE-042:** Explicit Finish from the reading route now uses transactional lifecycle service, returns to Materials, refreshes state, and never infers completion from WebView or timer events; device flow checks remain open.
- **NATIVE-014:** Versioned migration initialization, repeat-open persistence, skipped-version, newer-schema rejection, rollback, and no-reset tests exist under `src/storage/sqlite/`; native runtime recovery checks remain open.
- **NATIVE-013:** Additive transfer validation/import, repository-backed export, native file-picker/filesystem UI, and mocked SQLite current-format round-trip coverage are committed; native file-provider behavior remains open for device validation.
- **NATIVE-020:** A repository-injected native capture service and destination-aware capture route exist under `src/application/capture-service.ts` and `app/index.tsx`, covering save-first capture, duplicate retry with surfaced retry failures, staged-share consumption, and optional enrichment; native persistence/device checks remain open.
- **NATIVE-033/NATIVE-042:** Lifecycle commands and UI wiring for commit, start, finish, reopen, return to Inbox, archive, and delete are committed; runtime persistence/device checks remain open.
- **NATIVE-033:** Native Materials route, status views, search/filter, editing, lifecycle actions, advanced-action grouping, delete confirmation, and transactional material-edit validation coverage are committed; emulator/device persistence checks remain open.
- **NATIVE-050:** Independent plain-text notes UI, sibling-preserving edit/delete/search, fresh-service reload for finished items, invalid-input validation, and finished-item primary-action coverage are committed; emulator checks remain open.
- **NATIVE-052:** Native import/export route, conflict preview, rejected-file handling, atomic import messaging, local-only guidance, transfer-preview edge coverage, and native file-adapter cancellation/error coverage are committed; emulator/iOS file-provider checks remain open.
- **NATIVE-060:** Android share payload parsing, mixed-payload selection, staged intake handoff, consumed-intake protection across relaunch, duplicate retry semantics, native-intent routing, and malformed/unavailable fallback are committed; installed-build/emulator/physical-device share checks remain open.
- **NATIVE-051:** The persisted timer controller/presenter now wires AppState foreground refresh, interval cleanup, start/pause/resume/end, and expiry recovery UI; emulator/physical-device interruption checks remain open.
- **NATIVE-030:** Settings/availability persistence, reminder decisions, and native settings screen exist under `src/application/settings-service.ts` and `app/settings.tsx`; emulator restart/offline checks remain open.
- **NATIVE-031/NATIVE-032:** Repository-backed capacity and recommendation application boundaries exist under `src/application/planning-service.ts`; the accessible capacity dashboard, recovered-load error state, 5/15/30/custom minute input, deterministic recommendation, partial-session state, and manual/unknown selection UI are committed. Emulator/device checks remain open.
- **NATIVE-041:** WebView navigation and external-fallback policy is enforced at the native route boundary with no privileged bridge; device behavior remains open.
- **NATIVE-061:** The current Expo SDK target has no iOS Share Extension/App Group configuration. Only the registered `stoptumpuk://expo-sharing` handoff is recognized; iOS `expo-sharing` handoffs are routed to explicit URL-paste guidance without reading or staging payloads, while ordinary routes and other schemes pass through. iOS share-menu support is not claimed and physical-device verification remains open.
- **NATIVE-073:** Android application ID `com.arifsaqa.stoptumpuk`, Expo slug/scheme, EAS project linkage, database schema version, and export-format version are recorded in the native configuration and source. iOS bundle/signing values, signed-build provenance, and release smoke/recovery evidence remain open.
- **NATIVE-071:** Android release validation is not run in this environment: `adb`, Android emulator tooling, and a connected physical device are unavailable. Fresh-install, restart/offline persistence, WebView matrix, import/export, timer interruption, and native share-menu evidence remain open.
- **NATIVE-072/NATIVE-073:** iOS simulator/device/store-release validation and the first native release baseline remain blocked on the missing platform toolchains, signing context, and device evidence; no iOS or store support is claimed.
- **Test record:** Root `pnpm typecheck`, `pnpm test` (27 files, 187 tests), `pnpm lint`, `pnpm format:check`, and `git diff --check` pass against native sources. The native capture fixture covers capture, start, and explicit finish with lifecycle events; capture/metadata tests cover enrichment failure durability, deleted-capture protection, save-before-enrichment, and malformed duration provenance; settings/planning/presenter tests cover reminder clamping/reset, invalid persisted reminders, unset versus zero capacity, zero-minute recommendations, empty/full/unknown states, and zero-capacity projection safety; mocked SQLite adapter tests cover CRUD, transaction boundaries, and current-format transfer round trips; transfer tests cover interrupted rollback, unsupported-format no-write behavior, and exclusion of disposable share intake; WebView, reading-state, lifecycle, and timer tests cover redirect/scheme isolation, recoverable loading/error states, explicit finish, and expiry without completion; Android share tests cover mixed payloads, unavailable native payloads, relaunch protection, and duplicate retry; transfer UI/file-adapter tests cover conflicts, rejected formats, picker cancellation, unavailable storage/sharing, and platform errors; material-management tests cover normalized edit persistence, zero/null estimates, validation, and transaction boundaries; iOS share tests cover registered-handoff matching and ordinary-route pass-through. Android/iOS build, emulator, physical-device, WebView-feasibility, and store checks remain open.

## Historical web verification context

The previous web project and `reference/web/` snapshot contain useful evidence for pure domain rules, Dexie transaction intent, browser capture flows, and PWA share-target parsing. Those records are not native evidence. They do not check off SQLite, Expo Router, `react-native-webview`, Android/iOS share menus, emulator/simulator behavior, physical-device persistence, or store release work. Preserve the snapshot unchanged.

## Release gate

Do not call the native migration complete until the Android physical-device gate, the iOS gates, the WebView feasibility/behavior record, the current-format import proof, and the first native schema/export baseline are all complete. Any failed or unrun check remains open with its limitation recorded.
