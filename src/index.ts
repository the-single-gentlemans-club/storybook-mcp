/**
 * Storybook MCP Server
 * 
 * A Model Context Protocol server for Storybook story generation,
 * component analysis, and validation.
 * 
 * Framework-agnostic - works with Chakra, shadcn, Tamagui, or vanilla React.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

import type { StorybookMCPConfig } from './types.js'
import {
  listComponents,
  analyzeComponentTool,
  generateStoryTool,
  validateStoryTool,
  getStoryTemplate,
  listTemplates,
  getComponentCoverage,
  suggestStories,
  syncAll,
  syncComponentTool,
  generateTestTool,
  generateDocsTool,
} from './tools.js'

export { StorybookMCPConfig } from './types.js'
export * from './types.js'

/**
 * Create and configure the MCP server
 */
export function createStorybookMCPServer(config: StorybookMCPConfig) {
  const server = new Server(
    {
      name: 'storybook-mcp',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  )

  // ===========================================
  // Tool Definitions
  // ===========================================

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'list_components',
        description: 'List all React components in the project. Can filter by library and whether they have stories.',
        inputSchema: {
          type: 'object',
          properties: {
            library: {
              type: 'string',
              description: 'Filter by library name (e.g., "ui", "shared"). Use "all" for all libraries.',
            },
            hasStory: {
              type: 'boolean',
              description: 'Filter by whether component has a story file',
            },
          },
        },
      },
      {
        name: 'analyze_component',
        description: 'Analyze a React component to extract props, dependencies, and suggestions for story generation.',
        inputSchema: {
          type: 'object',
          properties: {
            componentPath: {
              type: 'string',
              description: 'Path to the component file relative to project root',
            },
          },
          required: ['componentPath'],
        },
      },
      {
        name: 'generate_story',
        description: 'Generate a Storybook story file for a component. Analyzes the component and creates appropriate stories.',
        inputSchema: {
          type: 'object',
          properties: {
            componentPath: {
              type: 'string',
              description: 'Path to the component file relative to project root',
            },
            includeVariants: {
              type: 'boolean',
              description: 'Include stories for size/variant props (default: true)',
            },
            includeInteractive: {
              type: 'boolean',
              description: 'Include interactive test with play function (default: true)',
            },
            includeA11y: {
              type: 'boolean',
              description: 'Include accessibility test story (default: false)',
            },
            includeResponsive: {
              type: 'boolean',
              description: 'Include responsive viewport stories (default: false)',
            },
            template: {
              type: 'string',
              enum: ['basic', 'with-controls', 'with-variants', 'with-msw', 'with-router', 'page', 'interactive', 'form'],
              description: 'Template to use for generation',
            },
            overwrite: {
              type: 'boolean',
              description: 'Overwrite existing story file (default: false)',
            },
            dryRun: {
              type: 'boolean',
              description: 'Generate but do not write to disk (default: false)',
            },
          },
          required: ['componentPath'],
        },
      },
      {
        name: 'validate_story',
        description: 'Validate an existing story file for best practices, errors, and suggestions.',
        inputSchema: {
          type: 'object',
          properties: {
            storyPath: {
              type: 'string',
              description: 'Path to the story file relative to project root',
            },
          },
          required: ['storyPath'],
        },
      },
      {
        name: 'get_story_template',
        description: 'Get a specific story template with placeholders.',
        inputSchema: {
          type: 'object',
          properties: {
            template: {
              type: 'string',
              enum: ['basic', 'with-controls', 'with-variants', 'with-msw', 'with-router', 'page', 'interactive', 'form'],
              description: 'Template name',
            },
          },
          required: ['template'],
        },
      },
      {
        name: 'list_templates',
        description: 'List all available story templates with descriptions.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_component_coverage',
        description: 'Get story coverage statistics for the project.',
        inputSchema: {
          type: 'object',
          properties: {
            library: {
              type: 'string',
              description: 'Filter by library name',
            },
          },
        },
      },
      {
        name: 'suggest_stories',
        description: 'Get suggestions for which components need stories.',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of suggestions (default: 10)',
            },
            library: {
              type: 'string',
              description: 'Filter by library name',
            },
          },
        },
      },
      {
        name: 'sync_all',
        description: 'Sync all components - create missing stories/tests/docs and update changed ones. Runs automatically on startup but can be triggered manually.',
        inputSchema: {
          type: 'object',
          properties: {
            library: {
              type: 'string',
              description: 'Filter by library name',
            },
            generateStories: {
              type: 'boolean',
              description: 'Generate missing story files (default: true)',
            },
            generateTests: {
              type: 'boolean',
              description: 'Generate missing test files (default: true)',
            },
            generateDocs: {
              type: 'boolean',
              description: 'Generate missing MDX docs (default: true)',
            },
            updateExisting: {
              type: 'boolean',
              description: 'Update existing files if component changed (default: true)',
            },
            dryRun: {
              type: 'boolean',
              description: 'Preview what would be done without writing files',
            },
          },
        },
      },
      {
        name: 'sync_component',
        description: 'Sync a single component - create or update its story, test, and docs files.',
        inputSchema: {
          type: 'object',
          properties: {
            componentPath: {
              type: 'string',
              description: 'Path to the component file',
            },
            generateStories: {
              type: 'boolean',
              description: 'Generate story file (default: true)',
            },
            generateTests: {
              type: 'boolean',
              description: 'Generate test file (default: true)',
            },
            generateDocs: {
              type: 'boolean',
              description: 'Generate MDX docs (default: true)',
            },
            dryRun: {
              type: 'boolean',
              description: 'Preview without writing',
            },
          },
          required: ['componentPath'],
        },
      },
      {
        name: 'generate_test',
        description: 'Generate a Playwright/Vitest test file for a component.',
        inputSchema: {
          type: 'object',
          properties: {
            componentPath: {
              type: 'string',
              description: 'Path to the component file',
            },
            overwrite: {
              type: 'boolean',
              description: 'Overwrite existing test file',
            },
            dryRun: {
              type: 'boolean',
              description: 'Preview without writing',
            },
          },
          required: ['componentPath'],
        },
      },
      {
        name: 'generate_docs',
        description: 'Generate MDX documentation for a component.',
        inputSchema: {
          type: 'object',
          properties: {
            componentPath: {
              type: 'string',
              description: 'Path to the component file',
            },
            overwrite: {
              type: 'boolean',
              description: 'Overwrite existing docs file',
            },
            dryRun: {
              type: 'boolean',
              description: 'Preview without writing',
            },
          },
          required: ['componentPath'],
        },
      },
    ],
  }))

  // ===========================================
  // Tool Execution
  // ===========================================

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params

    try {
      let result: unknown

      switch (name) {
        case 'list_components':
          result = await listComponents(config, args as any)
          break

        case 'analyze_component':
          result = await analyzeComponentTool(config, args as any)
          break

        case 'generate_story':
          result = await generateStoryTool(config, args as any)
          break

        case 'validate_story':
          result = await validateStoryTool(config, args as any)
          break

        case 'get_story_template':
          result = await getStoryTemplate(config, args as any)
          break

        case 'list_templates':
          result = await listTemplates(config)
          break

        case 'get_component_coverage':
          result = await getComponentCoverage(config, args as any)
          break

        case 'suggest_stories':
          result = await suggestStories(config, args as any)
          break

        case 'sync_all':
          result = await syncAll(config, args as any)
          break

        case 'sync_component':
          result = await syncComponentTool(config, args as any)
          break

        case 'generate_test':
          result = await generateTestTool(config, args as any)
          break

        case 'generate_docs':
          result = await generateDocsTool(config, args as any)
          break

        default:
          throw new Error(`Unknown tool: ${name}`)
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: message }),
          },
        ],
        isError: true,
      }
    }
  })

  // ===========================================
  // Resources
  // ===========================================

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      {
        uri: 'storybook://libraries',
        name: 'Component Libraries',
        description: 'Information about configured component libraries',
        mimeType: 'application/json',
      },
      {
        uri: 'storybook://patterns',
        name: 'Story Patterns',
        description: 'Common Storybook patterns and best practices',
        mimeType: 'text/markdown',
      },
      {
        uri: 'storybook://config',
        name: 'MCP Configuration',
        description: 'Current Storybook MCP configuration',
        mimeType: 'application/json',
      },
    ],
  }))

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params

    switch (uri) {
      case 'storybook://libraries':
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(config.libraries, null, 2),
            },
          ],
        }

      case 'storybook://patterns':
        return {
          contents: [
            {
              uri,
              mimeType: 'text/markdown',
              text: PATTERNS_DOC,
            },
          ],
        }

      case 'storybook://config':
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(config, null, 2),
            },
          ],
        }

      default:
        throw new Error(`Unknown resource: ${uri}`)
    }
  })

  return server
}

