/**
 * Storybook Setup Utility
 * Creates .storybook config, updates package.json scripts, and prints dependencies
 */

import fs from 'node:fs'
import path from 'node:path'
import { THRESHOLDS, DEFAULT_STORYBOOK_VERSION } from './constants.js'

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
  nxLibName?: string
  rootDir: string
}

export interface SetupResult {
  projectType: ProjectType
  framework: FrameworkType
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

/**
 * Detect UI framework from package.json dependencies
 */
export function detectFramework(rootDir: string): FrameworkType {
  const packagePath = path.join(rootDir, 'package.json')

  if (!fs.existsSync(packagePath)) {
    return 'vanilla'
  }

  try {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'))
    const deps = {
      ...pkg.dependencies,
      ...pkg.devDependencies
    }

    // Check in order of specificity
    if (deps['@chakra-ui/react']) {
      return 'chakra'
    }

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
    const hasAnyRadix = Object.keys(deps).some(k => k.startsWith('@radix-ui/'))
    if (
      hasComponentsJson ||
      hasAnyRadix ||
      deps['@base-ui-components/react'] ||
      deps['class-variance-authority'] ||
      deps['lucide-react'] ||
      deps.tailwindcss
    ) {
      // Likely shadcn/ui (or a compatible tailwind-based design system)
      return 'shadcn'
    }
    if (deps.tamagui) {
      return 'tamagui'
    }
    if (deps['@gluestack-ui/themed'] || deps['@gluestack-ui/config']) {
      return 'gluestack'
    }

    return 'vanilla'
  } catch {
    return 'vanilla'
  }
}

/**
 * Detect the Storybook version installed in the consumer project.
 * Checks node_modules first (actual installed), then package.json declarations.
 * Returns the bare version string (e.g. "10.3.1") or null if not found.
 */
export function detectInstalledStorybookVersion(
  rootDir: string
): string | null {
  // 1. Check actual installed package
  const nmSbPkg = path.join(
    rootDir,
    'node_modules',
    'storybook',
    'package.json'
  )
  if (fs.existsSync(nmSbPkg)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(nmSbPkg, 'utf-8'))
      if (typeof pkg.version === 'string') return pkg.version
    } catch {
      /* ignore */
    }
  }

  // 2. Fall back to package.json declaration (strip ^ ~ >= < prefixes)
  const packagePath = path.join(rootDir, 'package.json')
  if (fs.existsSync(packagePath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'))
      const deps = {
        ...(pkg.dependencies ?? {}),
        ...(pkg.devDependencies ?? {})
      }
      const raw = deps['storybook'] ?? deps['@storybook/core']
      if (typeof raw === 'string') {
        return raw.replace(/^[\^~>=<\s]+/, '').split(/\s/)[0]
      }
    } catch {
      /* ignore */
    }
  }

  return null
}

/**
 * For Nx projects, detect the Storybook version that @nx/storybook was built for.
 * Uses peerDependencies of @nx/storybook in node_modules, then falls back to
 * the general installed-version check.
 */
export function detectNxStorybookVersion(rootDir: string): string | null {
  const nxSbPkg = path.join(
    rootDir,
    'node_modules',
    '@nx',
    'storybook',
    'package.json'
  )
  if (fs.existsSync(nxSbPkg)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(nxSbPkg, 'utf-8'))
      const peerDeps: Record<string, string> = pkg.peerDependencies ?? {}
      const raw = peerDeps['storybook'] ?? peerDeps['@storybook/core']
      if (typeof raw === 'string') {
        return raw.replace(/^[\^~>=<\s]+/, '').split(/\s/)[0]
      }
    } catch {
      /* ignore */
    }
  }

  return detectInstalledStorybookVersion(rootDir)
}

/**
 * Find the main library name in an Nx monorepo
 * Prioritizes UI-related libraries over others
 */
export function findNxLibName(rootDir: string): string | undefined {
  // Check common locations
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
    if (fs.existsSync(dir)) {
      return name
    }
  }

  // Prioritize libraries with UI-related names
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
      if (entry.isDirectory()) {
        const projectJson = path.join(dir, entry.name, 'project.json')
        const srcDir = path.join(dir, entry.name, 'src')

        if (fs.existsSync(projectJson) || fs.existsSync(srcDir)) {
          let hasStorybook = false

          // Check for storybook target in project.json
          if (fs.existsSync(projectJson)) {
            try {
              const project = JSON.parse(fs.readFileSync(projectJson, 'utf-8'))
              if (project.targets?.storybook) {
                hasStorybook = true
              }
            } catch {
              // ignore
            }
          }

          const isUiRelated =
            uiRelatedNames.includes(entry.name.toLowerCase()) ||
            entry.name.toLowerCase().includes('ui') ||
            entry.name.toLowerCase().includes('component')

          allLibs.push({
            name: entry.name,
            hasStorybook,
            isUiRelated
          })
        }
      }
    }
  }

  // Sort: prioritize storybook > UI-related > others
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
 * findNxLibName() returns only the name; libraries can live in libs/ or packages/.
 */
