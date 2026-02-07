# forgekit-storybook-mcp

A **Model Context Protocol (MCP) server** for Storybook story generation, component analysis, and validation.

**Framework-agnostic** — works with Chakra UI, shadcn/ui, Tamagui, Gluestack UI, React Native, or vanilla React.

## Key Feature: Auto-Sync on Startup

When the MCP server starts, it automatically:

1. **Scans** all components in configured libraries
2. **Creates** missing stories, tests, and MDX docs
3. **Updates** existing files when components have changed
4. **Caches** component hashes for efficient change detection

This means your Storybook documentation stays in sync with your components automatically.

## License & Pricing

**This tool follows a "Free for Basic / Paid for Pro" model.**

### Free Tier
Perfect for individuals and trying out the tool.
*   ✅ List and analyze components
*   ✅ Generate basic stories (`basic` template)
*   ✅ Sync up to 5 components per run
*   ❌ Advanced templates (`with-msw`, `form`, etc.)
*   ❌ Test generation (`generate_test`)
*   ❌ Docs generation (`generate_docs`)

### Pro Tier
For professional teams requiring complete coverage.
*   ✅ **Unlimited** sync
*   ✅ **All** templates (Interactive, MSW, Router, etc.)
*   ✅ **Test generation** (Playwright/Vitest)
*   ✅ **Docs generation** (MDX)
*   ✅ Priority support

### Activation
To activate Pro features, add your license key to the config:

```json
{
  "licenseKey": "FORGE-PRO-XXXX-XXXX"
}
```

Or set the environment variable:
```bash
STORYBOOK_MCP_LICENSE=FORGE-PRO-XXXX-XXXX
```

## Features

| Tool                     | Description                                                  |
| ------------------------ | ------------------------------------------------------------ |
| `list_components`        | List all React components, filter by library or story status |
| `analyze_component`      | Extract props, dependencies, and get story suggestions       |
| `generate_story`         | Generate complete story files with variants and tests        |
| `generate_test`          | Generate Playwright/Vitest test files                        |
| `generate_docs`          | Generate MDX documentation                                   |
| `validate_story`         | Check stories for best practices and issues                  |
| `sync_all`               | Manually trigger full sync of all components                 |
| `sync_component`         | Sync a single component's story/test/docs                    |
| `get_story_template`     | Get templates for different story types                      |
| `list_templates`         | List all available templates                                 |
| `get_component_coverage` | Get story coverage statistics                                |
| `suggest_stories`        | Get prioritized list of components needing stories           |

## Installation

```bash
npm install forgekit-storybook-mcp
# or
pnpm add forgekit-storybook-mcp
```

## Configuration

**Important:** Configuration files define your project structure. Tool options (like `includeInteractive`, `includeVariants`) are passed as arguments when calling MCP tools, not in config files.

### Option 1: Config File

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

Add to your `package.json`:

```json
{
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

- Component directories (`src/components`, `libs/ui/src`, etc.)
- Framework from dependencies (Chakra, shadcn, Tamagui, Gluestack, React Native)

## Usage with Claude Code

Add to `.vscode/mcp.json`:

```json
{
  "mcpServers": {
    "storybook": {
      "command": "npx",
      "args": ["forgekit-storybook-mcp"]
    }
  }
}
```

Or if installed locally:

```json
{
  "mcpServers": {
    "storybook": {
      "command": "node",
      "args": ["node_modules/forgekit-storybook-mcp/dist/cli.js"]
    }
  }
}
```

## Usage with Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "storybook": {
      "command": "npx",
      "args": ["forgekit-storybook-mcp"],
      "cwd": "/path/to/your/project"
    }
  }
}
```

## CLI Flags

```bash
# Run with auto-sync (default)
npx forgekit-storybook-mcp

# Skip auto-sync on startup
npx forgekit-storybook-mcp --skip-init

# Preview what would be synced without writing
npx forgekit-storybook-mcp --dry-run

# Only run sync, then exit (useful for CI)
npx forgekit-storybook-mcp --init-only

# Disable specific generators
npx forgekit-storybook-mcp --no-stories
npx forgekit-storybook-mcp --no-tests
npx forgekit-storybook-mcp --no-docs

# Don't update existing files (only create missing)
npx forgekit-storybook-mcp --no-update
```

