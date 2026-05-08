/**
 * Storybook Setup Utility
 * Creates .storybook config, updates package.json scripts, and prints dependencies.
 *
 * Detects:
 *  - Project type: Nx monorepo vs standard
 *  - UI framework: Chakra, shadcn, Tamagui, Gluestack, vanilla
 *  - Next.js: presence of `next` in deps + a `next.config.{js,ts,mjs,cjs}`
 *
 * Storybook 10 is the supported floor. The Storybook framework package is
 * chosen as follows:
 *  - Next.js project           → @storybook/nextjs
 *  - Tamagui (no Next.js)      → @storybook/react-webpack5
 *  - Anything else             → @storybook/react-vite
 */

import fs from 'node:fs'
import path from 'node:path'

// ===========================================
// Types
// ===========================================

export type FrameworkType =
  | 'chakra'
  | 'shadcn'
  | 'tamagui'
  | 'gluestack'
  | 'vanilla'
export type ProjectType = 'nx' | 'standard'

export interface SetupConfig {
  projectType: ProjectType
  framework: FrameworkType
  isNextjs: boolean
  nxLibName?: string
  rootDir: string
  /** Detected installed Storybook version (e.g. "10.3.1") if any */
  detectedVersion?: string
}

export interface SetupResult {
  projectType: ProjectType
  framework: FrameworkType
  isNextjs: boolean
  nxLibName?: string
  filesCreated: string[]
  scriptsAdded: string[]
  dependencies: {
    dev: string[]
    prod: string[]
    notices: string[]
  }
}

// ===========================================
// Detection Functions
// ===========================================

/**
 * Detect if this is an Nx monorepo
 */
export function detectProjectType(rootDir: string): ProjectType {
  const nxJsonPath = path.join(rootDir, 'nx.json')
  return fs.existsSync(nxJsonPath) ? 'nx' : 'standard'
}

/** Read package.json, returning {} if missing/unreadable */
function readPackageJson(rootDir: string): Record<string, unknown> {
  const pkgPath = path.join(rootDir, 'package.json')
  if (!fs.existsSync(pkgPath)) return {}
  try {
    return JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  } catch {
    return {}
  }
}

function getDeps(rootDir: string): Record<string, string> {
  const pkg = readPackageJson(rootDir) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  return { ...pkg.dependencies, ...pkg.devDependencies }
}

/**
 * Detect Next.js project: requires `next` in deps AND a next.config.* file at root.
 * Both signals are needed to avoid false positives — a transitive `next` dep
 * doesn't make the project a Next.js app.
 */
export function detectNextjs(rootDir: string): boolean {
  const deps = getDeps(rootDir)
  if (!deps.next) return false
  const configFiles = [
    'next.config.js',
    'next.config.ts',
    'next.config.mjs',
    'next.config.cjs'
  ]
  return configFiles.some(f => fs.existsSync(path.join(rootDir, f)))
}

/**
 * Detect UI framework from package.json dependencies and project signals.
 *
 * shadcn detection casts a wide net (matches cli.ts/autoDetectConfig):
 *   components.json → definitive shadcn CLI project
 *   @radix-ui/*     → any Radix primitive
 *   @base-ui-components/react → newer shadcn replacement for Radix
 *   class-variance-authority → canonical shadcn pattern
 *   tailwindcss     → almost always paired with shadcn
 *   lucide-react    → default icon set bundled by shadcn CLI
 */
export function detectFramework(rootDir: string): FrameworkType {
  const deps = getDeps(rootDir)

  if (deps['@chakra-ui/react']) return 'chakra'
  if (deps.tamagui || deps['@tamagui/core']) return 'tamagui'
  if (deps['@gluestack-ui/themed'] || deps['@gluestack-ui/config']) {
    return 'gluestack'
  }

  const hasComponentsJson = fs.existsSync(path.join(rootDir, 'components.json'))
  const hasAnyRadix = Object.keys(deps).some(k => k.startsWith('@radix-ui/'))
  if (
    hasComponentsJson ||
    hasAnyRadix ||
    deps['@base-ui-components/react'] ||
    deps['class-variance-authority'] ||
    deps['lucide-react'] ||
    deps.tailwindcss
  ) {
    return 'shadcn'
  }

  return 'vanilla'
}

