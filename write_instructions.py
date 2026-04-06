content = u'''# Copilot Instructions \u2014 forgekit-storybook-mcp

## Project Overview

**MCP (Model Context Protocol) server** that auto-generates Storybook stories, tests, and MDX docs for React component libraries. Published to npm as \orgekit-storybook-mcp\, runs as a CLI via stdio transport. It is **not** a React app\u2014it analyzes and generates files in consumer projects. Requires **Node \u2265 20** and targets **Storybook 10+**.

## Architecture

\\\
src/
  cli.ts              \u2192 Entry: loads .env/.env.local, resolves config, runs preflight + init sync, starts MCP server
  index.ts            \u2192 MCP server: registers 15 tools via @modelcontextprotocol/sdk request handlers
  tools.ts            \u2192 15 tool functions: listComponents, analyzeComponent, generateStory, updateStory,
                         validateStory, getStoryTemplate, listTemplates, getComponentCoverage, suggestStories,
                         syncAll, syncComponent, generateTest, generateDocs, checkHealth, generateCodeConnect
  types.ts            \u2192 All shared TypeScript interfaces + DEFAULT_CONFIG
  utils/
    scanner.ts          \u2192 Component discovery (fast-glob) + prop/dependency extraction via regex
    generator.ts        \u2192 Story file generation (framework-aware: Chakra/shadcn/RN/etc.)
    initializer.ts      \u2192 Startup sync engine: MD5 hash diff via .storybook-mcp-cache.json; file watcher
    setup.ts            \u2192 Storybook bootstrapper: .storybook/ config, Nx monorepo detection
    templates.ts        \u2192 8 built-in story templates (basic, with-controls, with-msw, form, etc.)
    validator.ts        \u2192 Story validator: 8 rule categories, 0-100 score
    test-generator.ts   \u2192 Generates Playwright or Vitest test files
    docs-generator.ts   \u2192 Generates MDX documentation files
    code-connect-generator.ts \u2192 Generates @figma/code-connect .figma.tsx files
    story-merger.ts     \u2192 Pure functions: merges regenerated templates with user-added story blocks
    story-history.ts    \u2192 Writes .forgekit/story-history.json (max 10 versions per story)
    preflight.ts        \u2192 Storybook 10 compatibility checks before server starts
    errors.ts           \u2192 StorybookMCPError class + ErrorCode enum (typed error codes)
    constants.ts        \u2192 Single source of truth for all hardcoded values
\\\
'''
with open(r'd:\\documents-from-c\\GitHub\\storybook-mcp-v2\\.github\\copilot-instructions.md', 'w', encoding='utf-8') as f:
    f.write(content)
print('done', len(content))
