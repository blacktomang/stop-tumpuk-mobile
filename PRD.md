# Product Requirements Document

## stop-tumpuk native migration

**Version:** 3.0 (migration planning)

**Status:** Native migration approved; implementation and release validation pending

**Platform:** Native Android and iOS application built with Expo and React Native. Android is the initial implementation and validation platform; iOS follows the native-share, WebView, persistence, and store-release gates in [MILESTONES.md](MILESTONES.md). This sequencing is a working assumption, not a product restriction.

**Product name:** stop-tumpuk

## 1. Product intent

stop-tumpuk turns useful articles and standalone videos discovered while browsing into learning commitments that people can finish. The app makes the time cost of a backlog visible, recommends one item that fits the time available now, and keeps completion and notes connected to the source.

The native app is local-first. It stores the plan, notes, settings, sessions, and history on the device in SQLite. External websites still require network access. The app does not promise offline access to arbitrary third-party pages, and it does not synchronize automatically between devices.

The existing capture-to-finish behavior remains the product baseline: capture a URL or supported native share, choose Reading plan or Inbox, see an estimate and weekly capacity, read next, optionally use a 25-minute focus timer, finish explicitly, and add notes whenever useful.

## 2. Goals and non-goals

### Goals

- Make committed learning time visible against weekday/weekend availability.
- Keep capture quick while making the destination choice explicit.
- Recommend one deterministic next item that fits the user's available time.
- Make reading inside the app the default through a native WebView with honest fallbacks.
- Preserve notes, estimates, lifecycle history, export/import, and the optional focus timer locally.
- Accept shared URLs or text through native platform integrations when the installed build supports them.

### Non-goals

The migration does not add accounts, cloud sync, AI inference, scraping services, automatic completion, scroll or playback tracking, new time-tracking behavior, course/curriculum management, social features, rich-text notes, note relationships, calendars, streaks, reminders beyond the existing availability prompt, or custom timer cycles. Importing messaging histories and saved collections remains deferred.

## 3. Primary journey

1. A user pastes an HTTP(S) URL or shares URL/text from another app.
2. The app stages incoming content in the ordinary capture form. The user chooses Reading plan (selected by default) or Inbox before saving.
3. The app saves a usable local record first, then attempts optional metadata enrichment. Failure never loses the capture.
4. The user sees one estimated time with a simple label and can edit one estimated-minutes correction.
5. The dashboard compares known unfinished Reading plan time with one week's weekday/weekend allowance.
6. The user enters time available now, receives one fitting recommendation, and can choose another item manually.
7. Opening a recommendation shows the source in the in-app WebView when it is usable. The user has browser navigation, loading/error states, and an external-browser fallback.
8. The user may start, pause, resume, or end the fixed 25-minute timer. Timer completion never finishes the material.
9. The user finishes explicitly. The plan and recommendation refresh immediately after a successful save. Notes remain available before or after finishing.

## 4. Functional requirements

### FR-01 — Learning availability

Offer weekday and weekend minute settings during onboarding and from Settings. The user may skip configuration; after skipping, do not prompt again for three months and show when the next prompt may appear. Zero-minute days are valid. Distinguish unset availability from zero capacity and show no clearance estimate for either. Weekly capacity is `weekday minutes × 5 + weekend minutes × 2`; seven-day scheduling is deferred.

### FR-02 — Capture and native share intake

Accept and validate an HTTP(S) URL from the capture form. Accept shared text and shared URLs from supported Android and iOS native integrations, parse URL candidates, and let the user choose when more than one candidate exists. Incoming shares must be staged for the same destination-aware capture form; they must never auto-commit.

Reading plan is the default for every new capture, including a new share. Inbox is an explicit alternative and does not add planned time. Warn on duplicates and preserve the selected destination when the user retries. Save without a title, duration, metadata, availability setup, or installation. If no title is available, use a domain/URL placeholder. URL paste is the guaranteed fallback when native sharing is unavailable.

Native share reception depends on a built development/release binary and platform configuration. Android is the first supported validation target. iOS support is subject to the share-extension and App Group gates; no platform is described as universally supported.

### FR-03 — Metadata and estimates from providers

Save the minimal material before optional metadata work. Providers may supply title, type, thumbnail, source duration, and provenance. Validate every provider result. Timeouts, authentication, paywalls, offline state, CORS-like access restrictions, quotas, and unsupported sites leave the saved item usable and editable.

Preserve source duration provenance internally: API runtime, publisher estimate, calculated word count, manual input, or unknown; preserve full/partial/unknown completeness. Show only simple labels such as “Estimated,” “Video runtime,” “Manually set,” or “Time not estimated yet.” Previews, login pages, and descriptions do not establish full-article duration. No universal extraction is promised.