/**
 * Detect the installed Storybook version. Returns the resolved semver string
 * (e.g. "10.3.1") or null if no installation can be found.
 *
 * Resolution order:
 *  1. node_modules/storybook/package.json → version (most accurate)
 *  2. package.json devDependencies/dependencies "storybook" range → strip ^/~
 */
export function detectInstalledStorybookVersion(
  rootDir: string
): string | null {
  // 1. Prefer installed version from node_modules
  const nmPkg = path.join(rootDir, 'node_modules', 'storybook', 'package.json')
  if (fs.existsSync(nmPkg)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(nmPkg, 'utf-8')) as {
        version?: string
      }
      if (parsed.version) return parsed.version
    } catch {
      /* ignore */
    }
  }

  // 2. Fall back to declared range in package.json
  const deps = getDeps(rootDir)
  const declared = deps.storybook
  if (declared) {
    return declared.replace(/^[\^~>=<\s]+/, '').trim() || null
  }

  return null
}

/**
 * Detect the Storybook version peerDep declared by an installed @nx/storybook.
 * Useful in Nx monorepos where the user manages Storybook through Nx.
 *
 * Returns the resolved version (e.g. "10.1.0") or null if @nx/storybook is not
 * installed or doesn't declare a storybook peerDep.
 */
export function detectNxStorybookVersion(rootDir: string): string | null {
  const pkgPath = path.join(
    rootDir,
    'node_modules',
    '@nx',
    'storybook',
    'package.json'
  )
  if (!fs.existsSync(pkgPath)) return null
  try {
    const parsed = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as {
      peerDependencies?: Record<string, string>
    }
    const range = parsed.peerDependencies?.storybook
    if (!range) return null
    return range.replace(/^[\^~>=<\s]+/, '').trim() || null
  } catch {
    return null
  }
}

/**
 * Find the main library name in an Nx monorepo.
 * Prioritizes UI-related libraries over others.
 */
export function findNxLibName(rootDir: string): string | undefined {
  const libsDir = path.join(rootDir, 'libs')
  const packagesDir = path.join(rootDir, 'packages')

  const searchDirs = [libsDir, packagesDir].filter(d => fs.existsSync(d))

  // Check for nested structure like libs/shared/ui first
  const nestedUiPaths = [
    { dir: path.join(libsDir, 'shared', 'ui'), name: 'shared-ui' },
    { dir: path.join(libsDir, 'ui'), name: 'ui' },
    { dir: path.join(packagesDir, 'ui'), name: 'ui' }
  ]

  for (const { dir, name } of nestedUiPaths) {
    if (fs.existsSync(dir)) return name
  }

  const uiRelatedNames = [
    'ui',
    'components',
    'design-system',
    'shared-ui',
    'core-ui'
  ]
  const allLibs: Array<{
    name: string
    hasStorybook: boolean
    isUiRelated: boolean
  }> = []

  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue

    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const projectJson = path.join(dir, entry.name, 'project.json')
      const srcDir = path.join(dir, entry.name, 'src')

      if (fs.existsSync(projectJson) || fs.existsSync(srcDir)) {
        let hasStorybook = false

        if (fs.existsSync(projectJson)) {
          try {
            const project = JSON.parse(fs.readFileSync(projectJson, 'utf-8'))
            if (project.targets?.storybook) hasStorybook = true
          } catch {
            /* ignore */
          }
        }

        const lower = entry.name.toLowerCase()
        const isUiRelated =
          uiRelatedNames.includes(lower) ||
          lower.includes('ui') ||
          lower.includes('component')

        allLibs.push({ name: entry.name, hasStorybook, isUiRelated })
      }
    }
  }

  allLibs.sort((a, b) => {
    if (a.hasStorybook && !b.hasStorybook) return -1
    if (!a.hasStorybook && b.hasStorybook) return 1
    if (a.isUiRelated && !b.isUiRelated) return -1
    if (!a.isUiRelated && b.isUiRelated) return 1
    return 0
  })

  return allLibs[0]?.name
}

/**
 * Resolve the actual filesystem path for an Nx library name.
 */
