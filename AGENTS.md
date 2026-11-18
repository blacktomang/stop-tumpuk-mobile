# Repository guidance

## Read before working

Read [PRD.md](PRD.md) and [MILESTONES.md](MILESTONES.md) before planning or implementing a feature. Read [TECH_STACK.md](TECH_STACK.md) and [SYSTEM_DESIGN.md](SYSTEM_DESIGN.md) before changing the native architecture, dependencies, storage, platform integrations, or WebView boundary.

## Sources of truth

| Document | Owns |
| --- | --- |
| `PRD.md` | Product behavior, scope, acceptance criteria, and product decisions |
| `MILESTONES.md` | Migration sequence, task checkboxes, dependencies, verification methods, and release gates |
| `TECH_STACK.md` | Native dependencies, versions, tooling, and commands |
| `SYSTEM_DESIGN.md` | Architecture, module boundaries, SQLite schema, data flow, platform adapters, and failure handling |
| `AGENTS.md` | Contributor workflow and verification rules |

Do not create a second requirements document or duplicate the PRD in a technical document. Reference FR identifiers and milestone task IDs instead. Reference files are historical evidence and are not active application code or contributor instructions.

Follow the user's current instructions. If an authorized change alters product behavior or delivery scope, update the owning document and reconcile affected documents in the same task. If documents conflict, use the PRD for behavior and milestones for sequencing. Raise only unresolved choices that materially affect scope, data loss, cost, platform support, or user behavior.

## Current repository state

This repository is a migration-preparation workspace. `src/` contains copied pure domain logic, types, domain tests, availability-reminder logic, runtime validators, and the Dexie-free transfer boundary. `reference/web/` is an unchanged snapshot of the previous web project at `/home/josjis/projects/eda-wacana`; it contains the historical Dexie repositories, browser UI, PWA worker, metadata adapters, and browser tests. The root now has a native Expo manifest and scaffold routes, but no active root lockfile or installed dependency tree. Do not report native implementation, installed versions, or native test results until they exist and have actually run.

Keep `reference/web/` outside native compilation, runtime imports, test discovery, routine formatting, and dependency resolution. Do not edit it during the migration. Plan any Expo scaffold in a temporary directory and merge it deliberately so the prepared documents and copied source are not overwritten.

## Implementation workflow

1. Identify the relevant PRD FRs and milestone task IDs.
2. Inspect the copied source and the historical web implementation before deciding what to reuse.
3. Keep pure domain rules and current-format validation independent of React Native, SQLite, Expo modules, providers, and WebView code.
4. Introduce native repository and platform-adapter interfaces before wiring screens to storage, sharing, file access, linking, or WebView events.
5. Validate untrusted URLs, share payloads, provider responses, imported JSON, and remote WebView navigation at their boundaries.
6. Update milestone checkboxes only after the concrete deliverable is implemented and its stated verification passes. Documentation or a historical web test never checks off a native task.
7. Keep deferred features deferred. Do not add accounts, sync, AI, scraping services, automatic completion, new time tracking, rich-text notes, or speculative integrations.

## Engineering conventions

- Use strict TypeScript and explicit types at persistence and platform-provider boundaries. Validate untrusted input at runtime.
- Keep duration units explicit, unknown values nullable, and deterministic estimation, capacity, recommendation, lifecycle, and reminder rules independently testable.
- Persist through repository interfaces. Define SQLite schema and versioned migrations together. Never reset or replace a released native database to recover from an upgrade or storage error. Preserve IDs and user data through future migrations.
- Preserve current-format web backup IDs and associations through a validated, atomic native import. Separate serialization/validation from storage; reusable transfer code must not import Dexie or browser globals.
- Treat remote WebView content as untrusted. Do not expose app data or privileged native methods through a broad JavaScript bridge. Handle HTTP(S), external schemes, downloads, and failed navigation deliberately.
- Audit `crypto.randomUUID`, URL parsing, `fetch` timeouts, subscriptions, file APIs, AppState transitions, and timer lifecycle behavior for the native runtime. Use Expo adapters where needed and test foreground/background recovery.
- Use PanelUI with Uniwind and the selected Tailwind major recorded in `TECH_STACK.md`. Mount one root `PanelUIProvider`, use PanelUI semantic tokens rather than literal colours, and preserve semantic labels, touch targets, keyboard/screen-reader behavior where applicable, contrast, and reduced-motion behavior.
- Use pnpm and one active root `pnpm-lock.yaml`. Do not introduce npm, Yarn, Bun, or a second lockfile. Use `expo install` for Expo-managed native versions and record the resolved versions in the root manifest and lockfile when scaffolding happens.
- Do not put secrets in bundled app configuration. External provider keys are optional and public if shipped; core capture and planning must work without them.
- Use Prettier as the formatting authority. Keep generated native directories and `reference/web/` out of routine formatting unless a task explicitly requires them.
- When coding agents are used, include the agent co-author trailer in commits.

## Verification

Use only scripts that exist in the root `package.json`; do not claim checks that were not run. Until the root dependency tree is installed, use the temporary scaffold only for compatibility checks and keep root application/test results explicitly unrun.

For ordinary native TypeScript changes, run `pnpm typecheck`. Add focused domain, repository, migration, import/export, provider, timer, or UI tests for changed behavior. Run a production native build when app config, config plugins, native modules, or release configuration changes. Use an Expo development build for native-module behavior; Expo Go and browser emulation are not substitutes for configured share extensions or intent filters.

Verification must distinguish:

- automated unit/storage/component checks;
never run a build

## Reporting

State what changed, why it matters, which checks actually ran, and remaining limitations. Link changed files. Distinguish reusable copied logic from rewritten native adapters and distinguish automated, emulator, physical-device, and store-release validation. Never mark a migration task complete based on document creation alone.
