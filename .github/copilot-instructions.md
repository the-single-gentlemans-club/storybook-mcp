# Copilot Instructions — forgekit-storybook-mcp

## Project Overview

**MCP (Model Context Protocol) server** that auto-generates Storybook stories, tests, and MDX docs for React component libraries. Published to npm as `forgekit-storybook-mcp`, runs as a CLI via stdio transport. It is **not** a React app—it analyzes and generates files in consumer projects. Requires **Node ≥ 20** and targets **Storybook 10+**.

## Architecture

```
src/
  cli.ts              → Entry: loads .env/.env.local, resolves config, runs preflight + init sync, starts MCP server
  index.ts            → MCP server: registers 15 tools via @modelcontextprotocol/sdk request handlers
  tools.ts            → 15 tool functions: listComponents, analyzeComponent, generateStory, updateStory,
                         validateStory, getStoryTemplate, listTemplates, getComponentCoverage, suggestStories,
                         syncAll, syncComponent, generateTest, generateDocs, checkHealth, generateCodeConnect
  types.ts            → All shared TypeScript interfaces + DEFAULT_CONFIG
  utils/
    scanner.ts          → Component discovery (fast-glob) + prop/dependency extraction via regex
    generator.ts        → Story file generation (framework-aware: Chakra/shadcn/RN/etc.)
    initializer.ts      → Startup sync engine: MD5 hash diff via .storybook-mcp-cache.json; file watcher
    setup.ts            → Storybook bootstrapper: .storybook/ config, Nx monorepo detection
    templates.ts        → 8 built-in story templates (basic, with-controls, with-msw, form, etc.)
    validator.ts        → Story validator: 8 rule categories, 0-100 score
    test-generator.ts   → Generates Playwright or Vitest test files
    docs-generator.ts   → Generates MDX documentation files
    code-connect-generator.ts → Generates @figma/code-connect .figma.tsx files
    story-merger.ts     → Pure functions: merges regenerated templates with user-added story blocks
    story-history.ts    → Writes .forgekit/story-history.json (max 10 versions per story)
    preflight.ts        → Storybook 10 compatibility checks before server starts
    errors.ts           → StorybookMCPError class + ErrorCode enum (typed error codes)
    constants.ts        → Single source of truth for all hardcoded values
```

## Key Data Flows

1. **Config resolution** (`cli.ts`): `.env.local` → `storybook-mcp.config.json` → `package.json["storybook-mcp"]` → auto-detection
2. **Startup** (`cli.ts` → `preflight.ts` → `initializer.ts`): preflight checks → component scan → MD5 hash diff → generate/update files → start file watcher
3. **MCP tool calls** (`index.ts` → `tools.ts` → `utils/*`): JSON-RPC routed through `switch` on tool name → typed tool function → result with `summary`
4. **`update_story`**: regenerates template → `story-merger.ts` pure functions preserve user-added `export const X: Story` blocks → `story-history.ts` records the event

## License Gating

All pro tool functions call `validateLicense()` + `requireFeature()` before executing. License key via `STORYBOOK_MCP_LICENSE` env var (store in `.env.local`) or passed as arg. Free tier: basic stories, max 10 components (`FREE_TIER_MAX_SYNC`). Pro tier: all templates, tests, docs, CodeConnect, unlimited sync. Upgrade at `https://polar.sh/forgekit`. Cache at `~/.storybook-mcp/license-cache.json` (24h TTL).

## Build & Development

```bash
npm run build          # tsup → dist/ (ESM only, src/index.ts + src/cli.ts entry points)
npm run dev            # tsup --watch
npm test               # vitest run (tests in src/__tests__/ and src/utils/__tests__/)
npm run test:watch     # vitest interactive
npm run typecheck      # tsc --noEmit
npm run release:patch  # bump patch + build + npm publish + git push + tags
```

- **Bundler**: tsup, ESM-only output, generates `.d.ts`
- **Tests**: vitest with `globals: false`; use named imports (`describe`, `it`, `expect` from `vitest`); test fixtures use `fs.mkdtempSync` + `afterAll` cleanup
- **Release guard**: `prerelease` script enforces a clean git working tree before any publish (`git diff --exit-code`); commit all changes before running `release:patch`
- **Docs**: run `npm run docs:generate` after adding/changing tool schemas; updates `docs/api-reference/` via `scripts/generate-docs.ts`; preview locally with `npm run docs:dev` (Mintlify)

## Code Conventions

- **ESM imports**: always use `.js` extension (`import { foo } from './utils/scanner.js'`)—required even for `.ts` source files
- **Types**: all interfaces in `src/types.ts`, re-exported from `src/index.ts`; never define inline
- **Constants**: all hardcoded values (limits, filenames, patterns, URLs) in `src/utils/constants.ts`—never inline them
- **Errors**: throw `StorybookMCPError` with an `ErrorCode` from `src/utils/errors.ts`; tool handlers in `index.ts` catch and return `{ isError: true }` MCP responses—never let exceptions propagate
- **Config threading**: `StorybookMCPConfig` is the first argument of every tool and utility function
- **Logging**: `console.error()` only—stdout is reserved for MCP JSON-RPC protocol
- **Pure utils**: `story-merger.ts` is intentionally free of all disk I/O—every export is a pure string→string transform; follow this pattern for new generation helpers so they stay testable without temp dirs
- **Package versions**: keep all `dependencies` and `devDependencies` on their latest compatible releases; version mismatches that break `npm install` are not acceptable
- **No stale code**: remove dead exports, unused imports, and zombie variables whenever touching a file

## Story Merge Pattern

`update_story` preserves user edits via these steps:
1. `generateStory()` produces a fresh template string (no disk read)
2. `parseStoryExports(existing)` finds all `export const X: Story` names in the on-disk file
3. `mergeStories(generated, existing)` appends user-added exports (absent from the template) after a `// --- User Stories ---` separator
4. Result is written; `recordStoryVersion()` saves a history entry to `.forgekit/story-history.json` (max 10 per story)

## Adding a New MCP Tool

1. Define schema in `index.ts` → `ListToolsRequestSchema` handler
2. Add `export async function myTool(config, args)` in `tools.ts` returning `{ ..., summary: string }`
3. Add `case 'my_tool':` in the `CallToolRequestSchema` switch in `index.ts`
4. Add core logic in appropriate `utils/*.ts` file
5. Gate pro features with `validateLicense(config)` + `requireFeature(license, 'featureName')`

## Framework-Aware Generation

`framework` config (`chakra | shadcn | tamagui | gluestack | react-native | vanilla | custom`) affects:
- Story decorators/providers → `generator.ts`: `getFrameworkDecorator()`
- Setup bootstrapping → `setup.ts`: preview files, dependency lists
- Analysis suggestions → `scanner.ts`

Always handle all framework branches when modifying generation logic.

## Key Files by Task

| Task | Files |
|------|-------|
| Add MCP tool | `src/index.ts`, `src/tools.ts`, `src/utils/*.ts` |
| Change story output | `src/utils/generator.ts`, `src/utils/templates.ts` |
| Modify component scanning | `src/utils/scanner.ts` |
| Shared constants | `src/utils/constants.ts` |
| Startup / file watching | `src/cli.ts`, `src/utils/initializer.ts` |
| Framework support | `src/utils/setup.ts`, `src/utils/generator.ts`, `src/utils/scanner.ts` |
| Figma Code Connect | `src/utils/code-connect-generator.ts` |
| Story merge / preserve user edits | `src/utils/story-merger.ts` |
| Hardcoded values | `src/utils/constants.ts` |