function resolveNxLibPath(rootDir: string, nxLibName: string): string | null {
  const libsDir = path.join(rootDir, 'libs')
  const packagesDir = path.join(rootDir, 'packages')

  const nestedPaths: Array<{ dir: string; name: string }> = [
    { dir: path.join(libsDir, 'shared', 'ui'), name: 'shared-ui' },
    { dir: path.join(libsDir, 'ui'), name: 'ui' },
    { dir: path.join(packagesDir, 'ui'), name: 'ui' }
  ]
  for (const { dir, name } of nestedPaths) {
    if (name === nxLibName && fs.existsSync(dir)) {
      return path.relative(rootDir, dir)
    }
  }

  for (const base of ['libs', 'packages']) {
    const fullPath = path.join(rootDir, base, nxLibName)
    if (fs.existsSync(fullPath)) {
      return `${base}/${nxLibName}`
    }
  }
  return null
}

// ===========================================
// File Generation
// ===========================================

/**
 * Pick the Storybook framework package given UI framework + Next.js flag.
 * Next.js wins when present — official guidance is to use @storybook/nextjs
 * even when paired with a UI lib like Chakra/shadcn (the UI lib still drives
 * preview decorators).
 */
function getFrameworkPackage(framework: FrameworkType, isNextjs: boolean): string {
  if (isNextjs) return '@storybook/nextjs'
  if (framework === 'tamagui') return '@storybook/react-webpack5'
  return '@storybook/react-vite'
}

/**
 * Generate main.ts content
 */
function generateMainTs(config: SetupConfig): string {
  const { projectType, framework, isNextjs } = config
  const frameworkPackage = getFrameworkPackage(framework, isNextjs)

  // Storybook 10: docs and a11y addons are still installed/declared explicitly
  // even though essentials/interactions are bundled into the main package.
  const addons = ['@storybook/addon-docs', '@storybook/addon-a11y']

  // Stories glob — Storybook 10 prefers the combined `mdx | stories.*` form
  // so MDX docs and CSF stories are picked up by the same pattern.
  const storiesGlob =
    projectType === 'nx'
      ? ['../libs/**/src/**/*.@(mdx|stories.@(js|jsx|ts|tsx))']
      : ['../src/**/*.@(mdx|stories.@(js|jsx|ts|tsx))']

  return `import type { StorybookConfig } from '${frameworkPackage}';

const config: StorybookConfig = {
  stories: ${JSON.stringify(storiesGlob, null, 4).replace(/\n/g, '\n  ')},
  addons: ${JSON.stringify(addons, null, 4).replace(/\n/g, '\n  ')},
  framework: {
    name: '${frameworkPackage}',
    options: {},
  },
  typescript: {
    reactDocgen: 'react-docgen-typescript',
  },
};

export default config;
`
}

/**
 * Pick the Storybook type-package import path used in `preview.tsx`.
 * Mirrors getFrameworkPackage but for the preview file's `import type { Preview }`.
 */
function getPreviewTypeSource(framework: FrameworkType, isNextjs: boolean): string {
  if (isNextjs) return '@storybook/nextjs'
  if (framework === 'tamagui') return '@storybook/react-webpack5'
  return '@storybook/react-vite'
}

/**
 * Generate preview.tsx content based on framework. JSX inside .ts files is fine
 * with Storybook's TypeScript config (it injects React.createElement at build time).
 */
function generatePreviewTs(config: SetupConfig): string {
  const { framework, isNextjs } = config
  const previewSource = getPreviewTypeSource(framework, isNextjs)

  switch (framework) {
    case 'chakra':
      return generateChakraPreview(previewSource, isNextjs)
    case 'shadcn':
      return generateShadcnPreview(previewSource, isNextjs)
    case 'tamagui':
      return generateTamaguiPreview(previewSource)
    case 'gluestack':
      return generateGluestackPreview(previewSource)
    default:
      return generateVanillaPreview(previewSource, isNextjs)
  }
}

// Backwards-compat alias: older callers referenced generatePreviewTsx.
function generatePreviewTsx(config: SetupConfig): string {
  return generatePreviewTs(config)
}

function nextjsParametersBlock(isNextjs: boolean): string {
  if (!isNextjs) return ''
  return `    nextjs: {
      // Use the App Router by default — flip to false to emulate the Pages Router.
      appDirectory: true,
    },
`
}

