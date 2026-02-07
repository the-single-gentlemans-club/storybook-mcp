#!/usr/bin/env node
/**
 * Storybook MCP CLI
 * 
 * Run the MCP server with configuration from:
 * 1. storybook-mcp.config.json in current directory
 * 2. package.json "storybook-mcp" field
 * 3. Command line arguments
 * 
 * On startup, automatically syncs components:
 * - Creates missing stories, tests, and docs
 * - Updates existing files when components change
 */

import fs from 'node:fs'
import path from 'node:path'
import { runServer } from './index.js'
import type { StorybookMCPConfig } from './types.js'
import { DEFAULT_CONFIG } from './types.js'
import { initializeComponents } from './utils/initializer.js'
import { validateLicenseAsync } from './utils/license.js'
import { runSetup } from './utils/setup.js'

// Parse CLI arguments
function parseArgs(): {
  skipInit: boolean
  dryRun: boolean
  initOnly: boolean
  noStories: boolean
  noTests: boolean
  noDocs: boolean
  noUpdate: boolean
  help: boolean
  setup: boolean
  force: boolean
  libName?: string
} {
  const args = process.argv.slice(2)
  
  // Parse --lib=<name> argument
  let libName: string | undefined
  const libArg = args.find(arg => arg.startsWith('--lib='))
  if (libArg) {
    libName = libArg.split('=')[1]
  }

  return {
    skipInit: args.includes('--skip-init'),
    dryRun: args.includes('--dry-run'),
    initOnly: args.includes('--init-only'),
    noStories: args.includes('--no-stories'),
    noTests: args.includes('--no-tests'),
    noDocs: args.includes('--no-docs'),
    noUpdate: args.includes('--no-update'),
    help: args.includes('--help') || args.includes('-h'),
    setup: args.includes('--setup'),
    force: args.includes('--force'),
    libName,
  }
}

function showHelp(): void {
  console.log(`
forgekit-storybook-mcp - Auto-generate Storybook stories, tests, and docs

USAGE:
  npx forgekit-storybook-mcp [options]

SETUP (run first for new projects):
  --setup         Create .storybook/ config and add npm scripts
                  Auto-detects: Nx monorepo vs standard, UI framework
  --setup --dry-run   Preview what would be created
  --setup --force     Overwrite existing .storybook files
  --setup --lib=name  Specify Nx library name (for monorepos)

OPTIONS:
  --init-only     Generate files and exit (no MCP server)
  --dry-run       Show what would be created without writing files
  --skip-init     Skip initial component sync
  --no-stories    Don't generate story files
  --no-tests      Don't generate test files  
  --no-docs       Don't generate MDX docs
  --no-update     Don't update existing files
  --force         Overwrite existing files
  -h, --help      Show this help message

CONFIGURATION:
  Create storybook-mcp.config.json or add "storybook-mcp" to package.json:
  
  {
    "framework": "chakra|shadcn|tamagui|gluestack|vanilla",
    "libraries": [
      { "name": "ui", "path": "libs/ui/src" }
    ],
    "licenseKey": "your-license-key"
  }

  Or set STORYBOOK_MCP_LICENSE environment variable.

LICENSE:
  Free tier: 5 components, basic stories only
  Pro ($49): Unlimited components, tests, docs, all templates
  
  Get Pro: coming soon - email hello@forgekit.dev

MORE INFO:
  https://npmjs.com/package/forgekit-storybook-mcp
`)
}