## Tool Examples

### `list_components`

List all components, optionally filtered by library or story status.

**Example 1: List all components**
```json
{
  "tool": "list_components"
}
```

**Example 2: List components in a specific library**
```json
{
  "tool": "list_components",
  "arguments": {
    "library": "ui"
  }
}
```

**Example 3: List only components without stories**
```json
{
  "tool": "list_components",
  "arguments": {
    "hasStory": false
  }
}
```

**Example 4: List components in a library that don't have stories**
```json
{
  "tool": "list_components",
  "arguments": {
    "library": "ui",
    "hasStory": false
  }
}
```

**Response:**
```json
{
  "components": [
    {
      "name": "Button",
      "filePath": "libs/ui/src/button/button.tsx",
      "hasStory": false,
      "library": "ui"
    },
    {
      "name": "Card",
      "filePath": "libs/ui/src/card/card.tsx",
      "hasStory": false,
      "library": "ui"
    }
  ],
  "total": 2,
  "withStories": 0,
  "withoutStories": 2
}
```

### `analyze_component`

Analyze a component to extract props, dependencies, and get story generation suggestions.

**Example: Analyze a component**
```json
{
  "tool": "analyze_component",
  "arguments": {
    "componentPath": "libs/ui/src/button/button.tsx"
  }
}
```

**Response includes:**
- Extracted props with types
- Detected dependencies (Router, React Query, Chakra, etc.)
- Suggestions for story generation
- Source code preview
- Library information
- Story file path (if exists)

**Example Response:**
```json
{
  "analysis": {
    "name": "Button",
    "filePath": "libs/ui/src/button/button.tsx",
    "library": "ui",
    "props": [
      {
        "name": "children",
        "type": "React.ReactNode",
        "required": true
      },
      {
        "name": "variant",
        "type": "'primary' | 'secondary' | 'outline'",
        "required": false,
        "defaultValue": "'primary'"
      }
    ],
    "dependencies": {
      "usesRouter": false,
      "usesReactQuery": false,
      "usesChakra": true,
      "usesMSW": false
    },
    "suggestions": [
      "Include variant stories to showcase all button styles",
      "Add interactive play function to test click behavior"
    ]
  },
  "summary": "Analyzed Button: 2 props, no story",
  "recommendations": [...]
}
```

### `generate_story`

Generate a Storybook story file for a component. **All options are passed as tool arguments, not in config.**

**Example 1: Basic story generation (defaults)**
```json
{
  "tool": "generate_story",
  "arguments": {
    "componentPath": "libs/ui/src/button/button.tsx"
  }
}
```
This uses defaults: `includeVariants: true`, `includeInteractive: true`, `includeA11y: false`, `includeResponsive: false`, `template: "basic"`

**Example 2: Generate with all features enabled**
```json
{
  "tool": "generate_story",
  "arguments": {
    "componentPath": "libs/ui/src/card/card.tsx",
    "includeVariants": true,
    "includeInteractive": true,
    "includeA11y": true,
    "includeResponsive": true,
    "template": "with-controls"
  }
}
```

**Example 3: Generate with accessibility tests only**
```json
{
  "tool": "generate_story",
  "arguments": {
    "componentPath": "libs/ui/src/button/button.tsx",
    "includeVariants": false,
    "includeInteractive": false,
    "includeA11y": true,
    "includeResponsive": false
  }
}
```

**Example 4: Generate with MSW template (Pro only)**
```json
{
  "tool": "generate_story",
  "arguments": {
    "componentPath": "libs/shared/src/UserList.tsx",
    "template": "with-msw",
    "includeInteractive": true
  }
}
```

**Example 5: Preview without writing (dry run)**
```json
{
  "tool": "generate_story",
  "arguments": {
    "componentPath": "libs/ui/src/button/button.tsx",
    "dryRun": true,
    "includeVariants": true,
    "includeInteractive": true
  }
}
```

**Example 6: Overwrite existing story**
```json
{
  "tool": "generate_story",
  "arguments": {
    "componentPath": "libs/ui/src/button/button.tsx",
    "overwrite": true,
    "includeVariants": true
  }
}
```

