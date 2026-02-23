# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [1.1.5] - 2026-02-23

### Added

- **`--cleanup-only` CLI flag** — removes scaffold story/MDX files that conflict with generated stories and exits immediately. Designed to be used as a `prestorybook` npm lifecycle hook so cleanup happens automatically every time `npm run storybook` is invoked.
- **Auto-inject `prestorybook` script** — on first startup the MCP server now adds `"prestorybook": "npx forgekit-storybook-mcp --cleanup-only"` to the consumer's `package.json` if one doesn't already exist. This means scaffold conflicts are resolved *before Storybook starts*, with zero user action required.
- **`prestorybook` script in `--setup`** — the setup command now includes `prestorybook` in the scripts it writes to `package.json`.

## [1.1.4] - 2026-02-23

### Fixed

- **Auto-removes Storybook scaffold files that conflict with generated stories** — `npx storybook init` creates boilerplate in `src/stories/` (e.g. `Button.stories.ts`, `Header.stories.ts`). When the MCP server generates co-located stories for real components, these duplicates crash Storybook's file indexer with `Unable to index files`. Every `sync-all` run now detects conflicts and silently deletes the scaffold files before generating, so users never have to manually clean anything up.
- **Preflight duplicate check auto-remediates** — `check-health` now removes scaffold duplicates (emits `warn` for cleaned up, `fail` only if deletion fails or both files are real non-scaffold stories).

## [1.1.2] - 2026-02-23

### Fixed

- **Preflight reports duplicate story files** — `check-health` now detects when multiple story/MDX files share a basename (e.g. a scaffold `src/stories/Button.stories.ts` alongside a generated `src/components/Button/Button.stories.tsx`). Reports affected paths and fix instructions.

## [1.1.1] - 2026-02-23

### Fixed

- **Framework wrongly detected as `vanilla` on shadcn/ui projects** — `autoDetectConfig()` now checks for `components.json`, any `@radix-ui/*` package, `@base-ui-components/react`, `class-variance-authority`, `lucide-react`, and `tailwindcss` as shadcn signals, in addition to the existing `shadcn-ui` check.
- **Duplicate story files for co-located component patterns** — `findStoryFile()` now walks up from the component directory and checks sibling `stories/`/`__stories__` folders, plus `src/stories/` and `stories/` at the project root (default Storybook scaffold location).

## [1.1.0] - 2026-02-23

### Added

- **Dynamic Storybook version detection** — `detectInstalledStorybookVersion()` reads the actual installed version from `node_modules/storybook/package.json` before suggesting dependencies. No more hardcoded `^10.2.0` — the suggested deps match what is actually installed.
- **MDX `availableExports` guard** — `generateDocs()` now accepts an `availableExports` param and only emits `<Canvas>` blocks for story exports that actually exist, preventing broken MDX in projects with sparse story files.

### Fixed

- **MDX `@storybook/addon-docs/blocks` import** — corrected to `@storybook/blocks` (the correct path for Storybook 7+).

## [0.12.0] - 2026-02-23

### Added

- **Background file watcher** (`startFileWatcher`) — watches all configured library directories with `fs.watch({ recursive })`, debounced at 500 ms per file. Auto-syncs new and changed components without a server restart. A periodic 30-second rescan covers events missed by the OS watcher (Linux, network drives).
- **`--no-watch` CLI flag** — disables background watching for CI / `--init-only` pipelines.
- **`storybook-mcp.config.json` auto-generation** — created on first run from auto-detected values. `--setup` always writes/refreshes it. `package.json#storybook-mcp` entries are migrated automatically.
- **`.env` / `.env.local` loading** — `STORYBOOK_MCP_LICENSE` and other env vars are now loaded from the project root before any config or license work, with `.env.local` taking priority.
- **`--reset-license` flag** — clears the Polar API cache file and in-memory cache, forcing a fresh validation on next run.
- **`resetLicenseCache()` export** — programmatic cache clearing from library consumers.
- **`forceRefresh` param on `validateLicenseAsync()`** — bypass all caches and hit the API immediately.

### Changed

- **Tests and docs unlocked for Free tier** — `generate_test`, `generate_docs`, and the test/docs paths inside `sync_all` / `sync_component` no longer require a Pro license. Pro retains: unlimited sync, advanced templates, `update_story`, and Figma Code Connect.
- **Free tier component limit corrected to 10** — was hardcoded as `5` throughout `license.ts` despite the `FREE_TIER_MAX_SYNC = 10` constant and README both stating 10.
- **Concurrent component processing** — startup sync and periodic rescan now process components in batches of 5 concurrently instead of sequentially.

### Fixed

