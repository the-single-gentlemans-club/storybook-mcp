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
import { initializeComponents, startFileWatcher, removeScaffoldConflicts } from './utils/initializer.js'
import { validateLicenseAsync, resetLicenseCache } from './utils/license.js'
import { runSetup } from './utils/setup.js'
import { runPreflight } from './utils/preflight.js'
import { POLAR_UPGRADE_URL, FREE_TIER_MAX_SYNC } from './utils/constants.js'

/**
 * Load environment variables from .env and .env.local files in the project directory.
 * Values from .env.local override .env, but neither overrides existing process.env values.
 * This allows STORYBOOK_MCP_LICENSE and other vars to be stored in .env.local.
 */
function loadEnvFiles(cwd: string): void {
  const envFiles = ['.env', '.env.local'] // .env.local wins over .env
  const fromFiles: Record<string, string> = {}

  for (const file of envFiles) {
    const filePath = path.join(cwd, file)
    if (!fs.existsSync(filePath)) continue
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim()
        // Skip blanks and comments
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx === -1) continue
        const key = trimmed.slice(0, eqIdx).trim()
        let value = trimmed.slice(eqIdx + 1).trim()
        // Strip surrounding quotes
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1)
        }
        fromFiles[key] = value // later file (.env.local) overrides earlier (.env)
      }
    } catch {
      // Ignore unreadable files
    }
  }

  // Apply collected values — never override existing process.env (system / MCP config env takes priority)
  let loaded = 0
  for (const [key, value] of Object.entries(fromFiles)) {
    if (!(key in process.env)) {
      process.env[key] = value
      loaded++
    }
  }

  if (loaded > 0) {
    console.error(
      `[storybook-mcp] Loaded ${loaded} env var(s) from .env/.env.local`
    )
  }

  // Confirm license key presence (value masked)
  if (process.env.STORYBOOK_MCP_LICENSE) {
    console.error('[storybook-mcp] STORYBOOK_MCP_LICENSE is set in environment')
  }
}

/**
 * Serialize config to storybook-mcp.config.json.
 * Only writes user-facing fields — never rootDir (always CWD at runtime).
 * @param configPath  Absolute path to the config file
 * @param config      Resolved config object
 * @param overwrite   If false (default), skips if the file already exists
 */
function writeConfigFile(
  configPath: string,
  config: StorybookMCPConfig,
  overwrite = false
): boolean {
  if (!overwrite && fs.existsSync(configPath)) return false

  // Build the persisted object — only the fields a user would want to edit
  const persisted: Record<string, unknown> = {
    framework: config.framework,
    libraries: config.libraries,
    storyFilePattern: config.storyFilePattern,
    componentPatterns: config.componentPatterns,
    excludePatterns: config.excludePatterns
  }

  // Carry over optional fields only when explicitly set
  if (config.storybookVersion)
    persisted.storybookVersion = config.storybookVersion
  if (config.templatesDir) persisted.templatesDir = config.templatesDir
  // NOTE: licenseKey intentionally omitted — keep it in env vars / .env.local

  try {
    fs.writeFileSync(
      configPath,
      JSON.stringify(persisted, null, 2) + '\n',
      'utf-8'
    )
    return true
  } catch (err) {
    console.error(
      `[storybook-mcp] Warning: could not write config file: ${err}`
    )
    return false
  }
}

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
  resetLicense: boolean
  noWatch: boolean
  cleanupOnly: boolean
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
    resetLicense: args.includes('--reset-license'),
    noWatch: args.includes('--no-watch'),
    cleanupOnly: args.includes('--cleanup-only'),
    libName
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
  --cleanup-only  Remove Storybook scaffold files that conflict with generated stories, then exit
  --dry-run       Show what would be created without writing files
  --skip-init     Skip initial component sync
  --no-stories    Don't generate story files
  --no-tests      Don't generate test files  
  --no-docs       Don't generate MDX docs
  --no-update     Don't update existing files
  --no-watch      Disable background file watching (watcher is on by default)
  --force         Overwrite existing files
  --reset-license Clear the cached license result and re-validate against Polar API
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
  The variable is also auto-loaded from .env or .env.local in the project root.