**Available Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `componentPath` | `string` | **required** | Path to component file relative to project root |
| `includeVariants` | `boolean` | `true` | Include stories for size/variant props (e.g., `size="sm"`, `variant="primary"`) |
| `includeInteractive` | `boolean` | `true` | Include interactive test with play function (tests user interactions) |
| `includeA11y` | `boolean` | `false` | Include accessibility test story (runs a11y checks) |
| `includeResponsive` | `boolean` | `false` | Include responsive viewport stories (mobile/desktop) |
| `template` | `string` | `"basic"` | Template to use: `basic`, `with-controls`, `with-variants`, `with-msw`, `with-router`, `page`, `interactive`, `form` (Pro only for non-basic) |
| `overwrite` | `boolean` | `false` | Overwrite existing story file if it exists |
| `dryRun` | `boolean` | `false` | Generate story content but don't write to disk |

**Response:**
```json
{
  "story": {
    "content": "import type { Meta, StoryObj } from '@storybook/react'...",
    "filePath": "libs/ui/src/button/button.stories.tsx"
  },
  "written": true,
  "path": "libs/ui/src/button/button.stories.tsx",
  "summary": "Created story at libs/ui/src/button/button.stories.tsx"
}
```

### `validate_story`

Validate an existing story file for best practices, errors, and suggestions.

**Example: Validate a story**
```json
{
  "tool": "validate_story",
  "arguments": {
    "storyPath": "libs/ui/src/button/button.stories.tsx"
  }
}
```

**Response:**
```json
{
  "validation": {
    "valid": true,
    "score": 85,
    "errors": [],
    "warnings": [
      "Missing accessibility story - consider adding includeA11y: true"
    ],
    "suggestions": [
      "Add more variant examples",
      "Include responsive viewports"
    ]
  },
  "summary": "Story is valid (score: 85/100)"
}
```

### `get_story_template`

Get a specific story template with placeholders. Useful for understanding template structure.

**Example 1: Get basic template**
```json
{
  "tool": "get_story_template",
  "arguments": {
    "template": "basic"
  }
}
```

**Example 2: Get MSW template (Pro only)**
```json
{
  "tool": "get_story_template",
  "arguments": {
    "template": "with-msw"
  }
}
```

**Available templates:** `basic`, `with-controls`, `with-variants`, `with-msw`, `with-router`, `page`, `interactive`, `form`

**Response:**
```json
{
  "template": {
    "name": "basic",
    "description": "Simple component with minimal setup",
    "content": "import type { Meta, StoryObj } from '@storybook/react'...",
    "placeholders": ["ComponentName", "componentPath"]
  },
  "usage": "Replace placeholders: ComponentName, componentPath"
}
```

### `list_templates`

List all available story templates with descriptions.

**Example: List all templates**
```json
{
  "tool": "list_templates"
}
```

**Response:**
```json
{
  "templates": [
    {
      "name": "basic",
      "description": "Simple component with minimal setup",
      "useCase": "Basic components without complex dependencies",
      "available": true
    },
    {
      "name": "with-msw",
      "description": "Components that fetch data",
      "useCase": "Components using fetch, axios, or React Query",
      "available": false
    }
  ],
  "count": 8,
  "tier": "free"
}
```

### `get_component_coverage`

Get story coverage statistics for the project.

**Example 1: Get coverage for all libraries**
```json
{
  "tool": "get_component_coverage"
}
```

**Example 2: Get coverage for a specific library**
```json
{
  "tool": "get_component_coverage",
  "arguments": {
    "library": "ui"
  }
}
```

**Response:**
```json
{
  "total": 25,
  "withStories": 20,
  "withoutStories": 5,
  "coverage": "80%",
  "byLibrary": {
    "ui": {
      "total": 15,
      "withStories": 12
    },
    "shared": {
      "total": 10,
      "withStories": 8
    }
  },
  "componentsNeedingStories": [
    {
      "name": "Button",
      "path": "libs/ui/src/button/button.tsx",
      "library": "ui"
    }
  ]
}
```

### `suggest_stories`

Get a prioritized list of components that need stories.

**Example 1: Get top 10 suggestions**
```json
{
  "tool": "suggest_stories"
}
```

