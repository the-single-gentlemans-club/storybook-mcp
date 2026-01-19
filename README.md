# @forgekit/storybook-mcp

A **Model Context Protocol (MCP) server** for Storybook story generation, component analysis, and validation.

**Framework-agnostic** — works with Chakra UI, shadcn/ui, Tamagui, or vanilla React.

## Key Feature: Auto-Sync on Startup

When the MCP server starts, it automatically:

1. **Scans** all components in configured libraries
2. **Creates** missing stories, tests, and MDX docs
3. **Updates** existing files when components have changed
4. **Caches** component hashes for efficient change detection

This means your Storybook documentation stays in sync with your components automatically.

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
npm install @forgekit/storybook-mcp
# or
pnpm add @forgekit/storybook-mcp
```

## Configuration

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
- Framework from dependencies (Chakra, shadcn, Tamagui)

## Usage with Claude Code

Add to `.vscode/mcp.json`:

```json
{
  "mcpServers": {
    "storybook": {
      "command": "npx",
      "args": ["@forgekit/storybook-mcp"]
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
      "args": ["node_modules/@forgekit/storybook-mcp/dist/cli.js"]
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
      "args": ["@forgekit/storybook-mcp"],
      "cwd": "/path/to/your/project"
    }
  }
}
```

## CLI Flags

```bash
# Run with auto-sync (default)
npx @forgekit/storybook-mcp

# Skip auto-sync on startup
npx @forgekit/storybook-mcp --skip-init

# Preview what would be synced without writing
npx @forgekit/storybook-mcp --dry-run

# Only run sync, then exit (useful for CI)
npx @forgekit/storybook-mcp --init-only

# Disable specific generators
npx @forgekit/storybook-mcp --no-stories
npx @forgekit/storybook-mcp --no-tests
npx @forgekit/storybook-mcp --no-docs

# Don't update existing files (only create missing)
npx @forgekit/storybook-mcp --no-update
```

## Tool Examples

### List Components

```
List all components in the ui library that don't have stories
```

Response:

```json
{
  "components": [
    {
      "name": "Button",
      "filePath": "libs/ui/src/button/button.tsx",
      "hasStory": false
    },
    {
      "name": "Card",
      "filePath": "libs/ui/src/card/card.tsx",
      "hasStory": false
    }
  ],
  "total": 2,
  "withStories": 0,
  "withoutStories": 2
}
```

### Analyze Component

```
Analyze the Button component at libs/ui/src/button/button.tsx
```

Response includes:

- Extracted props with types
- Detected dependencies (Router, React Query, Chakra, etc.)
- Suggestions for story generation
- Source code preview

### Generate Story

```
Generate a story for libs/ui/src/card/card.tsx with variants and accessibility tests
```

Options:

- `includeVariants`: Add size/variant showcase stories
- `includeInteractive`: Add play function tests
- `includeA11y`: Add accessibility test story
- `includeResponsive`: Add mobile/desktop viewport stories
- `template`: Use a specific template
- `dryRun`: Preview without writing

### Validate Story

```
Validate the story at libs/ui/src/button/button.stories.tsx
```

Returns:

- Errors (must fix)
- Warnings (should fix)
- Suggestions (nice to have)
- Score out of 100

## Templates

| Template        | Use Case                                  |
| --------------- | ----------------------------------------- |
| `basic`         | Simple component with minimal setup       |
| `with-controls` | Full argTypes for interactive exploration |
| `with-variants` | Showcase all sizes/variants               |
| `with-msw`      | Components that fetch data                |
| `with-router`   | Components using React Router             |
| `page`          | Full-page components                      |
| `interactive`   | Components with user interactions         |
| `form`          | Form components with validation           |

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
}
```

## Resources

The MCP also provides resources:

- `storybook://libraries` — Configured library information
- `storybook://patterns` — Common story patterns and best practices
- `storybook://config` — Current MCP configuration

## Programmatic Usage

```typescript
import { createStorybookMCPServer } from '@forgekit/storybook-mcp'

const server = createStorybookMCPServer({
  rootDir: process.cwd(),
  framework: 'chakra',
  libraries: [{ name: 'ui', path: 'src/components', storyTitlePrefix: 'UI' }]
})
```

## Related

- [@forgekit/chakra-mcp](https://github.com/effinrich/chakra-mcp) — Chakra UI + Figma sync MCP
- [@storybook/addon-mcp](https://github.com/storybookjs/mcp) — Official Storybook MCP (reads stories)

This MCP focuses on **generating** stories, while the official one focuses on **reading** existing Storybook data. They complement each other.

## License

MIT
