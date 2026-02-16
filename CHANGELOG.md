# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

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
- Updated contact email to forgekit@pm.me

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
