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
import { runPreflight } from './utils/preflight.js'

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
  
  Get Pro: https://polar.sh/forgekit

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

  // Check if .storybook exists - check root AND Nx lib-level locations
  const storybookDir = path.join(cwd, '.storybook')
  let hasStorybookConfig = fs.existsSync(storybookDir)

  // For Nx monorepos, also check lib-level .storybook directories
  if (!hasStorybookConfig && fs.existsSync(path.join(cwd, 'nx.json'))) {
    for (const base of ['libs', 'packages']) {
      const baseDir = path.join(cwd, base)
      if (!fs.existsSync(baseDir)) continue
      const entries = fs.readdirSync(baseDir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory()) {
          // Check direct: libs/<name>/.storybook
          if (fs.existsSync(path.join(baseDir, entry.name, '.storybook'))) {
            hasStorybookConfig = true
            break
          }
          // Check nested: libs/<name>/<sub>/.storybook
          const subEntries = fs.readdirSync(path.join(baseDir, entry.name), { withFileTypes: true })
          for (const sub of subEntries) {
            if (sub.isDirectory() && fs.existsSync(path.join(baseDir, entry.name, sub.name, '.storybook'))) {
              hasStorybookConfig = true
              break
            }
          }
        }
        if (hasStorybookConfig) break
      }
      if (hasStorybookConfig) break
    }
  }

  if (!hasStorybookConfig) {
    console.error(`
⚠️  No .storybook configuration found.

Run setup first to create Storybook config and scripts:

  npx forgekit-storybook-mcp --setup

This will:
  • Create .storybook/main.ts and preview.tsx
  • Add storybook scripts to package.json
  • Detect your framework (Chakra, shadcn, etc.)

For Nx monorepos, use:
  npx nx g @nx/storybook:configuration <project-name>

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

  // Run preflight checks
  const preflight = await runPreflight(cwd)
  if (!preflight.passed) {
    console.error('\n⚠️  Preflight checks found issues:\n')
    for (const check of preflight.checks.filter(c => c.status !== 'pass')) {
      const icon = check.status === 'fail' ? '❌' : '⚠️'
      console.error(`  ${icon} ${check.message}`)
      if (check.fix) console.error(`     → ${check.fix}`)
    }
    if (preflight.installCommands.length > 0) {
      console.error('\n  Fix with:\n')
      for (const cmd of preflight.installCommands) {
        console.error(`    ${cmd}`)
      }
    }
    console.error('')
  }

  // Validate license (async with caching)
  const license = await validateLicenseAsync(config)
  console.error(`[storybook-mcp] License: ${license.tier}${license.tier === 'free' ? ` (max ${license.maxSyncLimit} components)` : ''}`)

  // Run initialization unless skipped
  if (!args.skipInit) {
    console.error(`[storybook-mcp] Running component sync...`)
    
    // Free tier: disable test and docs generation
    const canGenerateTests = license.tier === 'pro' && !args.noTests
    const canGenerateDocs = license.tier === 'pro' && !args.noDocs

    if (license.tier === 'free') {
      if (!args.noTests) console.error('[storybook-mcp] Test generation requires Pro license')
      if (!args.noDocs) console.error('[storybook-mcp] Docs generation requires Pro license')
    }

    const initResult = await initializeComponents(config, {
      generateStories: !args.noStories,
      generateTests: canGenerateTests,
      generateDocs: canGenerateDocs,
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

  const isNx = fs.existsSync(path.join(rootDir, 'nx.json'))

  if (isNx) {
    // Nx monorepo: discover all libs with src/ directories (up to 2 levels deep)
    for (const base of ['libs', 'packages']) {
      const baseDir = path.join(rootDir, base)
      if (!fs.existsSync(baseDir)) continue

      const walkLibs = (dir: string, depth: number) => {
        if (depth > 2) return
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
          if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') continue
          const entryPath = path.join(dir, entry.name)
          const srcPath = path.join(entryPath, 'src')
          const hasProjectJson = fs.existsSync(path.join(entryPath, 'project.json'))

          if (fs.existsSync(srcPath) && hasProjectJson) {
            const relPath = path.relative(rootDir, entryPath)
            const libRelPath = path.relative(rootDir, entryPath)
            // Build a readable name from the path: libs/shared/ui → shared-ui
            const nameParts = path.relative(path.join(rootDir, base), entryPath).split(path.sep)
            const libName = nameParts.join('-')
            const prefix = nameParts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' / ')

            libraries.push({
              name: libName,
              path: relPath,
              storyTitlePrefix: prefix,
            })
          } else if (!hasProjectJson) {
            // Could be a grouping folder (e.g., libs/shared/) — recurse
            walkLibs(entryPath, depth + 1)
          }
        }
      }

      walkLibs(baseDir, 0)
    }
  } else {
    // Standard project: check common paths
    // Note: componentPatterns include **/src/**/*.tsx, so lib paths should be
    // the project/package root (not src/ subdirs) to avoid double-pathing
    const possiblePaths = [
      { check: 'src/components', path: '.', name: 'components', prefix: 'Components' },
      { check: 'src/lib', path: '.', name: 'lib', prefix: 'Lib' },
      { check: 'packages/ui/src', path: 'packages/ui', name: 'ui', prefix: 'UI' },
      { check: 'apps/web/src/components', path: 'apps/web', name: 'web', prefix: 'Web / Components' },
    ]

    for (const { check, path: libPath, name, prefix } of possiblePaths) {
      const fullPath = path.join(rootDir, check)
      if (fs.existsSync(fullPath)) {
        libraries.push({
          name,
          path: libPath,
          storyTitlePrefix: prefix,
        })
      }
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