function generateChakraPreview(typeSource: string, isNextjs: boolean): string {
  return `import type { Preview } from '${typeSource}';
import { ChakraProvider, extendTheme } from '@chakra-ui/react';
import React from 'react';

// Import your theme if you have one
// import { theme } from '../src/theme';

const theme = extendTheme({
  // Your theme customizations here
});

const preview: Preview = {
  parameters: {
${nextjsParametersBlock(isNextjs)}    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  decorators: [
    (Story) => (
      <ChakraProvider theme={theme}>
        <Story />
      </ChakraProvider>
    ),
  ],
};

export default preview;
`
}

function generateShadcnPreview(typeSource: string, isNextjs: boolean): string {
  return `import type { Preview } from '${typeSource}';
import '../src/index.css'; // or your global CSS with Tailwind
import React from 'react';

// If you have a ThemeProvider, import and use it here
// import { ThemeProvider } from '../src/components/theme-provider';

const preview: Preview = {
  parameters: {
${nextjsParametersBlock(isNextjs)}    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#ffffff' },
        { name: 'dark', value: '#020817' },
      ],
    },
  },
  decorators: [
    (Story) => (
      <div className="font-sans antialiased">
        <Story />
      </div>
    ),
    // Uncomment if using ThemeProvider:
    // (Story) => (
    //   <ThemeProvider attribute="class" defaultTheme="light">
    //     <Story />
    //   </ThemeProvider>
    // ),
  ],
};

export default preview;
`
}

function generateTamaguiPreview(typeSource: string): string {
  return `import type { Preview } from '${typeSource}';
import { TamaguiProvider } from 'tamagui';
import React from 'react';

// Import your Tamagui config
// import config from '../tamagui.config';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  decorators: [
    (Story) => (
      // Replace with your actual config import
      <TamaguiProvider config={{} as any} defaultTheme="light">
        <Story />
      </TamaguiProvider>
    ),
  ],
};

export default preview;
`
}

function generateGluestackPreview(typeSource: string): string {
  return `import type { Preview } from '${typeSource}';
import { GluestackUIProvider } from '@gluestack-ui/themed';
import { config } from '@gluestack-ui/config';
import React from 'react';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  decorators: [
    (Story) => (
      <GluestackUIProvider config={config}>
        <Story />
      </GluestackUIProvider>
    ),
  ],
};

export default preview;
`
}

function generateVanillaPreview(typeSource: string, isNextjs: boolean): string {
  return `import type { Preview } from '${typeSource}';
import React from 'react';

// Import your global styles if any
// import '../src/index.css';

const preview: Preview = {
  parameters: {
${nextjsParametersBlock(isNextjs)}    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  decorators: [
    (Story) => <Story />,
  ],
};

export default preview;
`
}

// ===========================================
// Package.json Scripts
// ===========================================

interface PackageScripts {
  storybook: string
  'build-storybook': string
  'test-storybook': string
  /** Optional lifecycle hook — injected so scaffold cleanup runs before Storybook */
  prestorybook?: string
}

function getScripts(config: SetupConfig): PackageScripts {
  if (config.projectType === 'nx' && config.nxLibName) {
    return {
      storybook: `nx storybook ${config.nxLibName}`,
      'build-storybook': `nx build-storybook ${config.nxLibName}`,
      'test-storybook': 'test-storybook'
    }
  }

  return {
    storybook: 'storybook dev -p 6006',
    'build-storybook': 'storybook build',
    'test-storybook': 'test-storybook'
  }
}

// ===========================================
// Dependencies
// ===========================================

interface Dependencies {
  dev: string[]
  prod: string[]
  notices: string[]
}

/**
 * Build the dependency list, using the detected Storybook version when present.
 *
 * Behaviour:
 *  - If a Storybook ≥10 install is detected (node_modules or package.json),
 *    pin all @storybook packages to that exact range (`^10.3.1` style).
 *  - If a Storybook <10 install is detected, emit an upgrade notice and pin
 *    to the default 10.x range.
 *  - If nothing is detected, pin to the default 10.x range silently.
 */