### FR-04 — Estimated time

Expose one editable **Estimated time (minutes)** field. Keep source duration and nullable manual override separate. A manual override takes precedence; zero is known and distinct from unknown. Clearing the override returns to a usable source estimate or unknown. Articles use a publisher estimate or complete-text calculation at a fixed 250 WPM planning assumption where available. Videos preserve runtime and may apply the existing playback-speed preference. Remove priority, learning multipliers, pasted-text counting, and article reading-speed settings.

Keep estimates fixed until explicit completion. Timer elapsed time never subtracts from an estimate.

### FR-05 — Commitment and lifecycle

Saving to Reading plan or moving an Inbox item into it records commitment history. Only queued and in-progress items count toward active planned time and recommendations. Unknown time never blocks commitment and remains visibly unestimated. Users can return an item to Inbox, mark it in progress, finish it explicitly, reopen it, archive it, or delete it. Archive is not completion.

### FR-06 — Capacity awareness

Replace dashboard statistic cards with one conversational weekly-capacity message and an accessible meter. Show known unfinished planned time, capacity, unknown-item count, headroom or overflow, and an optional plain-language clearance projection. Handle unset, zero, empty, under-capacity, full, overflow, and unknown states without division by zero or misleading color-only cues. The meter is not completion progress and does not reset at a week boundary.

### FR-07 — Read next

Ask how many minutes are available now, with 5/15/30-minute shortcuts and a custom value. Show at most one fitting recommendation. Rank fitting active items by in-progress status, shorter estimate, older creation time, and stable ID. Offer Choose another for manual selection. Unknown estimates can be selected manually but are never claimed to fit. If nothing fits, state that truthfully and optionally offer one longer item for a partial session.

### FR-08 — In-app reading

Opening a material enters a native `react-native-webview` reading screen by default. Show the title, estimated time, source URL/domain, back navigation, WebView loading progress, navigation controls appropriate to the screen, and a recoverable error state. Provide an external-browser fallback when the WebView cannot load or when the user chooses it. Handle external URL schemes deliberately. Do not promise that every website, login flow, video, download, or embedded player works in WebView.

Remote page content is untrusted. Keep it isolated from app data and privileged native bridges; do not expose arbitrary app methods or unsanitized HTML. Do not infer completion from opening, navigation, scrolling, playback, or WebView events.

### FR-09 — Explicit completion and timer

Only an explicit Finish action marks a material completed. Save the lifecycle change transactionally, update the plan and recommendation immediately, and do not open a takeaway prompt. The optional fixed 25-minute timer supports start, pause, resume, and end, persists timestamps and state across interruptions, and never completes a material. Back and active timer controls remain reachable.

### FR-10 — Notes

Each material may have zero, one, or multiple independent plain-text notes. New note adds a record; editing or deleting one note does not affect siblings. Notes are available before or after finishing, from the item and Finished list. Stable note and material IDs and associations survive reloads and validated export/import.

### FR-11 — Note relationships

Deferred. Stable IDs are retained for future manually linked notes; relationship storage, navigation, graphs, and auto-linking are outside this release.

### FR-12 — Material management and action hierarchy

Search and filter by status. Edit title, source URL, estimated minutes, type, and video playback speed where applicable. Use Reading plan, Estimated time, Time available this week, Read next, and Finished in user-facing copy.

On mobile, show the main action directly and place secondary per-item actions in an accessible Advanced actions control when there are more than three. Preserve Back, Cancel/Close, destructive confirmation, focus/selection feedback, and active timer controls. Inbox primary action is Commit; Reading plan primary action is Open source or Finish according to context. Notes keep New note prominent and use a compact menu for each note's Edit/Delete actions.

### FR-13 — Local-first SQLite and data transfer

Use native SQLite behind repository interfaces. There is no registration or core cloud backend. Store materials, notes, settings, sessions, lifecycle events, and staged share intake locally. Use stable IDs and UTC persisted instants. Future native database upgrades must use versioned, tested, data-preserving migrations; the old web prototype reset exception is not renewed.

Keep current-format web backups supported through explicit runtime validation and import into SQLite. Preserve IDs, materials, multiple notes, associations, estimates, settings, sessions, and history. Separate reusable validation/serialization from storage operations; `data-transfer.ts` must not import Dexie or any browser database. Import is additive, conflict-previewed, atomic, and never silently overwrites or clears local records. Reject unsupported formats before writes. Export excludes disposable intake records and credentials.

The native database is not the browser IndexedDB database. Installation does not provide cross-device synchronization. Explain this and make export available for manual transfer and backup.

### FR-14 — Network and offline behavior