**Example 2: Get top 5 suggestions for a library**
```json
{
  "tool": "suggest_stories",
  "arguments": {
    "limit": 5,
    "library": "ui"
  }
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
    }
  ],
  "total": 5,
  "showing": 5,
  "summary": "5 components without stories. Showing top 5."
}
```

### `sync_all`

Manually trigger full sync of all components. Creates missing stories/tests/docs and updates changed ones.

**Example 1: Sync everything (defaults)**
```json
{
  "tool": "sync_all"
}
```
Defaults: `generateStories: true`, `generateTests: true`, `generateDocs: true`, `updateExisting: true`

**Example 2: Sync only stories, skip tests and docs**
```json
{
  "tool": "sync_all",
  "arguments": {
    "generateStories": true,
    "generateTests": false,
    "generateDocs": false
  }
}
```

**Example 3: Sync only for a specific library**
```json
{
  "tool": "sync_all",
  "arguments": {
    "library": "ui",
    "generateStories": true,
    "generateTests": false
  }
}
```

**Example 4: Preview sync without writing**
```json
{
  "tool": "sync_all",
  "arguments": {
    "dryRun": true
  }
}
```

**Example 5: Only create missing files, don't update existing**
```json
{
  "tool": "sync_all",
  "arguments": {
    "updateExisting": false
  }
}
```

**Available Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `library` | `string` | `undefined` | Filter by library name (e.g., `"ui"`) |
| `generateStories` | `boolean` | `true` | Generate missing story files |
| `generateTests` | `boolean` | `true` | Generate missing test files (Pro only) |
| `generateDocs` | `boolean` | `true` | Generate missing MDX docs (Pro only) |
| `updateExisting` | `boolean` | `true` | Update existing files if component changed |
| `dryRun` | `boolean` | `false` | Preview what would be done without writing files |

**Response:**
```json
{
  "scanned": 25,
  "created": {
    "stories": 5,
    "tests": 3,
    "docs": 2
  },
  "updated": {
    "stories": 2,
    "tests": 1,
    "docs": 0
  },
  "summary": "Synced 25 components: Created 5 stories, 3 tests, 2 docs. Updated 3 files."
}
```

### `sync_component`

Sync a single component - create or update its story, test, and docs files.

**Example 1: Sync everything for a component**
```json
{
  "tool": "sync_component",
  "arguments": {
    "componentPath": "libs/ui/src/button/button.tsx"
  }
```
Defaults: `generateStories: true`, `generateTests: true`, `generateDocs: true`

**Example 2: Sync only story, skip test and docs**
```json
{
  "tool": "sync_component",
  "arguments": {
    "componentPath": "libs/ui/src/button/button.tsx",
    "generateStories": true,
    "generateTests": false,
    "generateDocs": false
  }
}
```

**Example 3: Preview sync without writing**
```json
{
  "tool": "sync_component",
  "arguments": {
    "componentPath": "libs/ui/src/button/button.tsx",
    "dryRun": true
  }
}
```