- **`console.log` stdout corruption** — the Pro license success message was writing to stdout (MCP JSON-RPC channel), which could corrupt tool responses. Moved to `console.error`.
- **Atomic cache writes** — `saveCache` now writes to `.storybook-mcp-cache.json.tmp` then renames atomically, preventing cache corruption on crash or SIGKILL.
- **`syncSingleComponent` cache mutation bug** — shallow `{ ...cache }` shared the inner `components` map by reference; mutations during sync were corrupting the original cache object.
- **Stale cache pruning** — deleted component files are now removed from the hash cache on every sync, preventing ghost entries.
- **Actionable license error messages** — validation failures now log HTTP status, rejection reason (`status=revoked`, `expired`), or network error details instead of silently falling back to Free tier.

## [0.11.0] - 2026-02-18

### Added

- **`update_story`** (Pro) — regenerates a story while preserving any custom exports you have added. Uses merge logic to detect user-written `export const X: Story` blocks and append them below the regenerated content. Includes import validation and version tracking.
- **`generate_code_connect`** (Pro) — generates a `@figma/code-connect` `.figma.tsx` file from component analysis. Maps TypeScript props to `figma.string`, `figma.boolean`, `figma.enum`, `figma.children`, and `figma.number` bindings. Event handlers, `className`, `style`, and `ref` are excluded automatically.
- **Story version tracking** — every `generate_story` and `update_story` call records an entry in `.forgekit/story-history.json` (action, timestamp, content hash). Up to 10 versions retained per story path.
- **Import validation** — non-blocking warnings on story generation: checks relative component import, `@storybook/react` presence, decorator addon packages, and template placeholders.

### Docs

- Migrated `mint.json` → `docs.json` (Mintlify deprecated the old format)
- Added API reference pages for `update_story` and `generate_code_connect`
- Added Figma integration guide (Code Connect + Code to Canvas)
- Added changelog page

## [0.10.6] - 2026-02-16

### Changed

- **Pricing: $49 → $29 launch price** — reduced Pro tier price to improve conversion
- **Free tier limit: 5 → 10 components** — doubled free tier allowance to give users more value before upgrading
- Free tier warning message now uses dynamic limit from constants (future-proof)

## [0.10.5] - 2026-02-16

### Added

- **React Native Web auto-configuration** - Automatically generates `vite.config.ts` with React Native Web aliasing for React Native/Expo projects
- **App directory story paths** - Stories in `app/**/*.stories.*` are now automatically included for React Native/Expo projects using Expo Router

### Changed

- Setup command now detects React Native/Expo projects and configures appropriate tooling
- Better out-of-the-box experience for React Native developers using Storybook

## [0.10.4] - 2026-02-16

### Fixed

- **Critical:** Fixed prop extraction failing on Windows due to CRLF line endings - props were not being extracted, resulting in completely empty story files with no args
- Fixed union type detection not recognizing double-quote string literals (`"light" | "medium"`)
- Improved default args generation with sensible fallbacks for common prop names (title, label, placeholder, text, value, name, id)
- Added better defaults for optional boolean and number props

### Improved

- Trim prop lines before regex matching to handle both Windows (`\r\n`) and Unix (`\n`) line endings
- Enhanced `buildDefaultArgs` to provide comprehensive default values for better out-of-the-box story rendering

## [0.10.1] - 2026-02-16

### Fixed

- **Test suite configuration** — Downgraded from Vitest 4.0.18 to 3.2.4 to resolve "failed to find the runner" errors
- **Router dependency detection** — Added `react-router-dom` to router package detection (previously only detected `react-router`)
- **TypeScript module resolution** — Changed from "bundler" to "node" for better Node.js compatibility
- **Test environment** — Added Vite 5.x as explicit peer dependency for Vitest
- **100% test coverage** — All 124 tests now passing

### Verified

- **Framework-specific docs generation** — Confirmed all frameworks (Chakra, Tamagui, Gluestack, shadcn, vanilla) have proper composition and responsive examples
- **Component-level framework detection** — Verified shadcn and Tamagui detection works at component level via import analysis
- **MSW template timeout** — Confirmed using proper 5000ms timeout (not 999999ms)
- **Form template flexibility** — Confirmed template has proper customization comments, no hardcoded prop assumptions

## [0.10.0] - 2026-02-15

### Breaking Changes

- **Minimum Storybook version now 10.2+** — older versions no longer supported
- **Minimum Node.js version now 20+** — aligns with Storybook 10.2 requirements

### Added

- **Vitest addon integration** — auto-configured for Vite-based projects (Storybook 10.2+ recommendation)
- Vitest addon automatically added to `.storybook/main.ts` for Vite projects
- Webpack projects continue using `@storybook/test-runner`

