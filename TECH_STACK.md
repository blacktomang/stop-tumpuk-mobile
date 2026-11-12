# Technical stack

**Status:** Native migration target selected. A root Expo manifest and minimal route scaffold now exist; the root lockfile and installed dependency tree remain pending.

**Product authority:** [PRD.md](PRD.md). **Delivery sequence:** [MILESTONES.md](MILESTONES.md). **Architecture:** [SYSTEM_DESIGN.md](SYSTEM_DESIGN.md).

## Chosen platform

| Area | Target choice | Boundary or reason |
| --- | --- | --- |
| App runtime | Expo SDK 58 with React Native 0.88 and React 19.3 | Official SDK 58 reference maps these versions; use `expo install` to resolve SDK-managed packages. |
| Language | Strict TypeScript | Domain, repositories, transfer validation, and platform adapters share explicit types. |
| Navigation | Expo Router `~58.0.30` | File-based native routes and deep-link/native-intent handling. |
| Styling | NativeWind `4.2.7` stable line with Tailwind CSS 3.4.x | NativeWind 4 requires Tailwind 3. Do not copy the web Tailwind 4 setup. NativeWind 5 is pre-release and is not the migration target. |
| Persistence | `expo-sqlite ~58.0.15` behind repositories | SQLite is persisted across app restarts; schema and migrations stay behind an application boundary. |
| Reading | `react-native-webview 14.0.1` | In-app source reading on Android/iOS, with explicit loading/error/navigation and external-browser fallback. |
| Native inbound sharing | `expo-sharing ~58.0.22` plus Expo Router native-intent/configuration | Android intent filters and iOS share-extension/App Group behavior require a configured native build; receiving is distinct from outbound sharing. |
| Native platform adapters | Expo modules such as `expo-crypto`, `expo-file-system`, `expo-document-picker`, `expo-linking`, and `expo-web-browser` where needed | Keep UUID, files, linking, external-browser opening, and app lifecycle behind small adapters. Add only when a milestone needs them. |
| Build/distribution | Expo development builds and EAS-compatible Android/iOS builds | Native modules and share configuration must be validated in a built binary. Store work is a release milestone, not a scaffold assumption. |
| Package manager | pnpm, one active root `pnpm-lock.yaml` | The reference web lockfile remains archival under `reference/web/`. |
| Testing | Vitest for domain/transfer/repository rules; React Native component tests only when useful; emulator/device checklists for native behavior | Live web providers are mocked. Native share and WebView claims require platform-specific checks. |
| Formatting/linting | Prettier plus a TypeScript-aware linter selected at scaffold time | Do not format `reference/web/` or generated native directories as part of routine work. |

The resolved target versions are recorded in the root `package.json` and were installed and checked in the temporary scaffold; the root `pnpm-lock.yaml` is still pending. The temporary scaffold's `expo-doctor` run passed all 20 checks. Until the root install is authorized and completed, these are compatibility evidence rather than a passing root build. If an SDK release changes before the root install, re-check the official compatibility table and update this document before changing the target.

## Version evidence

The Expo SDK 58 reference states that SDK 58 targets React Native 0.88, React 19.3, and Node 22.13.x or newer. Its package references list Expo Router `~58.0.30`, `expo-sqlite ~58.0.15`, `expo-sharing ~58.0.22`, and `react-native-webview 14.0.1`. The NativeWind documentation identifies 4.2.7 as the stable line using Tailwind CSS 3 and identifies v5 as pre-release using Tailwind 4. These links were checked while preparing this plan and must be rechecked during scaffold review:

- [Expo SDK 58 reference](https://docs.expo.dev/versions/v58.0.0/)
- [Expo Router SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/router/)
- [`expo-sqlite` SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/sqlite/)
- [`expo-sharing` SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/sharing/)
- [`react-native-webview` SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/webview/)
- [NativeWind stable overview](https://www.nativewind.dev/docs)
- [NativeWind v5 installation notes](https://www.nativewind.dev/v5/getting-started/installation)

## Planned scripts after scaffolding

Do not report these commands as available until the root manifest defines them and dependencies are installed.

| Command | Purpose | Verification class |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | Reproduce the committed dependency tree | setup |
| `pnpm start` | Start Expo development server | development |
| `pnpm android` | Run the Android development build/emulator target | emulator/development build |
| `pnpm ios` | Run the iOS development build/simulator target | simulator/development build |
| `pnpm typecheck` | Check strict TypeScript | automated |
| `pnpm lint` | Run static checks | automated |
| `pnpm format:check` | Verify formatting | automated |
| `pnpm test` | Run domain, transfer, repository, and focused component tests | automated |
| `pnpm build:android` | Produce a release/preview Android binary | native release validation |
| `pnpm build:ios` | Produce a release/preview iOS binary | native release validation |

The scaffold should use `expo install` for Expo-managed modules, `expo-doctor` after dependency changes, and a development build for `expo-sharing` configuration and WebView behavior. An EAS project and development/preview/production profiles are now recorded in `app.json` and `eas.json`; signing credentials, Android SDK, Xcode version, and built-device evidence remain open until their release gates run.

## Dependency policy

Keep the core workflow independent of accounts, a backend, AI SDKs, extraction servers, analytics, and a generic CORS proxy. Use prepared statements for SQLite input. Add a package only for a concrete milestone deliverable, document its native/config-plugin requirements, and add a focused verification path. Do not add a second database library until a documented need exists; `expo-sqlite` is the persistence boundary.

## Reference implementation boundary

`reference/web/package.json` and `reference/web/pnpm-lock.yaml` describe the old Vite/React/Dexie/PWA application. They are archival and must not be copied into the native root. The copied root `src/domain.ts`, `src/types.ts`, `src/domain.test.ts`, and `src/application/availability-reminder.ts` are candidates for reuse after runtime-independent review. Web components, Headless UI, Dexie, service workers, browser file APIs, and Vite scripts require native rewrites or adapters.