The queue, settings, notes, estimates, and lifecycle data remain usable without network access after local initialization. Third-party content in WebView requires its own network and access permissions; arbitrary pages are not cached for offline reading. Metadata refresh is optional and retryable. Do not claim that offline mode includes external websites.

### FR-15 — Native platform integration and release boundaries

Use Expo Router for native navigation and deep-link handling. Use the platform share integration for inbound URL/text shares, and keep outbound sharing separate if introduced later. Native modules that need config plugins or a development build must be tested in a development/release binary, not inferred from browser emulation or Expo Go alone.

App screens, navigation, and controls follow the device's light or dark appearance. The appearance of a source loaded in the reader depends on the source website.

On native cold launch, show the stop-tumpuk link-and-book mark. Once the app layout is ready, the link gently moves and settles into the book before the splash fades. With Reduce Motion enabled, show the static mark until the app layout is ready.

Android is the initial implementation and validation platform. iOS release requires a simulator check, physical-device persistence and WebView checks, share-extension/App Group verification, background/foreground timer checks, signing/provisioning, privacy metadata, and App Store review readiness. The exact minimum OS versions, representative source-site matrix, and final share MIME/payload policy remain release decisions.

## 5. Success measures

The primary measure remains committed-material completion rate: completed committed materials divided by materials committed in a defined cohort. Supporting measures include weekly completions, users completing at least one item, completed items with notes, backlog size, clearance estimate, and return to existing commitments. These are computed locally initially and do not require analytics or an account.

## 6. Acceptance criteria

1. A user can capture by paste without installation, metadata, duration, or availability setup and choose Reading plan or Inbox in the same form.
2. A supported native URL/text share reaches that form without silently saving; unsupported sharing leaves URL paste usable.
3. Failed enrichment never loses a saved item, and unknown duration never becomes zero.
4. Manual estimated minutes, including zero, override source duration and survive reload, enrichment, and current-format import.
5. Weekly capacity correctly distinguishes unset, zero, empty, under, full, overflow, and unknown states.
6. Read next shows one deterministic fitting item or a truthful no-match state, with manual selection available.
7. Reading defaults to the in-app WebView with loading/error states, browser navigation, and external-browser fallback; unsupported site behavior is explained.
8. Remote WebView content has no privileged bridge to app data, and arbitrary schemes are handled deliberately.
9. Finish is explicit, transactional, immediately refreshes the plan, and never opens a takeaway prompt.
10. The optional 25-minute timer survives app interruptions without finishing or reducing an item.
11. Multiple independent notes can be created, edited, searched, and deleted without affecting siblings.
12. Current-format web backups import into SQLite with stable IDs, conflict preview, validation, atomic writes, and no overwrite/clear behavior.
13. Native data survives restart and remains available offline; third-party content is not promised offline.
14. Android physical-device sharing and persistence gates are recorded separately from automated tests; iOS gates are explicit and unclaimed until run.
15. No account, sync, AI, scraper, automatic completion, or deferred organization feature is required for the core workflow.

## 7. Deferred and removed scope

Deferred features are accounts, sync, conflict resolution, note relationships, AI, scraping/extraction service, messaging-history imports, extensions beyond the native share integration, calendars, adaptive plans, streaks, quizzes, custom timer cycles, manual remaining-time tracking, categories, formal goals, rich-text notes, courses, and automatic completion.

Removed from the accepted model are priority levels, learning multipliers, pasted-content word counting, configurable article reading speed, automatic takeaway prompts, and browser service-worker/PWA assumptions for the native release.

## 8. Decisions and unresolved choices

The retained product decisions are the Reading plan default with Inbox alternative, weekday/weekend availability, one recommendation, explicit completion, on-demand multiple notes, one estimated-minutes correction, the fixed focus timer, local-first storage, and plain-text notes.

Working assumption: implement and validate Android first, then complete iOS-specific gates before claiming iOS release readiness.

Material unresolved choices are the final Expo SDK/package lock after scaffolding, minimum Android/iOS versions, representative source websites and WebView allow/fallback policy, exact native share payload/MIME support and iOS extension design, whether any external metadata provider is enabled in production, app identifiers/signing ownership, and store privacy/disclosure text. These choices must not expand product scope or weaken the URL-paste and external-browser fallbacks.

## 9. Historical web evidence

`reference/web/` contains an archival snapshot from `/home/josjis/projects/eda-wacana`. Its browser tests and PWA share-target behavior are historical evidence only. They do not establish native SQLite, native share-menu, WebView, emulator, simulator, physical-device, or store-release behavior. Keep the snapshot unchanged and outside native compilation, runtime imports, test discovery, and formatting.

**End of PRD v3.0 migration plan**