**Available Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `componentPath` | `string` | **required** | Path to component file relative to project root |
| `generateStories` | `boolean` | `true` | Generate story file |
| `generateTests` | `boolean` | `true` | Generate test file (Pro only) |
| `generateDocs` | `boolean` | `true` | Generate MDX docs (Pro only) |
| `dryRun` | `boolean` | `false` | Preview without writing |

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
      "action": "skipped",
      "path": null
    },
    "docs": {
      "action": "created",
      "path": "libs/ui/src/button/button.mdx"
    }
  },
  "summary": "Button: story: created, docs: created"
}
```

### `generate_test`

Generate a Playwright/Vitest test file for a component. **Pro feature.**

**Example 1: Generate test**
```json
{
  "tool": "generate_test",
  "arguments": {
    "componentPath": "libs/ui/src/button/button.tsx"
  }
}
```

**Example 2: Preview test without writing**
```json
{
  "tool": "generate_test",
  "arguments": {
    "componentPath": "libs/ui/src/button/button.tsx",
    "dryRun": true
  }
}
```

**Example 3: Overwrite existing test**
```json
{
  "tool": "generate_test",
  "arguments": {
    "componentPath": "libs/ui/src/button/button.tsx",
    "overwrite": true
  }
}
```

**Available Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `componentPath` | `string` | **required** | Path to component file relative to project root |
| `overwrite` | `boolean` | `false` | Overwrite existing test file if it exists |
| `dryRun` | `boolean` | `false` | Preview without writing |

**Response:**
```json
{
  "test": {
    "content": "import { test, expect } from '@playwright/test'...",
    "filePath": "libs/ui/src/button/button.test.tsx"
  },
  "written": true,
  "path": "libs/ui/src/button/button.test.tsx",
  "summary": "Created test at libs/ui/src/button/button.test.tsx"
}
```

### `generate_docs`

Generate MDX documentation for a component. **Pro feature.**

**Example 1: Generate docs**
```json
{
  "tool": "generate_docs",
  "arguments": {
    "componentPath": "libs/ui/src/button/button.tsx"
  }
}
```

**Example 2: Preview docs without writing**
```json
{
  "tool": "generate_docs",
  "arguments": {
    "componentPath": "libs/ui/src/button/button.tsx",
    "dryRun": true
  }
}
```

**Example 3: Overwrite existing docs**
```json
{
  "tool": "generate_docs",
  "arguments": {
    "componentPath": "libs/ui/src/button/button.tsx",
    "overwrite": true
  }
}
```

**Available Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `componentPath` | `string` | **required** | Path to component file relative to project root |
| `overwrite` | `boolean` | `false` | Overwrite existing docs file if it exists |
| `dryRun` | `boolean` | `false` | Preview without writing |

**Response:**
```json
{
  "docs": {
    "content": "import { Meta } from '@storybook/blocks'...",
    "filePath": "libs/ui/src/button/button.mdx"
  },
  "written": true,
  "path": "libs/ui/src/button/button.mdx",
  "summary": "Created docs at libs/ui/src/button/button.mdx"
}
```

## Templates

| Template        | Use Case                                  | Tier   |
| --------------- | ----------------------------------------- | ------ |
| `basic`         | Simple component with minimal setup       | Free   |
| `with-controls` | Full argTypes for interactive exploration  | Pro    |
| `with-variants` | Showcase all sizes/variants               | Pro    |
| `with-msw`      | Components that fetch data                | Pro    |
| `with-router`   | Components using React Router             | Pro    |
| `page`          | Full-page components                      | Pro    |
| `interactive`   | Components with user interactions         | Pro    |
| `form`          | Form components with validation           | Pro    |

## Configuration Reference

```typescript
interface StorybookMCPConfig {
  // Project root (auto-detected)
  rootDir: string

  // UI framework
  framework: 'chakra' | 'shadcn' | 'tamagui' | 'vanilla' | 'custom'

  // Component libraries
  libraries: Array<{
    name: string // Library identifier
    path: string // Path relative to rootDir
    storyTitlePrefix: string // Storybook title prefix
    decorators?: string[] // Default decorators
    importAlias?: string // Import path alias
  }>

  // File patterns
  storyFilePattern: string // Default: **/*.stories.{ts,tsx}
  componentPatterns: string[] // Glob patterns for components
  excludePatterns: string[] // Directories to exclude

  // Storybook version
  storybookVersion: 7 | 8 // Default: 8

  // License key (optional, can use env var instead)
  licenseKey?: string
}
```

## Resources

The MCP also provides resources:

- `storybook://libraries` — Configured library information
- `storybook://patterns` — Common story patterns and best practices
- `storybook://config` — Current MCP configuration

## Programmatic Usage

```typescript
import { createStorybookMCPServer } from 'forgekit-storybook-mcp'

const server = createStorybookMCPServer({
  rootDir: process.cwd(),
  framework: 'chakra',
  libraries: [{ name: 'ui', path: 'src/components', storyTitlePrefix: 'UI' }]
})
```

## Related

- [forgekit-chakra-mcp](https://github.com/effinrich/chakra-mcp) — Chakra UI + Figma sync MCP
- [@storybook/addon-mcp](https://github.com/storybookjs/mcp) — Official Storybook MCP (reads stories)

This MCP focuses on **generating** stories, while the official one focuses on **reading** existing Storybook data. They complement each other.

## License

MIT