function resolveNxLibPath(rootDir: string, nxLibName: string): string | null {
  // nxLibName can be "ui", "shared-ui", "portal-ui", etc.
  // The name is derived from the path: libs/shared/ui → "shared-ui"
  // So we convert dashes back to path separators and search

  for (const base of ['libs', 'packages']) {
    const baseDir = path.join(rootDir, base)
    if (!fs.existsSync(baseDir)) continue

    // Try direct match: libs/<nxLibName>
    const directPath = path.join(baseDir, nxLibName)
    if (fs.existsSync(directPath)) {
      return `${base}/${nxLibName}`
    }

    // Try nested match: convert "shared-ui" → "shared/ui"
    const nestedPath = path.join(baseDir, ...nxLibName.split('-'))
    if (fs.existsSync(nestedPath)) {
      return path.relative(rootDir, nestedPath).replace(/\\/g, '/')
    }

    // Walk up to 2 levels deep looking for a project.json with matching name
    const walkFind = (dir: string, depth: number): string | null => {
      if (depth > 2) return null
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (
          !entry.isDirectory() ||
          entry.name.startsWith('.') ||
          entry.name === 'node_modules'
        )
          continue
        const entryPath = path.join(dir, entry.name)
        const projectJsonPath = path.join(entryPath, 'project.json')

        if (fs.existsSync(projectJsonPath)) {
          // Check if project.json name matches
          try {
            const project = JSON.parse(
              fs.readFileSync(projectJsonPath, 'utf-8')
            )
            if (project.name === nxLibName) {
              return path.relative(rootDir, entryPath).replace(/\\/g, '/')
            }
          } catch {
            /* ignore */
          }

          // Also check by derived name from path
          const nameParts = path.relative(baseDir, entryPath).split(path.sep)
          if (nameParts.join('-') === nxLibName) {
            return path.relative(rootDir, entryPath).replace(/\\/g, '/')
          }
        }

        const found = walkFind(entryPath, depth + 1)
        if (found) return found
      }
      return null
    }

    const found = walkFind(baseDir, 0)
    if (found) return found
  }

  return null
}

// ===========================================
// File Generation
// ===========================================

/**
 * Generate main.ts content
 */
function generateMainTs(config: SetupConfig): string {
  const { projectType, framework } = config

  const addons: string[] = ['@storybook/addon-docs', '@storybook/addon-a11y']

  // Detect if this is a React Native/Expo project
  const packagePath = path.join(config.rootDir, 'package.json')
  let isReactNative = false
  if (fs.existsSync(packagePath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'))
      const deps = { ...pkg.dependencies, ...pkg.devDependencies }
      isReactNative = !!(deps['react-native'] || deps['expo'])
    } catch {
      // Ignore errors
    }
  }

  // Stories glob — include app directory for React Native/Expo projects
  const storiesGlob = ['../src/**/*.@(mdx|stories.@(js|jsx|ts|tsx))']

  // Add app directory for Expo Router / React Native projects
  if (isReactNative) {
    storiesGlob.push('../app/**/*.@(mdx|stories.@(js|jsx|ts|tsx))')
  }

  // Determine the framework package
  let frameworkPackage = '@storybook/react-vite'
  if (framework === 'tamagui') {
    // Tamagui works best with webpack for now
    frameworkPackage = '@storybook/react-webpack5'
  } else {
    // Add Vitest addon for Vite-based projects (SB 10+ recommendation)
    addons.push('@storybook/addon-vitest')
  }

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
 * Generate preview.ts content based on framework
 */
function generatePreviewTs(framework: FrameworkType): string {
  switch (framework) {
    case 'chakra':
      return generateChakraPreview()
    case 'shadcn':
      return generateShadcnPreview()
    case 'tamagui':
      return generateTamaguiPreview()
    case 'gluestack':
      return generateGluestackPreview()
    default:
      return generateVanillaPreview()
  }
}

function generateChakraPreview(): string {
  return `import type { Preview } from '@storybook/react';
import { ChakraProvider, extendTheme } from '@chakra-ui/react';
import React from 'react';

// Import your theme if you have one
// import { theme } from '../src/theme';

const theme = extendTheme({
  // Your theme customizations here
});

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
      <ChakraProvider theme={theme}>
        <Story />
      </ChakraProvider>
    ),
  ],
};

export default preview;
`
}

function generateShadcnPreview(): string {
  return `import type { Preview } from '@storybook/react';
import '../src/index.css'; // or your global CSS with Tailwind
import React from 'react';

// If you have a ThemeProvider, import and use it here
// import { ThemeProvider } from '../src/components/theme-provider';

const preview: Preview = {
  parameters: {
    controls: {
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

function generateTamaguiPreview(): string {
  return `import type { Preview } from '@storybook/react';
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
      // IMPORTANT: Replace {} with your actual Tamagui config import
      // import config from '../tamagui.config'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <TamaguiProvider config={{} as any} defaultTheme="light">
        <Story />
      </TamaguiProvider>
    ),
  ],
};