### Changed

- **Upgraded all Storybook dependencies to ^10.2.0** for latest features and fixes
- Updated README with Storybook 10.2+ requirements and installation instructions
- Package.json scripts now use `npx` for better Windows compatibility
- All generated configs target Storybook 10.2+ exclusively

### Fixed

- **Type safety improvements** — removed unnecessary `as any` casts in scanner and setup utilities
- Windows PATH issues with build scripts resolved

## [0.9.4] - 2026-02-15

### Changed

- **GitHub organization migrated** to `the-single-gentlemans-club/storybook-mcp`
- Updated all repository URLs in package.json and documentation
- Git remote configuration updated for new organization

### Fixed

- **Type safety in MCP tool arguments** — explicit typed objects replace inline assertions
- Better error handling for tool argument validation

## [0.9.3] - 2026-02-15

### Added

- **Comprehensive Mintlify documentation** — 33 pages covering all features
- Complete API reference for all 12 MCP tools
- Framework-specific guides (Chakra UI, shadcn/ui, Tamagui, Gluestack UI, React Native)
- MCP client setup guides (Cursor, Claude Desktop, Programmatic)
- 7 story template documentation pages with examples
- License and pricing documentation

### Fixed

- **Documentation generator** — auto-generates MDX docs for all components
- Regex pattern improvements using modern `matchAll()` instead of `exec()` loops

## [0.8.7] - 2026-02-13

### Fixed

- **Free tier sync limit was never enforced** — free users got unlimited Pro features since launch. Now correctly capped at 5 components.
- Free tier no longer generates tests or docs in CLI startup path
- Stale upgrade URL in initializer ("coming soon" → Polar checkout link)
- Playwright tests no longer generated when `@playwright/test` isn't installed
- Generated tests now wrap in correct framework provider (Chakra/Gluestack/Tamagui)

### Added

- `POLAR_UPGRADE_URL` centralized in `src/utils/constants.ts`
- `POLAR_API_URL` env var for switching between sandbox/production Polar APIs
- `test` and `test:watch` scripts in package.json
- 124 passing tests across 10 test files

### Changed

- SB10-only — dropped all pre-SB10 compatibility code
- `tags: []` default (prevents duplicate pages with explicit MDX docs)
- MDX imports from `@storybook/addon-docs/blocks`
- `<ArgTypes of={Stories}>` pattern (reference stories file, not component)

## [0.7.0] - 2026-02-11

### Added

- **Preflight health check** — automatically checks for missing packages, outdated configs, and version mismatches on startup
- New `check_health` MCP tool — run health checks on demand from your editor
- **Prerequisites section** in README — clear guidance on required Storybook packages before install
- Detection for deprecated SB10 patterns: `argTypesRegex`, old `@storybook/testing-library` and `@storybook/jest` imports
- Detection for bundled addons that no longer need separate install in SB10 (`addon-essentials`, `addon-interactions`, `addon-links`, `addon-a11y`)
- Actionable install commands in preflight output

### Fixed

- Removed deprecated `argTypesRegex` from all generated preview templates (SB10 auto-detects actions)
- Added `@storybook/react-vite` to required packages list — was missing, causing `main.ts` framework errors

### Changed

- All generated configs now target Storybook 10+ by default
- Preview templates no longer include `actions.argTypesRegex` parameter

## [0.6.0] - 2026-02-10

### Changed

- Switched licensing provider from LemonSqueezy to Polar.sh
- Updated contact email to <forgekit@pm.me>

## [0.5.2] - 2026-02-10

### Fixed

- Updated all Storybook imports and dependencies for SB10 consolidated packages
- Storybook v10 support in `storybookVersion` config field

## [0.5.0] - 2026-02-09

### Added

- Storybook v10 types and configuration support
- `storybookVersion` config option

## [0.4.1] - 2026-02-08

### Added

- Initial public npm release as `forgekit-storybook-mcp`
- `--setup` command for scaffolding `.storybook/` config
- Auto-detection of UI framework (Chakra, shadcn, Tamagui, Gluestack, React Native)
- Auto-detection of Nx monorepo vs standard project
- 12 MCP tools: `list_components`, `analyze_component`, `generate_story`, `generate_test`, `generate_docs`, `validate_story`, `sync_all`, `sync_component`, `get_story_template`, `list_templates`, `get_component_coverage`, `suggest_stories`
- 8 story templates: basic, with-controls, with-variants, with-msw, with-router, page, interactive, form
- Auto-sync on startup with change detection and hash caching
- Free/Pro licensing model
- CLI flags: `--skip-init`, `--dry-run`, `--init-only`, `--no-stories`, `--no-tests`, `--no-docs`, `--no-update`