/**
 * Run the MCP server with stdio transport
 */
export async function runServer(config: StorybookMCPConfig) {
  const server = createStorybookMCPServer(config)
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

// ===========================================
// Resource Content
// ===========================================

const PATTERNS_DOC = `# Storybook Patterns

## Story Structure

### Basic Story
\`\`\`tsx
import type { Meta, StoryObj } from '@storybook/react'
import { Component } from './Component'

const meta: Meta<typeof Component> = {
  title: 'Components/Component',
  component: Component,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof Component>

export const Default: Story = {
  args: { children: 'Hello' },
}
\`\`\`

## Interaction Testing

Use play functions to test user interactions:

\`\`\`tsx
export const Interactive: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const button = canvas.getByRole('button')
    
    await expect(button).toBeInTheDocument()
    await userEvent.click(button)
  },
}
\`\`\`

## Decorators

### Router Context
\`\`\`tsx
import { withRouter } from 'storybook-addon-remix-react-router'

const meta: Meta = {
  decorators: [withRouter],
}
\`\`\`

### Theme Provider
\`\`\`tsx
const meta: Meta = {
  decorators: [
    (Story) => (
      <ThemeProvider>
        <Story />
      </ThemeProvider>
    ),
  ],
}
\`\`\`

## MSW Mocking

\`\`\`tsx
import { http, HttpResponse } from 'msw'

export const WithData: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/api/data', () => {
          return HttpResponse.json({ items: [] })
        }),
      ],
    },
  },
}
\`\`\`

## Viewport Testing

\`\`\`tsx
export const Mobile: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
}
\`\`\`

## Best Practices

1. **Always add autodocs tag** for automatic documentation
2. **Use type imports** for Meta and StoryObj
3. **Include play functions** for interactive components
4. **Test keyboard navigation** for accessibility
5. **Use MSW** for API-dependent components
6. **Add JSDoc comments** to describe each story
`