export default preview;
`
}

/**
 * Generate vite.config.ts with React Native Web aliasing
 */
function generateViteConfig(): string {
  return `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Alias React Native to React Native Web for Storybook
      'react-native': 'react-native-web',
      '@': resolve(__dirname, './src'),
    },
    extensions: [
      '.web.tsx',
      '.web.ts',
      '.web.jsx',
      '.web.js',
      '.tsx',
      '.ts',
      '.jsx',
      '.js',
    ],
  },
  optimizeDeps: {
    include: ['react-native-web'],
  },
})
`
}

function generateGluestackPreview(): string {
  return `import type { Preview } from '@storybook/react';
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

function generateVanillaPreview(): string {
  return `import type { Preview } from '@storybook/react';
import React from 'react';

// Import your global styles if any
// import '../src/index.css';

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
    'test-storybook': 'test-storybook',
    prestorybook: 'npx forgekit-storybook-mcp --cleanup-only'
  }
}

// ===========================================
// Dependencies
// ===========================================

export interface Dependencies {
  dev: string[]
  prod: string[]
  /** Notices to display to the user (e.g. upgrade prompts) */
  notices: string[]
}

function getDependencies(config: SetupConfig): Dependencies {
  const { framework, projectType, rootDir } = config
  const notices: string[] = []

  // Resolve which Storybook version to pin the install suggestions to.
  // - Nx: match whatever version @nx/storybook was built for
  // - Standard with SB ≥10 installed: use that exact version
  // - Standard with SB <10: keep their version but emit an upgrade prompt
  // - Nothing installed yet: default to 10.2.0
  let sbVersion: string

  if (projectType === 'nx') {
    const nxVersion = detectNxStorybookVersion(rootDir)
    sbVersion = nxVersion ?? DEFAULT_STORYBOOK_VERSION
  } else {
    const installed = detectInstalledStorybookVersion(rootDir)
    if (installed) {
      const major = parseInt(installed.split('.')[0], 10)
      if (major >= 10) {
        sbVersion = installed
      } else {
        notices.push(
          `⚠️  Storybook ${installed} detected — v10+ is required for full compatibility.\n` +
            `   Run: npx storybook@latest upgrade`
        )
        sbVersion = installed
      }
    } else {
      // Fresh install — default to latest stable 10
      sbVersion = DEFAULT_STORYBOOK_VERSION
    }
  }

  const sbRange = `^${sbVersion}`

  const dev: string[] = [
    `storybook@${sbRange}`,
    `@storybook/react@${sbRange}`,
    `@storybook/addon-docs@${sbRange}`,
    `@storybook/addon-a11y@${sbRange}`
  ]

  // Add framework-specific bundler
  if (framework === 'tamagui') {
    dev.push(`@storybook/react-webpack5@${sbRange}`)
    dev.push('@storybook/test-runner@^0.24.0')
  } else {
    dev.push(`@storybook/react-vite@${sbRange}`)
    // Vitest addon is recommended for Vite-based projects in SB 10+
    dev.push(`@storybook/addon-vitest@${sbRange}`)
  }

  // Add Nx-specific if needed
  if (projectType === 'nx') {
    dev.push('@nx/storybook@latest')
  }

  const prod: string[] = []

  // Framework-specific dependencies (usually already installed)
  switch (framework) {
    case 'chakra':
      // ChakraProvider is part of @chakra-ui/react
      break
    case 'shadcn':
      // Usually already have tailwindcss
      break
    case 'tamagui':
      // Usually already have tamagui
      break
    case 'gluestack':
      // Usually already have @gluestack-ui/themed and @gluestack-ui/config
      break
  }

  return { dev, prod, notices }
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
  const nxLibName =
    libName || (projectType === 'nx' ? findNxLibName(rootDir) : undefined)

  const config: SetupConfig = {
    projectType,
    framework,
    nxLibName,
    rootDir
  }

  const result: SetupResult = {
    projectType,
    framework,
    nxLibName,
    filesCreated: [],
    scriptsAdded: [],
    dependencies: getDependencies(config)
  }

  console.log('\n🔧 Storybook Setup\n')
  console.log(
    `  Project type: ${projectType === 'nx' ? 'Nx Monorepo' : 'Standard'}`
  )
  console.log(`  UI Framework: ${framework}`)
  if (nxLibName) {
    console.log(`  Nx Library: ${nxLibName}`)
  }

  // Print any version-related notices (e.g. upgrade prompts)
  for (const notice of result.dependencies.notices) {
    console.log(`\n  ${notice}`)
  }
  console.log('')

  // Determine where .storybook config should live
  let storybookDir: string

  if (projectType === 'nx') {
    const targetLib = nxLibName || '<project-name>'

    if (!nxLibName) {
      console.log(
        '  ⚠️  Could not auto-detect an Nx library. Use --lib=<name> to specify one.'
      )
      console.log(
        `     npx forgekit-storybook-mcp --setup --lib=<project-name>`
      )
      console.log('')
      return result
    }

    // Resolve actual lib path
    const libBasePath = resolveNxLibPath(rootDir, nxLibName)
    if (!libBasePath) {
      console.log(
        `  ⚠️  Could not find library "${nxLibName}" in libs/ or packages/`
      )
      console.log('')
      return result
    }

    storybookDir = path.join(rootDir, libBasePath, '.storybook')
    console.log(`  📍 Nx library: ${targetLib} (${libBasePath})`)

    // Check if @nx/storybook is installed and suggest it
    const nxStorybookInstalled = fs.existsSync(
      path.join(rootDir, 'node_modules', '@nx', 'storybook')
    )
    if (nxStorybookInstalled) {
      console.log(
        `  💡 Tip: You can also use \`npx nx g @nx/storybook:configuration ${targetLib}\` for Nx-native setup`
      )
    }
    console.log('')
  } else {
    storybookDir = path.join(rootDir, '.storybook')
  }

  // Create .storybook directory
  if (!fs.existsSync(storybookDir)) {
    if (!dryRun) {
      fs.mkdirSync(storybookDir, { recursive: true })
    }
    const relDir = path.relative(rootDir, storybookDir)
    console.log(`  📁 Created ${relDir}/`)
  }

  // Generate main.ts
  const mainPath = path.join(storybookDir, 'main.ts')
  const mainExists = fs.existsSync(mainPath)

  if (!mainExists || force) {
    const mainContent = generateMainTs(config)
    if (!dryRun) {
      fs.writeFileSync(mainPath, mainContent)
    }
    result.filesCreated.push('.storybook/main.ts')
    console.log(
      `  📄 ${mainExists ? 'Overwrote' : 'Created'} .storybook/main.ts`
    )
  } else {
    console.log(
      `  ⏭️  Skipped .storybook/main.ts (already exists, use --force to overwrite)`
    )
  }

  // Generate preview.tsx (uses JSX in decorators)
  const previewTsxPath = path.join(storybookDir, 'preview.tsx')
  const previewTsxExists = fs.existsSync(previewTsxPath)
  const legacyPreviewPath = path.join(storybookDir, 'preview.ts')
  const legacyPreviewExists = fs.existsSync(legacyPreviewPath)

  if (legacyPreviewExists && !previewTsxExists) {
    // preview.ts exists — check content
    const content = fs.readFileSync(legacyPreviewPath, 'utf-8').trim()
    const hasJsx = /<\w+[\s/>]/.test(content) || content.includes('JSX')
    const isEmpty = content.length === 0
    const isMinimal = content.length < THRESHOLDS.EMPTY_FILE_SIZE // Nearly empty / boilerplate only

    if (isEmpty || isMinimal) {
      // Empty or minimal — replace with generated preview.tsx
      const previewContent = generatePreviewTs(framework)
      if (!dryRun) {
        fs.unlinkSync(legacyPreviewPath)
        fs.writeFileSync(previewTsxPath, previewContent)
      }
      result.filesCreated.push('.storybook/preview.tsx')
      console.log(`  📄 Replaced empty .storybook/preview.ts with preview.tsx`)
    } else if (hasJsx) {
      // Has JSX content — just rename to .tsx
      if (!dryRun) {
        fs.renameSync(legacyPreviewPath, previewTsxPath)
      }
      console.log(
        `  📄 Renamed .storybook/preview.ts → preview.tsx (contains JSX)`
      )
    } else if (force) {
      // --force: overwrite with generated content as .tsx
      const previewContent = generatePreviewTs(framework)
      if (!dryRun) {
        fs.unlinkSync(legacyPreviewPath)
        fs.writeFileSync(previewTsxPath, previewContent)
      }
      result.filesCreated.push('.storybook/preview.tsx')
      console.log(`  📄 Replaced .storybook/preview.ts with preview.tsx`)
    } else {
      console.log(
        `  ⚠️  .storybook/preview.ts should be preview.tsx (decorators use JSX). Use --force to replace.`
      )
    }
  } else if (!previewTsxExists && !legacyPreviewExists) {
    // No preview at all — create fresh
    const previewContent = generatePreviewTs(framework)
    if (!dryRun) {
      fs.writeFileSync(previewTsxPath, previewContent)
    }
    result.filesCreated.push('.storybook/preview.tsx')
    console.log(`  📄 Created .storybook/preview.tsx`)
  } else if (force && previewTsxExists) {
    // --force with existing .tsx — overwrite
    const previewContent = generatePreviewTs(framework)
    if (!dryRun) {
      fs.writeFileSync(previewTsxPath, previewContent)
      if (legacyPreviewExists) {
        fs.unlinkSync(legacyPreviewPath)
      }
    }
    result.filesCreated.push('.storybook/preview.tsx')
    console.log(`  📄 Overwrote .storybook/preview.tsx`)
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
        fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`)
      }
      result.scriptsAdded = scriptsToAdd
      console.log(
        `  📦 Added scripts to package.json: ${scriptsToAdd.join(', ')}`
      )
    } else {
      console.log(`  ⏭️  Scripts already exist in package.json`)
    }
  }

  // Generate vite.config.ts for React Native projects
  const packagePath2 = path.join(rootDir, 'package.json')
  let isReactNative = false
  if (fs.existsSync(packagePath2)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packagePath2, 'utf-8'))
      const deps = { ...pkg.dependencies, ...pkg.devDependencies }
      isReactNative = !!(deps['react-native'] || deps['expo'])
    } catch {
      // Ignore errors
    }
  }

  if (isReactNative) {
    const viteConfigPath = path.join(rootDir, 'vite.config.ts')
    const viteConfigExists = fs.existsSync(viteConfigPath)

    if (!viteConfigExists || force) {
      const viteConfigContent = generateViteConfig()
      if (!dryRun) {
        fs.writeFileSync(viteConfigPath, viteConfigContent)
      }
      result.filesCreated.push('vite.config.ts')
      console.log(
        `  📄 ${viteConfigExists ? 'Overwrote' : 'Created'} vite.config.ts (React Native Web aliasing)`
      )

      // Add react-native-web to dependencies if not present
      const pkg = JSON.parse(fs.readFileSync(packagePath2, 'utf-8'))
      const deps = { ...pkg.dependencies, ...pkg.devDependencies }
      if (!deps['react-native-web']) {
        result.dependencies.dev.push('react-native-web@^0.21.2')
        console.log(
          `  💡 Note: Add react-native-web to your dependencies for Storybook`
        )
      }
    } else {
      console.log(
        `  ⏭️  Skipped vite.config.ts (already exists, use --force to overwrite)`
      )
    }
  }

  // Print dependencies
  console.log('\n📦 Install these dependencies:\n')

  const installCmd = `npm install -D ${result.dependencies.dev.join(' ')}`
  console.log(`  ${installCmd}`)

  if (result.dependencies.prod.length > 0) {
    console.log(`  npm install ${result.dependencies.prod.join(' ')}`)
  }

  console.log('')

  // Print next steps
  console.log('📋 Next steps:\n')
  console.log('  1. Run the install command above')
  console.log('  2. Review .storybook/preview.tsx and customize as needed')
  if (framework !== 'vanilla') {
    console.log(
      `  3. Ensure your ${framework} theme/config is properly imported in preview.tsx`
    )
  }
  console.log(
    `  ${framework !== 'vanilla' ? '4' : '3'}. Run: npm run storybook`
  )
  console.log('')

  if (dryRun) {
    console.log('ℹ️  Dry run mode - no files were written\n')
  }

  return result
}