function getDependencies(config: SetupConfig): Dependencies {
  const { framework, isNextjs, detectedVersion } = config
  const notices: string[] = []

  // Default fallback range
  let range = '^10.0.0'

  if (detectedVersion) {
    const major = parseInt(detectedVersion.split('.')[0], 10)
    if (major >= 10) {
      range = `^${detectedVersion}`
    } else {
      notices.push(
        `Detected storybook@${detectedVersion} — please upgrade to v10. ` +
          `Run: npx storybook@latest upgrade`
      )
    }
  }

  // Storybook 10.x — addons (essentials, interactions, blocks) are bundled into
  // the main `storybook` package. We still install separate addon packages for
  // docs and a11y, plus the framework package and react integration.
  const dev: string[] = [
    `storybook@${range}`,
    `@storybook/react@${range}`,
    `@storybook/addon-docs@${range}`,
    `@storybook/addon-a11y@${range}`,
    '@storybook/test-runner@^0.24.0'
  ]

  // Framework package — Next.js wins when present.
  if (isNextjs) {
    dev.push(`@storybook/nextjs@${range}`)
  } else if (framework === 'tamagui') {
    dev.push(`@storybook/react-webpack5@${range}`)
  } else {
    dev.push(`@storybook/react-vite@${range}`)
  }

  if (config.projectType === 'nx') {
    dev.push('@nx/storybook@latest')
  }

  return { dev, prod: [], notices }
}

// ===========================================
// Main Setup Function
// ===========================================

export interface SetupOptions {
  dryRun?: boolean
  force?: boolean
  libName?: string
}