async function main() {
  const cwd = process.cwd()
  const args = parseArgs()

  if (args.help) {
    showHelp()
    process.exit(0)
  }

  // Handle --setup command
  if (args.setup) {
    await runSetup(cwd, {
      dryRun: args.dryRun,
      force: args.force,
      libName: args.libName,
    })
    process.exit(0)
  }

  // Check if .storybook exists - if not, prompt user to run --setup
  const storybookDir = path.join(cwd, '.storybook')
  if (!fs.existsSync(storybookDir)) {
    console.error(`
⚠️  No .storybook configuration found.

Run setup first to create Storybook config and scripts:

  npx forgekit-storybook-mcp --setup

This will:
  • Create .storybook/main.ts and preview.ts
  • Add storybook scripts to package.json
  • Detect your framework (Chakra, shadcn, etc.)

Use --setup --dry-run to preview without writing files.
`)
    process.exit(1)
  }

  let config: StorybookMCPConfig

  // Try to load config from file
  const configPath = path.join(cwd, 'storybook-mcp.config.json')
  const packagePath = path.join(cwd, 'package.json')

  if (fs.existsSync(configPath)) {
    // Load from config file
    const configFile = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    config = {
      ...DEFAULT_CONFIG,
      rootDir: cwd,
      ...configFile,
    } as StorybookMCPConfig
    console.error(`[storybook-mcp] Loaded config from ${configPath}`)
  } else if (fs.existsSync(packagePath)) {
    // Try to load from package.json
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'))
    if (pkg['storybook-mcp']) {
      config = {
        ...DEFAULT_CONFIG,
        rootDir: cwd,
        ...pkg['storybook-mcp'],
      } as StorybookMCPConfig
      console.error(`[storybook-mcp] Loaded config from package.json`)
    } else {
      // Use default config with auto-detection
      config = await autoDetectConfig(cwd)
    }
  } else {
    // Use default config with auto-detection
    config = await autoDetectConfig(cwd)
  }

  // Validate config
  if (!config.libraries || config.libraries.length === 0) {
    console.error('[storybook-mcp] Warning: No libraries configured. Using auto-detection.')
    config = await autoDetectConfig(cwd)
  }

  console.error(`[storybook-mcp] Framework: ${config.framework}`)
  console.error(`[storybook-mcp] Libraries: ${config.libraries.map(l => l.name).join(', ')}`)

  // Validate license (async with caching)
  const license = await validateLicenseAsync(config)
  console.error(`[storybook-mcp] License: ${license.tier}${license.tier === 'free' ? ` (max ${license.maxSyncLimit} components)` : ''}`)

  // Run initialization unless skipped
  if (!args.skipInit) {
    console.error(`[storybook-mcp] Running component sync...`)
    
    const initResult = await initializeComponents(config, {
      generateStories: !args.noStories,
      generateTests: !args.noTests,
      generateDocs: !args.noDocs,
      updateExisting: !args.noUpdate,
      dryRun: args.dryRun,
      maxComponents: license.tier === 'free' ? license.maxSyncLimit : undefined,
    })

    if (args.dryRun) {
      console.error(`[storybook-mcp] Dry run complete. Would have:`)
      console.error(`  Created: ${initResult.created.stories} stories, ${initResult.created.tests} tests, ${initResult.created.docs} docs`)
      console.error(`  Updated: ${initResult.updated.stories} stories, ${initResult.updated.tests} tests, ${initResult.updated.docs} docs`)
    }

    // If init-only mode, exit after initialization
    if (args.initOnly) {
      console.error(`[storybook-mcp] Initialization complete. Exiting (--init-only mode).`)
      process.exit(0)
    }
  } else {
    console.error(`[storybook-mcp] Skipping initialization (--skip-init)`)
  }

  console.error(`[storybook-mcp] Starting MCP server...`)
  await runServer(config)
}

/**
 * Auto-detect configuration based on project structure
 */
async function autoDetectConfig(rootDir: string): Promise<StorybookMCPConfig> {
  const libraries: StorybookMCPConfig['libraries'] = []
  let framework: StorybookMCPConfig['framework'] = 'vanilla'

  // Check for common library structures
  const possiblePaths = [
    { path: 'src/components', name: 'components', prefix: 'Components' },
    { path: 'src/lib', name: 'lib', prefix: 'Lib' },
    { path: 'libs/ui/src', name: 'ui', prefix: 'UI' },
    { path: 'libs/shared/ui/src', name: 'shared-ui', prefix: 'Shared / UI' },
    { path: 'packages/ui/src', name: 'ui', prefix: 'UI' },
    { path: 'apps/web/src/components', name: 'web', prefix: 'Web / Components' },
  ]

  for (const { path: libPath, name, prefix } of possiblePaths) {
    const fullPath = path.join(rootDir, libPath)
    if (fs.existsSync(fullPath)) {
      libraries.push({
        name,
        path: libPath,
        storyTitlePrefix: prefix,
      })
    }
  }

  // If no libraries found, use src as fallback
  if (libraries.length === 0) {
    const srcPath = path.join(rootDir, 'src')
    if (fs.existsSync(srcPath)) {
      libraries.push({
        name: 'src',
        path: 'src',
        storyTitlePrefix: 'Components',
      })
    }
  }

  // Detect framework from dependencies
  const packagePath = path.join(rootDir, 'package.json')
  if (fs.existsSync(packagePath)) {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'))
    const deps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    }

    if (deps['@chakra-ui/react']) {
      framework = 'chakra'
    } else if (deps['@radix-ui/react-slot'] || deps['class-variance-authority']) {
      framework = 'shadcn'
    } else if (deps['tamagui']) {
      framework = 'tamagui'
    } else if (deps['@gluestack-ui/themed'] || deps['@gluestack-ui/config']) {
      framework = 'gluestack'
    }
  }

  console.error(`[storybook-mcp] Auto-detected ${libraries.length} libraries, framework: ${framework}`)

  return {
    ...DEFAULT_CONFIG,
    rootDir,
    libraries,
    framework,
  } as StorybookMCPConfig
}

// Run
main().catch((error) => {
  console.error('[storybook-mcp] Fatal error:', error)
  process.exit(1)
})
