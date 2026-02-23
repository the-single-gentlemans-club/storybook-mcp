# forgekit-storybook-mcp

<div align="center">

**⚡ Pro License — ~~$49~~ $29 launch price** | Unlimited sync • All templates • Test & docs generation

[**Get Pro →**](https://buy.polar.sh/polar_cl_Tnd3ryKUJpYPnXF0kBW1KFHQnoLlxAq2cz9GL3Et0dV) · [npm](https://npmjs.com/package/forgekit-storybook-mcp) · [GitHub](https://github.com/effinrich/storybook-mcp-v2)

[![npm version](https://img.shields.io/npm/v/forgekit-storybook-mcp)](https://npmjs.com/package/forgekit-storybook-mcp)
[![downloads](https://img.shields.io/npm/dm/forgekit-storybook-mcp)](https://npmjs.com/package/forgekit-storybook-mcp)

</div>

---

## License & Pricing

**This tool follows a "Free for Basic / Paid for Pro" model.**

### Free Tier

Perfect for individuals and trying out the tool.

- ✅ List and analyze components
- ✅ Generate basic stories (`basic` template)
- ✅ **Test generation** (Playwright/Vitest)
- ✅ **Docs generation** (MDX)
- ✅ Sync up to 10 components per run
- ✅ `.env` / `.env.local` license key loading
- ❌ Advanced templates (`with-msw`, `form`, `with-router`, etc.)
- ❌ Unlimited sync (beyond 10 components)
- ❌ `update_story` (smart merge regeneration)
- ❌ Figma Code Connect generation

### Pro Tier — ~~$49~~ $29 (Launch Price · Lifetime License)

For professional teams requiring complete coverage.

- ✅ **Unlimited** sync (no component cap)
- ✅ **All** advanced templates (Interactive, MSW, Router, Form, etc.)
- ✅ **`update_story`** — smart merge regeneration (preserves your custom exports)
- ✅ **Figma Code Connect** generation
- ✅ Priority support
- ✅ Lifetime updates — no subscription

**[👉 Get Pro License](https://buy.polar.sh/polar_cl_Tnd3ryKUJpYPnXF0kBW1KFHQnoLlxAq2cz9GL3Et0dV)**

### Activation

**Option 1: Config file**

Add to `storybook-mcp.config.json`:

```json
{
  "licenseKey": "your-polar-license-key"
}
```

**Option 2: Environment variable**

```bash
export STORYBOOK_MCP_LICENSE=your-polar-license-key
```

License keys are UUID format, issued by Polar.sh when you purchase.

---

A **Model Context Protocol (MCP) server** for Storybook story generation, component analysis, and validation.

**Auto-detects** Chakra UI, shadcn/ui, Tamagui, and Gluestack UI. Works with any React project — unrecognized frameworks use vanilla defaults.

---

## 🎉 What's New in v0.12

### 🔑 License detection overhaul
- **`.env` / `.env.local` support** — `STORYBOOK_MCP_LICENSE` is now loaded automatically from the project root, no shell export required. `.env.local` takes priority over `.env`; both are overridden by a system env var or MCP client config.
- **`--reset-license` flag** — clears the 24-hour Polar API cache and forces a fresh validation. Essential escape hatch when a key was previously rejected due to a network hiccup.
- **Actionable error messages** — validation failures now log the exact reason (HTTP status, `status=revoked`, `expired`, network timeout) instead of a silent fallback to Free tier.
- **Fixed `console.log` stdout corruption** — success message was writing to stdout (the MCP JSON-RPC channel), which could silently break tool responses. Moved to `console.error`.

### 📦 Tests & Docs unlocked for Free tier
- `generate_test`, `generate_docs`, and `sync_all` with tests/docs now work without a Pro license.
- Pro retains: unlimited sync, all advanced templates, `update_story`, and Figma Code Connect.

### 🗂 Config file auto-generation
- **`storybook-mcp.config.json` is now created automatically** on first run if it doesn't exist — populated with auto-detected framework and library paths.
- `--setup` always writes/refreshes the config file after bootstrapping `.storybook/`.
- Existing `package.json#storybook-mcp` configs are **migrated** to the standalone file automatically.

### 👁 Background file watching
- **Live sync** — the server now watches all configured library directories with `fs.watch({ recursive })` and re-syncs any changed component within 500 ms (debounced).
- **Periodic catch-up rescan** every 30 seconds covers events missed by `fs.watch` (Linux kernel limitations, network drives, bulk renames).
- New `--no-watch` flag to disable watching (useful in CI or `--init-only` pipelines).
- Clean shutdown on `SIGINT` / `SIGTERM` — watchers and timers are always closed.

### ⚡ Performance & reliability
- **Concurrent sync** — components are processed in parallel batches of 5, making large repos significantly faster on startup.
- **Atomic cache writes** — cache file is written to `.tmp` then renamed, preventing corruption on crash or kill signal.
- **Stale cache pruning** — deleted components are removed from the hash cache automatically.
- **`syncSingleComponent` deep copy fix** — shallow `{ ...cache }` was sharing inner object references, allowing mutations to corrupt the old cache state.

**Upgrading from 0.11.x?** Run `npm install forgekit-storybook-mcp@latest`. No breaking changes. See [CHANGELOG](./CHANGELOG.md) for full details.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Prerequisites](#prerequisites)
- [Key Feature: Auto-Sync on Startup](#key-feature-auto-sync-on-startup)
- [Installation](#installation)
- [Configuration](#configuration)
- [CLI Flags](#cli-flags)
- [MCP Client Setup](#mcp-client-setup)
- [Tools Reference](#tools-reference)
- [Figma Integration](#figma-integration)
- [Templates](#templates)
- [Resources](#resources)
- [Programmatic Usage](#programmatic-usage)
- [Roadmap](#roadmap)
- [Related Projects](#related-projects)

---

## Quick Start

```bash
# 1. Install the package
npm install forgekit-storybook-mcp

# 2. Create storybook-mcp.config.json in your project root (see Configuration)

# 3. Add to your MCP client (see MCP Client Setup below)
```

---

## Prerequisites

Before installing, make sure your project has Storybook and its core dependencies set up.

### Storybook

If you don't have Storybook yet:

```bash
npx storybook@latest init
```

This scaffolds the `.storybook/` config directory, installs core packages, and adds example stories. **Requires Storybook 10.2+.** Earlier versions are not supported.

### Required Packages

- `node` ≥ 20
- `react` ≥ 18
- `react-dom` ≥ 18
- `storybook` ≥ 10.2
- `@storybook/react` ≥ 10.2
- `@storybook/react-vite` ≥ 10.2 (or `@storybook/react-webpack5` if using Webpack)

Install the core Storybook packages:

```bash
npm i -D storybook@^10.2.0 @storybook/react@^10.2.0 @storybook/react-vite@^10.2.0
```

### Recommended Addons

Some templates and features work best with these addons installed:

| Addon | Used By | Install |
|-------|---------|---------|
| `storybook/test` | Interactive templates, play functions | Included with `storybook@10+` |
| `@storybook/addon-vitest` | Testing (Vite projects) | `npm i -D @storybook/addon-vitest` |
| `@storybook/addon-a11y` | Accessibility story generation | `npm i -D @storybook/addon-a11y` |
| `msw` + `msw-storybook-addon` | `with-msw` template | `npm i -D msw msw-storybook-addon` |
| `@storybook/addon-interactions` | Interaction testing panel | `npm i -D @storybook/addon-interactions` |

You don't need all of these upfront — the MCP will work without them and will suggest what to install when a template requires a missing dependency.

---

## Key Feature: Auto-Sync on Startup

When the MCP server starts, it automatically:

1. **Scans** all components in configured libraries
2. **Creates** missing stories, tests, and MDX docs
3. **Updates** existing files when components have changed
4. **Caches** component hashes for efficient change detection

This means your Storybook documentation stays in sync with your components automatically.

---

## Installation

```bash
npm install forgekit-storybook-mcp
# or
pnpm add forgekit-storybook-mcp
# or
yarn add forgekit-storybook-mcp
```

---

## Configuration

You have three options for configuration, in order of priority:

### Option 1: Config File (Recommended)

Create `storybook-mcp.config.json` in your project root:

```json
{
  "framework": "chakra",
  "libraries": [
    {
      "name": "ui",
      "path": "libs/ui/src",
      "storyTitlePrefix": "UI",
      "importAlias": "@ui"
    },
    {
      "name": "shared",
      "path": "libs/shared/src",
      "storyTitlePrefix": "Shared",
      "decorators": ["withRouter"]
    }
  ],
  "storyFilePattern": "**/*.stories.{ts,tsx}",
  "componentPatterns": [
    "**/src/**/*.tsx",
    "!**/*.stories.tsx",
    "!**/*.test.tsx"
  ],
  "excludePatterns": ["**/node_modules/**", "**/dist/**"]
}
```

### Option 2: package.json

Add a `storybook-mcp` field to your `package.json`:

```json
{
  "name": "my-app",
  "storybook-mcp": {
    "framework": "shadcn",
    "libraries": [
      {
        "name": "components",
        "path": "src/components",
        "storyTitlePrefix": "Components"
      }
    ]
  }
}
```

### Option 3: Auto-Detection

If no config is found, the MCP will auto-detect:

- **Component directories**: `src/components`, `libs/ui/src`, `packages/ui/src`, etc.
- **Framework**: Detected from your `package.json` dependencies (Chakra, shadcn, Tamagui, Gluestack)

### Configuration Reference

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `rootDir` | `string` | Auto-detected | Project root directory |
| `framework` | `string` | `'vanilla'` | UI framework: `'chakra'`, `'shadcn'`, `'tamagui'`, `'gluestack'`, `'vanilla'` |
| `libraries` | `array` | `[]` | Component library locations (see below) |
| `storyFilePattern` | `string` | `'**/*.stories.{ts,tsx}'` | Glob pattern for story files |
| `componentPatterns` | `string[]` | `['**/src/**/*.tsx', '!**/*.stories.tsx', '!**/*.test.tsx']` | Glob patterns for component files |
| `excludePatterns` | `string[]` | `['**/node_modules/**', '**/dist/**']` | Directories to exclude |
| `licenseKey` | `string` | - | Pro license key |
| `templatesDir` | `string` | - | Custom templates directory |
| `storybookVersion` | `number` | `10` | Storybook version (10+ required) |

### Library Configuration

Each library in the `libraries` array supports:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | ✅ | Library identifier for filtering |
| `path` | `string` | ✅ | Path relative to `rootDir` |
| `storyTitlePrefix` | `string` | ✅ | Prefix for Storybook titles (e.g., `"UI"` → `"UI/Button"`) |
| `decorators` | `string[]` | - | Default decorators to apply to all stories |
| `importAlias` | `string` | - | Import path alias (e.g., `"@ui"`) |

---

## CLI Flags

```bash
# Run with auto-sync (default behavior)
npx forgekit-storybook-mcp

# Skip auto-sync on startup - useful when you just want the MCP tools
npx forgekit-storybook-mcp --skip-init

# Preview what would be synced without writing any files
npx forgekit-storybook-mcp --dry-run

# Only run sync, then exit (useful for CI pipelines)
npx forgekit-storybook-mcp --init-only

# Disable specific generators during sync
npx forgekit-storybook-mcp --no-stories    # Don't generate story files
npx forgekit-storybook-mcp --no-tests      # Don't generate test files
npx forgekit-storybook-mcp --no-docs       # Don't generate MDX docs

# Only create missing files, don't update existing ones
npx forgekit-storybook-mcp --no-update

# Force overwrite existing story/test/doc files
npx forgekit-storybook-mcp --force

# Only sync a specific library (must match library.name in config)
npx forgekit-storybook-mcp --lib=ui

# Run interactive setup wizard (creates storybook-mcp.config.json)
npx forgekit-storybook-mcp --setup
```

### Combining Flags

```bash
# CI pipeline: sync stories only, exit when done
npx forgekit-storybook-mcp --init-only --no-tests --no-docs

# Development: skip sync, just run the MCP server
npx forgekit-storybook-mcp --skip-init

# Preview: see what would change without modifying files
npx forgekit-storybook-mcp --dry-run --no-update

# Force-regenerate only the ui library, then exit
npx forgekit-storybook-mcp --init-only --force --lib=ui
```

---

## MCP Client Setup

### Cursor / VS Code

Add to `.cursor/mcp.json` (or `.vscode/mcp.json`):

```json
{
  "mcpServers": {
    "forgekit-storybook": {
      "command": "npx",
      "args": ["forgekit-storybook-mcp"]
    }
  }
}
```

With CLI flags:

```json
{
  "mcpServers": {
    "forgekit-storybook": {
      "command": "npx",
      "args": ["forgekit-storybook-mcp", "--skip-init"]
    }
  }
}
```

If installed locally (faster startup):

```json
{
  "mcpServers": {
    "forgekit-storybook": {
      "command": "node",
      "args": ["node_modules/forgekit-storybook-mcp/dist/cli.js"]
    }
  }
}
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "forgekit-storybook": {
      "command": "npx",
      "args": ["forgekit-storybook-mcp"],
      "cwd": "/path/to/your/project"
    }
  }
}
```

---

## Tools Reference

| Tool | Description | Tier |
|------|-------------|------|
| [`list_components`](#list_components) | List all React components, filter by library or story status | Free |
| [`analyze_component`](#analyze_component) | Extract props, dependencies, and get story suggestions | Free |
| [`generate_story`](#generate_story) | Generate complete story files with variants and tests | Free (basic) / Pro |
| [`update_story`](#update_story) | Regenerate a story while preserving your custom exports | Pro |
| [`generate_test`](#generate_test) | Generate Vitest or Playwright test files | Pro |
| [`generate_docs`](#generate_docs) | Generate MDX documentation | Pro |
| [`generate_code_connect`](#generate_code_connect) | Generate Figma Code Connect `.figma.tsx` files | Pro |
| [`validate_story`](#validate_story) | Check stories for best practices and issues | Free |
| [`sync_all`](#sync_all) | Sync all components at once | Free (10 limit) / Pro |
| [`sync_component`](#sync_component) | Sync a single component's story/test/docs | Free |
| [`get_story_template`](#get_story_template) | Get a specific template | Free |
| [`list_templates`](#list_templates) | List all available templates | Free |
| [`get_component_coverage`](#get_component_coverage) | Get story coverage statistics | Free |
| [`suggest_stories`](#suggest_stories) | Get prioritized list of components needing stories | Free |
| [`check_health`](#check_health) | Check Storybook installation health | Free |

---

### `list_components`

List all React components in configured libraries.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `library` | `string` | - | all | Filter by library name |
| `hasStory` | `boolean` | - | all | Filter by story status: `true` = only with stories, `false` = only without |

**Examples:**

```json
// List ALL components across all libraries
{}

// List only components in the "ui" library
{
  "library": "ui"
}

// List components that DON'T have stories yet
{
  "hasStory": false
}

// List components in "shared" library that need stories
{
  "library": "shared",
  "hasStory": false
}
```

**Response:**

```json
{
  "components": [
    {
      "name": "Button",
      "filePath": "libs/ui/src/button/button.tsx",
      "library": "ui",
      "hasStory": false,
      "exportType": "named"
    },
    {
      "name": "Card",
      "filePath": "libs/ui/src/card/card.tsx",
      "library": "ui",
      "hasStory": true,
      "storyPath": "libs/ui/src/card/card.stories.tsx",
      "exportType": "default"
    }
  ],
  "total": 2,
  "withStories": 1,
  "withoutStories": 1,
  "summary": "Found 2 components: 1 with stories, 1 without stories"
}
```

---

### `analyze_component`

Analyze a React component to extract its structure, props, and dependencies.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `componentPath` | `string` | ✅ | Path to the component file |

**Example:**

```json
{
  "componentPath": "libs/ui/src/button/button.tsx"
}
```

**Response:**

```json
{
  "analysis": {
    "name": "Button",
    "filePath": "libs/ui/src/button/button.tsx",
    "library": "ui",
    "hasStory": false,
    "exportType": "named",
    "props": [
      {
        "name": "variant",
        "type": "'solid' | 'outline' | 'ghost'",
        "required": false,
        "defaultValue": "'solid'",
        "description": "Visual style variant",
        "controlType": "select",
        "controlOptions": ["solid", "outline", "ghost"]
      },
      {
        "name": "size",
        "type": "'sm' | 'md' | 'lg'",
        "required": false,
        "defaultValue": "'md'",
        "controlType": "select",
        "controlOptions": ["sm", "md", "lg"]
      },
      {
        "name": "disabled",
        "type": "boolean",
        "required": false,
        "defaultValue": "false",
        "controlType": "boolean"
      },
      {
        "name": "children",
        "type": "ReactNode",
        "required": true,
        "controlType": "text"
      }
    ],
    "dependencies": {
      "usesRouter": false,
      "usesReactQuery": false,
      "usesChakra": true,
      "usesGluestack": false,
      "usesReactNative": false,
      "usesEmotion": false,
      "usesTailwind": false,
      "usesFramerMotion": true,
      "usesMSW": false,
      "usesGlobalState": false,
      "otherImports": ["@chakra-ui/react", "framer-motion"]
    },
    "suggestions": [
      "Use 'with-variants' template to showcase all size/variant combinations",
      "Add Framer Motion decorator for animation testing",
      "Consider adding interactive tests for click/focus states"
    ],
    "sourcePreview": "export const Button = ({ variant = 'solid', size = 'md', ... }) => { ... }"
  },
  "summary": "Analyzed Button: 4 props, no story",
  "recommendations": [
    "Use 'with-variants' template to showcase all size/variant combinations",
    "Add Framer Motion decorator for animation testing"
  ]
}
```

---

### `generate_story`

Generate a Storybook story file for a component.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `componentPath` | `string` | ✅ | - | Path to the component file |
| `includeVariants` | `boolean` | - | `true` | Add stories showcasing all size/variant combinations |
| `includeInteractive` | `boolean` | - | `true` | Add play function tests for user interactions |
| `includeA11y` | `boolean` | - | `false` | Add accessibility test story |
| `includeResponsive` | `boolean` | - | `false` | Add mobile/tablet/desktop viewport stories |
| `template` | `string` | - | auto | Template to use (see [Templates](#templates)) |
| `overwrite` | `boolean` | - | `false` | Replace existing story file |
| `dryRun` | `boolean` | - | `false` | Preview without writing to disk |

**Examples:**

```json
// Basic: generate with defaults (variants + interactive)
{
  "componentPath": "libs/ui/src/button/button.tsx"
}

// Minimal: just the basic story, no extras
{
  "componentPath": "libs/ui/src/button/button.tsx",
  "includeVariants": false,
  "includeInteractive": false
}

// Full coverage: everything including a11y and responsive
{
  "componentPath": "libs/ui/src/button/button.tsx",
  "includeVariants": true,
  "includeInteractive": true,
  "includeA11y": true,
  "includeResponsive": true
}

// Use a specific template
{
  "componentPath": "libs/ui/src/user-list/user-list.tsx",
  "template": "with-msw"
}

// Preview what would be generated
{
  "componentPath": "libs/ui/src/button/button.tsx",
  "dryRun": true
}

// Replace an existing story
{
  "componentPath": "libs/ui/src/button/button.tsx",
  "overwrite": true
}
```

**Response:**

```json
{
  "story": {
    "content": "import type { Meta, StoryObj } from '@storybook/react'\nimport { Button } from './Button'\n\nconst meta: Meta<typeof Button> = {\n  title: 'Components/Button',\n  component: Button,\n  tags: [],\n  ...\n}\n\nexport default meta\ntype Story = StoryObj<typeof Button>\n\nexport const Default: Story = { ... }\nexport const Sizes: Story = { ... }\nexport const Variants: Story = { ... }",
    "filePath": "libs/ui/src/button/button.stories.tsx",
    "imports": ["@storybook/react", "./Button"],
    "stories": ["Default", "Sizes", "Variants", "ClickTest"],
    "warnings": []
  },
  "written": true,
  "path": "libs/ui/src/button/button.stories.tsx",
  "summary": "Created story at libs/ui/src/button/button.stories.tsx"
}
```

---

### `generate_test`

Generate a test file for a component. Uses vitest + @testing-library by default. Uses Playwright only if `@playwright/test` is in your project's dependencies. **(Pro only)**

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `componentPath` | `string` | ✅ | - | Path to the component file |
| `overwrite` | `boolean` | - | `false` | Replace existing test file |
| `dryRun` | `boolean` | - | `false` | Preview without writing to disk |

**Examples:**

```json
// Generate test for a component
{
  "componentPath": "libs/ui/src/button/button.tsx"
}

// Preview without writing
{
  "componentPath": "libs/ui/src/button/button.tsx",
  "dryRun": true
}

// Replace existing test
{
  "componentPath": "libs/ui/src/button/button.tsx",
  "overwrite": true
}
```

**Response:**

```json
{
  "test": {
    "content": "import { describe, it, expect } from 'vitest'\nimport { render, screen } from '@testing-library/react'\nimport { Button } from './Button'\n\ndescribe('Button', () => {\n  it('renders correctly', () => {\n    render(<Button>Click me</Button>)\n    expect(screen.getByText('Click me')).toBeInTheDocument()\n  })\n})\n...",
    "filePath": "libs/ui/src/button/button.test.tsx"
  },
  "written": true,
  "path": "libs/ui/src/button/button.test.tsx",
  "summary": "Created test at libs/ui/src/button/button.test.tsx"
}
```

---

### `generate_docs`

Generate MDX documentation for a component. **(Pro only)**

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `componentPath` | `string` | ✅ | - | Path to the component file |
| `overwrite` | `boolean` | - | `false` | Replace existing docs file |
| `dryRun` | `boolean` | - | `false` | Preview without writing to disk |

**Examples:**

```json
// Generate docs for a component
{
  "componentPath": "libs/ui/src/button/button.tsx"
}

// Preview without writing
{
  "componentPath": "libs/ui/src/button/button.tsx",
  "dryRun": true
}
```

**Response:**

```json
{
  "docs": {
    "content": "import { Canvas, Meta, ArgTypes } from '@storybook/blocks'\nimport * as ButtonStories from './Button.stories'\n\n<Meta of={ButtonStories} />\n\n# Button\n\n## Usage\n\n<Canvas of={ButtonStories.Default} />\n\n## Props\n\n<ArgTypes of={ButtonStories} />\n...",
    "filePath": "libs/ui/src/button/button.mdx"
  },
  "written": true,
  "path": "libs/ui/src/button/button.mdx",
  "summary": "Created docs at libs/ui/src/button/button.mdx"
}
```

---

### `validate_story`

Validate an existing story file for best practices and issues.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `storyPath` | `string` | ✅ | Path to the story file |

**Example:**

```json
{
  "storyPath": "libs/ui/src/button/button.stories.tsx"
}
```

**Response:**

```json
{
  "validation": {
    "valid": false,
    "score": 72,
    "errors": [
      {
        "type": "error",
        "code": "MISSING_META_TITLE",
        "message": "Story is missing a title in meta",
        "line": 5,
        "fix": "Add 'title' property to meta object"
      }
    ],
    "warnings": [],
    "suggestions": [
      {
        "type": "suggestion",
        "code": "ADD_PLAY_FUNCTION",
        "message": "Consider adding interaction tests with play functions",
        "fix": "Add a story with a play function for testing user interactions"
      }
    ]
  },
  "summary": "Story has 1 errors (score: 72/100)"
}
```

---

### `sync_all`

Sync all components - create missing stories/tests/docs and update changed ones.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `library` | `string` | - | all | Only sync components in this library |
| `generateStories` | `boolean` | - | `true` | Generate story files |
| `generateTests` | `boolean` | - | `true` | Generate test files (Pro only) |
| `generateDocs` | `boolean` | - | `true` | Generate MDX docs (Pro only) |
| `updateExisting` | `boolean` | - | `true` | Update files when components change |
| `dryRun` | `boolean` | - | `false` | Preview without writing to disk |

**Examples:**

```json
// Sync everything with defaults
{}

// Sync only the "ui" library
{
  "library": "ui"
}

// Only generate stories, no tests or docs
{
  "generateStories": true,
  "generateTests": false,
  "generateDocs": false
}

// Only create missing files, don't update existing
{
  "updateExisting": false
}

// Preview what would change
{
  "dryRun": true
}

// Sync only stories for "shared" library, don't update existing
{
  "library": "shared",
  "generateStories": true,
  "generateTests": false,
  "generateDocs": false,
  "updateExisting": false
}
```

**Response:**

```json
{
  "scanned": 24,
  "created": {
    "stories": 8,
    "tests": 8,
    "docs": 8
  },
  "updated": {
    "stories": 3,
    "tests": 2,
    "docs": 3
  },
  "skipped": 0,
  "errors": [],
  "summary": "Synced 24 components: Created 8 stories, 8 tests, 8 docs. Updated 8 files."
}
```

---

### `sync_component`

Sync a single component's story, test, and docs.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `componentPath` | `string` | ✅ | - | Path to the component file |
| `generateStories` | `boolean` | - | `true` | Generate story file |
| `generateTests` | `boolean` | - | `true` | Generate test file (Pro only) |
| `generateDocs` | `boolean` | - | `true` | Generate MDX docs (Pro only) |
| `dryRun` | `boolean` | - | `false` | Preview without writing to disk |

**Examples:**

```json
// Sync everything for one component
{
  "componentPath": "libs/ui/src/button/button.tsx"
}

// Only sync the story, not tests or docs
{
  "componentPath": "libs/ui/src/button/button.tsx",
  "generateStories": true,
  "generateTests": false,
  "generateDocs": false
}

// Preview what would change
{
  "componentPath": "libs/ui/src/button/button.tsx",
  "dryRun": true
}
```

**Response:**

```json
{
  "result": {
    "component": "Button",
    "story": {
      "action": "created",
      "path": "libs/ui/src/button/button.stories.tsx"
    },
    "test": {
      "action": "created",
      "path": "libs/ui/src/button/button.test.tsx"
    },
    "docs": {
      "action": "skipped",
      "path": "libs/ui/src/button/button.mdx",
      "reason": "Already exists and unchanged"
    }
  },
  "summary": "Button: story: created, test: created"
}
```

---

### `get_story_template`

Get a specific template by name.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `template` | `string` | ✅ | Template name (see [Templates](#templates)) |

**Example:**

```json
{
  "template": "with-msw"
}
```

**Response:**

```json
{
  "template": {
    "name": "with-msw",
    "description": "Story with MSW API mocking",
    "useCase": "Components that fetch data and need mocked API responses",
    "content": "import type { Meta, StoryObj } from '@storybook/react'\nimport { http, HttpResponse } from 'msw'\nimport { {{ComponentName}} } from './{{ComponentName}}'\n\nconst meta: Meta<typeof {{ComponentName}}> = {\n  title: 'Components/{{ComponentName}}',\n  component: {{ComponentName}},\n  tags: [],\n}\n\nexport default meta\ntype Story = StoryObj<typeof {{ComponentName}}>\n\nexport const Default: Story = {\n  parameters: {\n    msw: {\n      handlers: [\n        http.get('/api/data', () => {\n          return HttpResponse.json({\n            items: [\n              { id: 1, name: 'Item 1' },\n            ],\n          })\n        }),\n      ],\n    },\n  },\n}\n...",
    "placeholders": ["ComponentName", "component-name"]
  },
  "usage": "Replace placeholders: ComponentName, component-name"
}
```

---

### `list_templates`

List all available story templates.

**Parameters:** None

**Example:**

```json
{}
```

**Response:**

```json
{
  "templates": [
    {
      "name": "basic",
      "description": "Simple story with basic args",
      "useCase": "Quick component documentation with minimal setup",
      "available": true
    },
    {
      "name": "with-controls",
      "description": "Story with full argTypes controls (Pro Only)",
      "useCase": "Interactive component exploration with all props exposed",
      "available": false
    },
    {
      "name": "with-variants",
      "description": "Story showcasing all variants and sizes (Pro Only)",
      "useCase": "Design system documentation showing all visual options",
      "available": false
    }
  ],
  "count": 8,
  "tier": "free"
}
```

---

### `get_component_coverage`

Get story coverage statistics for the project.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `library` | `string` | - | all | Filter by library name |

**Examples:**

```json
// Coverage for entire project
{}

// Coverage for "ui" library only
{
  "library": "ui"
}
```

**Response:**

```json
{
  "total": 24,
  "withStories": 16,
  "withoutStories": 8,
  "coverage": "67%",
  "byLibrary": {
    "ui": {
      "total": 15,
      "withStories": 12
    },
    "shared": {
      "total": 9,
      "withStories": 4
    }
  },
  "componentsNeedingStories": [
    {
      "name": "Tooltip",
      "path": "libs/ui/src/tooltip/tooltip.tsx",
      "library": "ui"
    },
    {
      "name": "DataTable",
      "path": "libs/shared/src/data-table/data-table.tsx",
      "library": "shared"
    }
  ]
}
```

---

### `suggest_stories`

Get a prioritized list of components that need stories.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | `number` | - | `10` | Max number of suggestions |
| `library` | `string` | - | all | Filter by library name |

**Examples:**

```json
// Get top 10 suggestions
{}

// Get top 5 suggestions from "ui" library
{
  "limit": 5,
  "library": "ui"
}
```

**Response:**

```json
{
  "suggestions": [
    {
      "component": "Button",
      "path": "libs/ui/src/button/button.tsx",
      "library": "ui",
      "command": "generate_story with componentPath: \"libs/ui/src/button/button.tsx\""
    },
    {
      "component": "Card",
      "path": "libs/ui/src/card/card.tsx",
      "library": "ui",
      "command": "generate_story with componentPath: \"libs/ui/src/card/card.tsx\""
    }
  ],
  "total": 8,
  "showing": 2,
  "summary": "8 components without stories. Showing top 2."
}
```

---

### `check_health`

Check Storybook installation health — missing packages, outdated configs, and version mismatches. Useful for diagnosing setup issues, especially when migrating to Storybook 10.

**Parameters:** None

**Example:**

```json
{}
```

**Response:**

```json
{
  "passed": false,
  "checks": [
    { "name": "package:storybook", "status": "pass", "message": "storybook is installed" },
    { "name": "config:main:addon:@storybook/addon-essentials", "status": "warn", "message": "@storybook/addon-essentials is bundled into storybook in v10 — can be removed from addons list", "fix": "Remove '@storybook/addon-essentials' from addons array in .storybook/main" }
  ],
  "installCommands": [],
  "summary": "Preflight: 1 warning(s) out of 8 checks"
}
```

---

### `update_story`

> **Pro feature.** Regenerate a story file using the latest component analysis while preserving any exports you have written by hand.

Unlike `generate_story` with `overwrite: true` (which clobbers everything), `update_story` detects which `export const X: Story` blocks you added and appends them below the regenerated content, separated by a comment marker.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `componentPath` | string | required | Path to the component file |
| `includeVariants` | boolean | `true` | Regenerate variant stories |
| `includeInteractive` | boolean | `true` | Regenerate play function tests |
| `includeA11y` | boolean | `false` | Regenerate accessibility stories |
| `includeResponsive` | boolean | `false` | Regenerate viewport stories |
| `template` | string | auto | Specific template to use |
| `dryRun` | boolean | `false` | Preview merged result without writing |

**Example:**

```json
{
  "componentPath": "src/components/Button.tsx"
}
```

**Response includes:**

- `preserved` — array of user-written story names that were kept
- `removed` — stories not in the merged output (usually empty)
- `validation.warnings` — non-blocking import warnings
- `summary` — human-readable result with list of preserved stories

**How it works:**

The tool looks for `export const X: Story` blocks that are not in the freshly generated content. Those are your custom stories. They get appended after a separator:

```tsx
// ─── User-added stories (preserved by update_story) ───
export const MyEdgeCase: Story = {
  args: { label: 'Edge case' },
}
```

> **Note:** A version entry is recorded in `.forgekit/story-history.json` on every write (action: `merged`).

---

### `generate_code_connect`

> **Pro feature.** Generate a `@figma/code-connect` `.figma.tsx` file that links your component to Figma Dev Mode.

When published with `npx figma connect publish`, designers inspecting your component in Figma see your real React code — props, variants, and usage examples — instead of auto-generated snippets.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `componentPath` | string | required | Path to the component file |
| `figmaNodeUrl` | string | — | Figma component URL (`https://figma.com/design/<fileId>/...?node-id=...`). Omit to use a placeholder. |
| `overwrite` | boolean | `false` | Replace existing `.figma.tsx` file |
| `dryRun` | boolean | `false` | Preview output without writing |

**Example:**

```json
{
  "componentPath": "src/components/Button.tsx",
  "figmaNodeUrl": "https://figma.com/design/abc123/MyDesignSystem?node-id=1%3A2"
}
```

**Prop type mapping:**

| TypeScript type | Figma binding |
|-----------------|---------------|
| `string` | `figma.string('PropName')` |
| `boolean` | `figma.boolean('PropName')` |
| `'a' \| 'b'` union | `figma.enum('PropName', { a: 'a', b: 'b' })` |
| `ReactNode` / `children` | `figma.children(['*'])` |
| `number` | `figma.number('PropName')` |

Event handlers, `className`, `style`, and `ref` are excluded automatically.

**Generated output** (`src/components/Button.figma.tsx`):

```tsx
import figma from '@figma/code-connect/react'
import { Button } from './Button'

figma.connect(Button, 'https://figma.com/design/abc123/MyDesignSystem?node-id=1%3A2', {
  props: {
    variant: figma.enum('Variant', {
      "primary": "primary",
      "secondary": "secondary",
      "ghost": "ghost",
    }),
    disabled: figma.boolean('Disabled'),
    children: figma.children(['*']),
  },
  example: ({ variant, disabled, children }) => (
    <Button variant={variant} disabled={disabled}>{children}</Button>
  ),
})
```

**Publishing to Figma:**

```bash
npm install --save-dev @figma/code-connect
npx figma connect login
npx figma connect publish
```

See [Figma Integration](#figma-integration) for the full workflow.

---

## Figma Integration

ForgeKit provides two complementary Figma integrations:

### Code Connect — link components to Figma Dev Mode

[Figma Code Connect](https://www.figma.com/developers/code-connect) attaches your real React component to a Figma component. Designers in Dev Mode see your actual props, variants, and a working code example instead of placeholder snippets.

**Workflow:**

1. Generate a Code Connect file for each component:

   ```json
   {
     "componentPath": "src/components/Button.tsx",
     "figmaNodeUrl": "https://figma.com/design/abc123/MyDesignSystem?node-id=1%3A2"
   }
   ```

2. Install and publish:

   ```bash
   npm install --save-dev @figma/code-connect
   npx figma connect login
   npx figma connect publish
   ```

3. Open the component in Figma → Dev Mode → Code panel. Your component code appears.

> **Tip:** Copy the Figma node URL by right-clicking a component on the canvas → "Copy link".

### Code to Canvas — push story renders into Figma (via `forgekit-context`)

The `sync_stories_to_figma` tool (part of [`forgekit-context`](https://npmjs.com/package/forgekit-context)) connects to the Figma desktop app's Dev Mode MCP server and pushes each component's Default story as an editable frame on your canvas.

**Requirements:**

- Figma desktop app (not browser)
- Dev Mode MCP server enabled: **Figma menu → Preferences → Enable Dev Mode MCP Server**
- `forgekit-context` installed and running
- Local Storybook running (`npm run storybook`)

**Example call via `forgekit-context`:**

```json
{
  "storybookUrl": "http://localhost:6006",
  "dryRun": true
}
```

Remove `dryRun` to push stories to the canvas.

---

## Templates

Templates are pre-built story structures for different use cases. Use them with the `template` parameter in `generate_story`.

| Template | Use Case | Example |
|----------|----------|---------|
| `basic` | Quick documentation, minimal setup | Simple presentational components |
| `with-controls` | Interactive exploration with all props | Design system components |
| `with-variants` | Showcase all sizes/variants | Buttons, badges, avatars |
| `with-msw` | Components that fetch data | User lists, dashboards |
| `with-router` | Components using React Router | Navigation, breadcrumbs |
| `page` | Full-page components | Landing pages, dashboards |
| `interactive` | Components with user interactions | Forms, modals, dropdowns |
| `form` | Form components with validation | Login forms, settings panels |

### Template Examples

**`basic`** - Minimal setup:

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import { Button } from './Button'

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  tags: [],
}

export default meta
type Story = StoryObj<typeof Button>

export const Default: Story = {
  args: {
    children: 'Button content',
  },
}
```

**`with-variants`** - Showcase all combinations:

```tsx
export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
}

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {(['solid', 'outline', 'ghost'] as const).map((variant) => (
        <div key={variant} style={{ display: 'flex', gap: '1rem' }}>
          <Button variant={variant} size="sm">Small</Button>
          <Button variant={variant} size="md">Medium</Button>
          <Button variant={variant} size="lg">Large</Button>
        </div>
      ))}
    </div>
  ),
}
```

**`with-msw`** - Mock API responses:

```tsx
import { http, HttpResponse } from 'msw'

export const Default: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/api/users', () => {
          return HttpResponse.json({
            users: [
              { id: 1, name: 'Alice' },
              { id: 2, name: 'Bob' },
            ],
          })
        }),
      ],
    },
  },
}

export const Loading: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/api/users', async () => {
          await new Promise((r) => setTimeout(r, 5000))
          return HttpResponse.json({})
        }),
      ],
    },
  },
}

export const Error: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/api/users', () => {
          return HttpResponse.json({ error: 'Failed' }, { status: 500 })
        }),
      ],
    },
  },
}
```

**`interactive`** - Play function tests:

```tsx
import { expect, userEvent, within } from 'storybook/test'

export const ClickTest: Story = {
  args: { children: 'Click me' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const button = canvas.getByText(/click me/i)

    await expect(button).toBeInTheDocument()
    await userEvent.click(button)
    // Add assertions for post-click state
  },
}

export const KeyboardNavigation: Story = {
  args: { children: 'Focus me' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const button = canvas.getByText(/focus me/i)

    await userEvent.tab()
    await expect(button).toHaveFocus()
    await userEvent.keyboard('{Enter}')
  },
}
```

---

## Resources

The MCP provides these read-only resources:

| Resource URI | Description |
|--------------|-------------|
| `storybook://libraries` | Configured library information |
| `storybook://patterns` | Common story patterns and best practices |
| `storybook://config` | Current MCP configuration |

---

## Programmatic Usage

You can also use the MCP server programmatically:

```typescript
import { createStorybookMCPServer } from 'forgekit-storybook-mcp'

const server = createStorybookMCPServer({
  rootDir: process.cwd(),
  framework: 'chakra',
  libraries: [
    {
      name: 'ui',
      path: 'src/components',
      storyTitlePrefix: 'UI',
      importAlias: '@ui',
    },
  ],
  storybookVersion: 10,
})

// Server is now ready to handle MCP requests
```

---

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for what's coming next — migration assistant, watch mode, Figma integration, and more.

---

## Related Projects

- [forgekit-figma-mcp](https://github.com/effinrich/forgekit-figma-mcp) — Figma design tokens → Chakra/Tailwind/Shadcn sync MCP
- [@storybook/addon-mcp](https://github.com/storybookjs/mcp) - Official Storybook MCP (reads stories)

This MCP focuses on **generating** stories, while the official one focuses on **reading** existing Storybook data. They complement each other.

---

## License

MIT