export async function runSetup(
  rootDir: string,
  options: SetupOptions = {}
): Promise<SetupResult> {
  const { dryRun = false, force = false, libName } = options

  // Detect configuration
  const projectType = detectProjectType(rootDir)
  const framework = detectFramework(rootDir)
  const isNextjs = detectNextjs(rootDir)
  const nxLibName =
    libName || (projectType === 'nx' ? findNxLibName(rootDir) : undefined)
  const detectedVersion =
    detectInstalledStorybookVersion(rootDir) ??
    detectNxStorybookVersion(rootDir) ??
    undefined

  const config: SetupConfig = {
    projectType,
    framework,
    isNextjs,
    nxLibName,
    rootDir,
    detectedVersion: detectedVersion ?? undefined
  }

  const result: SetupResult = {
    projectType,
    framework,
    isNextjs,
    nxLibName,
    filesCreated: [],
    scriptsAdded: [],
    dependencies: getDependencies(config)
  }

  console.log('\n🔧 Storybook Setup\n')
  console.log(
    `  Project type: ${projectType === 'nx' ? 'Nx Monorepo' : 'Standard'}`
  )
  console.log(`  UI Framework: ${framework}${isNextjs ? ' (+ Next.js)' : ''}`)
  if (nxLibName) console.log(`  Nx Library: ${nxLibName}`)
  if (detectedVersion) console.log(`  Detected Storybook: ${detectedVersion}`)
  console.log('')

  // Nx: guide user through Nx generator instead of writing files
  if (projectType === 'nx') {
    const targetLib = nxLibName || '<project-name>'
    const nxStorybookInstalled = fs.existsSync(
      path.join(rootDir, 'node_modules', '@nx', 'storybook')
    )

    const libBasePath = nxLibName ? resolveNxLibPath(rootDir, nxLibName) : null
    const libStorybookDir = libBasePath
      ? path.join(rootDir, libBasePath, '.storybook')
      : null
    const nxStorybookConfigured =
      libStorybookDir && fs.existsSync(libStorybookDir)

    if (nxStorybookConfigured) {
      console.log(`  ✅ Storybook already configured for ${targetLib} via Nx`)
      console.log(`     Config: ${libBasePath}/.storybook/`)
      console.log('')
    } else {
      console.log(
        '  📋 Nx monorepo detected — use the Nx Storybook generator for proper setup:\n'
      )

      let step = 1
      if (!nxStorybookInstalled) {
        console.log(`  ${step++}. Install @nx/storybook:`)
        console.log(`     npm install -D @nx/storybook@latest`)
        console.log('')
      }
      console.log(`  ${step++}. Generate Storybook configuration:`)
      console.log(`     npx nx g @nx/storybook:configuration ${targetLib}`)
      console.log('')

      const createdPath = libBasePath || `libs/${targetLib}`
      console.log('  This creates:')
      console.log(`     • ${createdPath}/.storybook/main.ts`)
      console.log(`     • ${createdPath}/.storybook/preview.tsx`)
      console.log(`     • storybook + build-storybook targets in project.json`)
      console.log('')

      console.log(`  ${step++}. Install remaining Storybook packages:`)
      console.log(`     npm install -D ${result.dependencies.dev.join(' ')}`)
      console.log('')
      console.log(`  ${step}. Run Storybook:`)
      console.log(`     npx nx storybook ${targetLib}`)
      console.log('')
    }

    if (result.dependencies.notices.length > 0) {
      console.log('  ⚠️  Notices:')
      for (const n of result.dependencies.notices) console.log(`     • ${n}`)
      console.log('')
    }

    if (dryRun) console.log('ℹ️  Dry run mode\n')

    return result
  }

  // Standard project — write .storybook/{main.ts, preview.tsx}
  const storybookDir = path.join(rootDir, '.storybook')

  if (!fs.existsSync(storybookDir)) {
    if (!dryRun) fs.mkdirSync(storybookDir, { recursive: true })
    console.log(`  📁 Created .storybook/`)
  }

  // main.ts
  const mainPath = path.join(storybookDir, 'main.ts')
  const mainExists = fs.existsSync(mainPath)
  if (!mainExists || force) {
    if (!dryRun) fs.writeFileSync(mainPath, generateMainTs(config))
    result.filesCreated.push('.storybook/main.ts')
    console.log(
      `  📄 ${mainExists ? 'Overwrote' : 'Created'} .storybook/main.ts`
    )
  } else {
    console.log(
      `  ⏭️  Skipped .storybook/main.ts (already exists, use --force to overwrite)`
    )
  }

  // preview.tsx
  const previewPath = path.join(storybookDir, 'preview.tsx')
  const previewExists = fs.existsSync(previewPath)
  if (!previewExists || force) {
    if (!dryRun) fs.writeFileSync(previewPath, generatePreviewTs(config))
    result.filesCreated.push('.storybook/preview.tsx')
    console.log(
      `  📄 ${previewExists ? 'Overwrote' : 'Created'} .storybook/preview.tsx`
    )
  } else {
    console.log(
      `  ⏭️  Skipped .storybook/preview.tsx (already exists, use --force to overwrite)`
    )
  }

  // Update package.json scripts
  const packagePath = path.join(rootDir, 'package.json')
  if (fs.existsSync(packagePath)) {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'))
    const scripts = getScripts(config)
    const scriptsToAdd: string[] = []
    pkg.scripts = pkg.scripts || {}

    for (const [name, command] of Object.entries(scripts)) {
      if (!pkg.scripts[name] || force) {
        pkg.scripts[name] = command
        scriptsToAdd.push(name)
      }
    }

    if (scriptsToAdd.length > 0) {
      if (!dryRun) {
        fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n')
      }
      result.scriptsAdded = scriptsToAdd
      console.log(
        `  📦 Added scripts to package.json: ${scriptsToAdd.join(', ')}`
      )
    } else {
      console.log(`  ⏭️  Scripts already exist in package.json`)
    }
  }

  // Print dependencies and notices
  console.log('\n📦 Install these dependencies:\n')
  console.log(`  npm install -D ${result.dependencies.dev.join(' ')}`)
  if (result.dependencies.prod.length > 0) {
    console.log(`  npm install ${result.dependencies.prod.join(' ')}`)
  }
  console.log('')

  if (result.dependencies.notices.length > 0) {
    console.log('⚠️  Notices:')
    for (const n of result.dependencies.notices) console.log(`  • ${n}`)
    console.log('')
  }

  console.log('📋 Next steps:\n')
  console.log('  1. Run the install command above')
  console.log('  2. Review .storybook/preview.tsx and customize as needed')
  if (framework !== 'vanilla') {
    console.log(
      `  3. Ensure your ${framework} theme/config is properly imported in preview.tsx`
    )
  }
  console.log(`  ${framework !== 'vanilla' ? '4' : '3'}. Run: npm run storybook`)
  console.log('')

  if (dryRun) console.log('ℹ️  Dry run mode - no files were written\n')

  return result
}