LICENSE KEY PRIORITY (highest wins):
  1. System / MCP client environment (e.g., Claude Desktop config "env" block)
  2. .env.local in project root
  3. .env in project root
  4. licenseKey field in storybook-mcp.config.json

LICENSE:
  Free tier: ${FREE_TIER_MAX_SYNC} components, basic stories only
  Pro ($29 launch price): Unlimited components, tests, docs, all templates
  
  Get Pro: ${POLAR_UPGRADE_URL}
  Troubleshoot: run with --reset-license to force re-validation

MORE INFO:
  https://npmjs.com/package/forgekit-storybook-mcp
`)
}

async function main() {
  const cwd = process.cwd()
  const args = parseArgs()

  // Load .env / .env.local from project root BEFORE any config or license work
  loadEnvFiles(cwd)

  if (args.help) {
    showHelp()
    process.exit(0)
  }

  // Handle --cleanup-only: remove scaffold conflicts and exit (used as prestorybook script)
  if (args.cleanupOnly) {
    const removed = await removeScaffoldConflicts(cwd)
    if (removed.length > 0) {
      console.error(
        `[storybook-mcp] Removed ${removed.length} scaffold file(s) that conflicted with generated stories:`
      )
      for (const f of removed) {
        console.error(`  - ${f}`)
      }
    }
    process.exit(0)
  }

  // Handle --reset-license: clear cache then exit (user can re-run normally)
  if (args.resetLicense) {
    resetLicenseCache()
    console.error(
      '[storybook-mcp] License cache cleared. Re-run without --reset-license to validate your key.'
    )
    process.exit(0)
  }

  // Handle --setup command
  if (args.setup) {
    await runSetup(cwd, {
      dryRun: args.dryRun,
      force: args.force,
      libName: args.libName
    })

    // After setup, generate storybook-mcp.config.json with detected values
    if (!args.dryRun) {
      const detectedConfig = await autoDetectConfig(cwd)
      const configPath = path.join(cwd, 'storybook-mcp.config.json')
      const existed = fs.existsSync(configPath)
      const written = writeConfigFile(configPath, detectedConfig, true) // always overwrite during --setup
      if (written) {
        console.error(
          existed
            ? `[storybook-mcp] Updated storybook-mcp.config.json with detected values`
            : `[storybook-mcp] Created storybook-mcp.config.json — review and commit this file`
        )
      }
    }

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
          const subEntries = fs.readdirSync(path.join(baseDir, entry.name), {
            withFileTypes: true
          })
          for (const sub of subEntries) {
            if (
              sub.isDirectory() &&
              fs.existsSync(
                path.join(baseDir, entry.name, sub.name, '.storybook')
              )
            ) {
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
      ...configFile
    } as StorybookMCPConfig
    console.error(`[storybook-mcp] Loaded config from ${configPath}`)
  } else if (fs.existsSync(packagePath)) {
    // Try to load from package.json
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'))
    if (pkg['storybook-mcp']) {
      config = {
        ...DEFAULT_CONFIG,
        rootDir: cwd,
        ...pkg['storybook-mcp']
      } as StorybookMCPConfig
      console.error(`[storybook-mcp] Loaded config from package.json`)
      // Migrate package.json config to its own file
      if (writeConfigFile(configPath, config)) {
        console.error(
          `[storybook-mcp] Created storybook-mcp.config.json (migrated from package.json) — review and commit this file`
        )
      }
    } else {
      // Use default config with auto-detection
      config = await autoDetectConfig(cwd)
      if (writeConfigFile(configPath, config)) {
        console.error(
          `[storybook-mcp] Created storybook-mcp.config.json with auto-detected values — review and commit this file`
        )
      }
    }
  } else {
    // Use default config with auto-detection
    config = await autoDetectConfig(cwd)
    if (writeConfigFile(configPath, config)) {
      console.error(
        `[storybook-mcp] Created storybook-mcp.config.json with auto-detected values — review and commit this file`
      )
    }
  }

  // Validate config
  if (!config.libraries || config.libraries.length === 0) {
    console.error(
      '[storybook-mcp] Warning: No libraries configured. Using auto-detection.'
    )
    config = await autoDetectConfig(cwd)
  }

  console.error(`[storybook-mcp] Framework: ${config.framework}`)
  console.error(
    `[storybook-mcp] Libraries: ${config.libraries.map(l => l.name).join(', ')}`
  )

  // Ensure the prestorybook script exists in package.json so scaffold cleanup
  // runs automatically every time `npm run storybook` is invoked, without any
  // user action required.
  ensurePrestorybookScript(cwd)

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
  console.error(
    `[storybook-mcp] License: ${license.tier}${license.tier === 'free' ? ` (max ${license.maxSyncLimit} components)` : ''}`
  )

  // Run initialization unless skipped
  if (!args.skipInit) {
    console.error(`[storybook-mcp] Running component sync...`)

    const initResult = await initializeComponents(config, {
      generateStories: !args.noStories,
      generateTests: !args.noTests,
      generateDocs: !args.noDocs,
      updateExisting: !args.noUpdate,
      dryRun: args.dryRun,
      maxComponents: license.tier === 'free' ? license.maxSyncLimit : undefined
    })

    if (args.dryRun) {
      console.error(`[storybook-mcp] Dry run complete. Would have:`)
      console.error(
        `  Created: ${initResult.created.stories} stories, ${initResult.created.tests} tests, ${initResult.created.docs} docs`
      )
      console.error(
        `  Updated: ${initResult.updated.stories} stories, ${initResult.updated.tests} tests, ${initResult.updated.docs} docs`
      )
    }

    // If init-only mode, exit after initialization
    if (args.initOnly) {
      console.error(
        `[storybook-mcp] Initialization complete. Exiting (--init-only mode).`
      )
      process.exit(0)
    }
  } else {
    console.error(`[storybook-mcp] Skipping initialization (--skip-init)`)
  }

  // Start background file watcher unless disabled or dry-run
  let stopWatcher: (() => void) | null = null
  if (!args.noWatch && !args.dryRun) {
    stopWatcher = startFileWatcher(config, {
      generateStories: !args.noStories,
      generateTests: !args.noTests,
      generateDocs: !args.noDocs
    })
  } else if (args.noWatch) {
    console.error(`[storybook-mcp] File watching disabled (--no-watch)`)
  }

  // Ensure watcher is cleaned up on process exit
  const cleanup = () => {
    if (stopWatcher) {
      stopWatcher()
      stopWatcher = null
    }
  }
  process.once('SIGINT', () => {
    cleanup()
    process.exit(0)
  })
  process.once('SIGTERM', () => {
    cleanup()
    process.exit(0)
  })
  process.once('exit', cleanup)

  console.error(`[storybook-mcp] Starting MCP server...`)
  await runServer(config)
  cleanup()
}

/**
 * Inject a `prestorybook` script into the consumer's package.json if one doesn't
 * already exist. This ensures scaffold file cleanup runs automatically every time
 * the consumer runs `npm run storybook`, with no manual action required.
 */
function ensurePrestorybookScript(rootDir: string): void {
  const pkgPath = path.join(rootDir, 'package.json')
  if (!fs.existsSync(pkgPath)) return
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
    if (!pkg.scripts) return // no scripts block — nothing to hook into
    if (pkg.scripts.prestorybook) return // already set, don't overwrite
    pkg.scripts.prestorybook = 'npx forgekit-storybook-mcp --cleanup-only'
    fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
    console.error(
      `[storybook-mcp] Added "prestorybook" script to package.json — scaffold cleanup will now run automatically before Storybook starts`
    )
  } catch {
    // Non-fatal — if we can't write, just skip
  }
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
          if (
            !entry.isDirectory() ||
            entry.name.startsWith('.') ||
            entry.name === 'node_modules'
          )
            continue
          const entryPath = path.join(dir, entry.name)
          const srcPath = path.join(entryPath, 'src')
          const hasProjectJson = fs.existsSync(
            path.join(entryPath, 'project.json')
          )

          if (fs.existsSync(srcPath) && hasProjectJson) {
            const relPath = path.relative(rootDir, entryPath)
            const libRelPath = path.relative(rootDir, entryPath)
            // Build a readable name from the path: libs/shared/ui → shared-ui
            const nameParts = path
              .relative(path.join(rootDir, base), entryPath)
              .split(path.sep)
            const libName = nameParts.join('-')
            const prefix = nameParts
              .map(p => p.charAt(0).toUpperCase() + p.slice(1))
              .join(' / ')

            libraries.push({
              name: libName,
              path: relPath,
              storyTitlePrefix: prefix
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
      {
        check: 'src/components',
        path: '.',
        name: 'components',
        prefix: 'Components'
      },
      { check: 'src/lib', path: '.', name: 'lib', prefix: 'Lib' },
      {
        check: 'packages/ui/src',
        path: 'packages/ui',
        name: 'ui',
        prefix: 'UI'
      },
      {
        check: 'apps/web/src/components',
        path: 'apps/web',
        name: 'web',
        prefix: 'Web / Components'
      }
    ]

    for (const { check, path: libPath, name, prefix } of possiblePaths) {
      const fullPath = path.join(rootDir, check)
      if (fs.existsSync(fullPath)) {
        libraries.push({
          name,
          path: libPath,
          storyTitlePrefix: prefix
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
        storyTitlePrefix: 'Components'
      })
    }
  }

  // Detect framework from dependencies
  const packagePath = path.join(rootDir, 'package.json')
  if (fs.existsSync(packagePath)) {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'))
    const deps = {
      ...pkg.dependencies,
      ...pkg.devDependencies
    }

    if (deps['@chakra-ui/react']) {
      framework = 'chakra'
    } else {
      // shadcn/ui detection — cast a wide net:
      //   components.json  → definitive shadcn CLI project
      //   @radix-ui/*      → any Radix primitive (traditional shadcn)
      //   @base-ui-components/react → Base UI (newer shadcn replacement for Radix)
      //   class-variance-authority → cva, canonical shadcn pattern
      //   tailwindcss      → almost always paired with shadcn in React projects
      //   lucide-react     → the default icon set bundled by shadcn CLI
      const hasComponentsJson = fs.existsSync(
        path.join(rootDir, 'components.json')
      )
      const hasAnyRadix = Object.keys(deps).some(k =>
        k.startsWith('@radix-ui/')
      )
      if (
        hasComponentsJson ||
        hasAnyRadix ||
        deps['@base-ui-components/react'] ||
        deps['class-variance-authority'] ||
        deps['lucide-react'] ||
        deps.tailwindcss
      ) {
        framework = 'shadcn'
      } else if (deps['tamagui']) {
        framework = 'tamagui'
      } else if (deps['@gluestack-ui/themed'] || deps['@gluestack-ui/config']) {
        framework = 'gluestack'
      }
    }
  }

  console.error(
    `[storybook-mcp] Auto-detected ${libraries.length} libraries, framework: ${framework}`
  )

  return {
    ...DEFAULT_CONFIG,
    rootDir,
    libraries,
    framework
  } as StorybookMCPConfig
}

// Run
main().catch(error => {
  console.error('[storybook-mcp] Fatal error:', error)
  process.exit(1)
})
