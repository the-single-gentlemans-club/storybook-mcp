/**
 * Storybook Setup Utility
 * Creates .storybook config, updates package.json scripts, and prints dependencies
 */

import fs from 'node:fs'
import path from 'node:path'

// ===========================================
// Types
// ===========================================

export type FrameworkType = 'chakra' | 'shadcn' | 'tamagui' | 'gluestack' | 'vanilla'
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
      ...pkg.devDependencies,
    }

    // Check in order of specificity
    if (deps['@chakra-ui/react']) {
      return 'chakra'
    }
    if (deps['@radix-ui/react-slot'] || deps['class-variance-authority'] || deps['tailwindcss']) {
      // Likely shadcn/ui
      return 'shadcn'
    }
    if (deps['tamagui']) {
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
    { dir: path.join(packagesDir, 'ui'), name: 'ui' },
  ]

  for (const { dir, name } of nestedUiPaths) {
    if (fs.existsSync(dir)) {
      return name
    }
  }

  // Prioritize libraries with UI-related names
  const uiRelatedNames = ['ui', 'components', 'design-system', 'shared-ui', 'core-ui']
  const allLibs: Array<{ name: string; hasStorybook: boolean; isUiRelated: boolean }> = []

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

          const isUiRelated = uiRelatedNames.includes(entry.name.toLowerCase()) ||
            entry.name.toLowerCase().includes('ui') ||
            entry.name.toLowerCase().includes('component')

          allLibs.push({
            name: entry.name,
            hasStorybook,
            isUiRelated,
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
  const libsDir = path.join(rootDir, 'libs')
  const packagesDir = path.join(rootDir, 'packages')

  // Nested structure mappings (must match findNxLibName's nestedUiPaths)
  const nestedPaths: Array<{ dir: string; name: string }> = [
    { dir: path.join(libsDir, 'shared', 'ui'), name: 'shared-ui' },
    { dir: path.join(libsDir, 'ui'), name: 'ui' },
    { dir: path.join(packagesDir, 'ui'), name: 'ui' },
  ]
  for (const { dir, name } of nestedPaths) {
    if (name === nxLibName && fs.existsSync(dir)) {
      return path.relative(rootDir, dir)
    }
  }

  // Flat structure: libs/x or packages/x
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
 * Generate main.ts content
 */
function generateMainTs(config: SetupConfig): string {
  const { projectType, framework } = config

  // In Storybook 10, essentials/interactions/a11y are bundled into the main
  // `storybook` package — no separate addon packages needed in the config.
  const addons: string[] = []

  // Framework-specific stories glob
  let storiesGlob: string[]
  if (projectType === 'nx') {
    storiesGlob = [
      '../libs/**/src/**/*.stories.@(js|jsx|ts|tsx)',
      '../libs/**/src/**/*.mdx',
    ]
  } else {
    storiesGlob = [
      '../src/**/*.stories.@(js|jsx|ts|tsx)',
      '../src/**/*.mdx',
    ]
  }

  // Determine the framework package
  let frameworkPackage = '@storybook/react-vite'
  if (framework === 'tamagui') {
    // Tamagui works best with webpack for now
    frameworkPackage = '@storybook/react-webpack5'
  }

  return `import type { StorybookConfig } from '${frameworkPackage}';

const config: StorybookConfig = {
  stories: ${JSON.stringify(storiesGlob, null, 4).replace(/\n/g, '\n  ')},
  addons: ${JSON.stringify(addons, null, 4).replace(/\n/g, '\n  ')},
  framework: {
    name: '${frameworkPackage}',
    options: {},
  },
  docs: {
    autodocs: 'tag',
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
      'test-storybook': 'test-storybook',
    }
  }

  return {
    storybook: 'storybook dev -p 6006',
    'build-storybook': 'storybook build',
    'test-storybook': 'test-storybook',
  }
}

// ===========================================
// Dependencies
// ===========================================

interface Dependencies {
  dev: string[]
  prod: string[]
}

function getDependencies(config: SetupConfig): Dependencies {
  const { framework } = config

  // Storybook 10.x — addons (essentials, interactions, a11y, blocks) are now
  // bundled into the main `storybook` package. Only install what still exists as
  // separate packages at v10.
  const dev: string[] = [
    'storybook@^10.0.0',
    '@storybook/react@^10.0.0',
    '@storybook/test-runner@^0.24.0',
  ]

  // Add framework-specific bundler
  if (framework === 'tamagui') {
    dev.push('@storybook/react-webpack5@^10.0.0')
  } else {
    dev.push('@storybook/react-vite@^10.0.0')
  }

  // Add Nx-specific if needed
  if (config.projectType === 'nx') {
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

  return { dev, prod }
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
  const nxLibName = libName || (projectType === 'nx' ? findNxLibName(rootDir) : undefined)

  const config: SetupConfig = {
    projectType,
    framework,
    nxLibName,
    rootDir,
  }

  const result: SetupResult = {
    projectType,
    framework,
    nxLibName,
    filesCreated: [],
    scriptsAdded: [],
    dependencies: getDependencies(config),
  }

  console.log('\n🔧 Storybook Setup\n')
  console.log(`  Project type: ${projectType === 'nx' ? 'Nx Monorepo' : 'Standard'}`)
  console.log(`  UI Framework: ${framework}`)
  if (nxLibName) {
    console.log(`  Nx Library: ${nxLibName}`)
  }
  console.log('')

  // Nx monorepos: guide user to use Nx's Storybook generator instead of manual scaffolding
  if (projectType === 'nx') {
    const targetLib = nxLibName || '<project-name>'
    
    // Check if @nx/storybook is installed
    const nxStorybookInstalled = fs.existsSync(path.join(rootDir, 'node_modules', '@nx', 'storybook'))
    
    // Resolve actual lib path (libs/ or packages/) — findNxLibName searches both
    const libBasePath = nxLibName ? resolveNxLibPath(rootDir, nxLibName) : null
    const libStorybookDir = libBasePath
      ? path.join(rootDir, libBasePath, '.storybook')
      : null
    const nxStorybookConfigured = libStorybookDir && fs.existsSync(libStorybookDir)

    if (nxStorybookConfigured) {
      console.log(`  ✅ Storybook already configured for ${targetLib} via Nx`)
      console.log(`     Config: ${libBasePath}/.storybook/`)
      console.log('')
    } else {
      console.log('  📋 Nx monorepo detected — use the Nx Storybook generator for proper setup:\n')
      
      if (!nxStorybookInstalled) {
        console.log(`  1. Install @nx/storybook:`)
        console.log(`     npm install -D @nx/storybook@latest`)
        console.log('')
        console.log(`  2. Generate Storybook configuration:`)
      } else {
        console.log(`  1. Generate Storybook configuration:`)
      }
      console.log(`     npx nx g @nx/storybook:configuration ${targetLib}`)
      console.log('')
      const createdPath = libBasePath || `libs/${targetLib}`
      console.log('  This creates:')
      console.log(`     • ${createdPath}/.storybook/main.ts  (project-level config)`)
      console.log(`     • ${createdPath}/.storybook/preview.ts`)
      console.log(`     • storybook + build-storybook targets in project.json`)
      console.log('')
      
      const nextStep = nxStorybookInstalled ? 2 : 3
      console.log(`  ${nextStep}. Install remaining Storybook packages:`)
      console.log(`     npm install -D ${result.dependencies.dev.join(' ')}`)
      console.log('')
      console.log(`  ${nextStep + 1}. Run Storybook:`)
      console.log(`     npx nx storybook ${targetLib}`)
      console.log('')
    }

    if (dryRun) {
      console.log('ℹ️  Dry run mode\n')
    }

    return result
  }

  // Standard (non-Nx) project setup
  // Create .storybook directory
  const storybookDir = path.join(rootDir, '.storybook')
  
  if (!fs.existsSync(storybookDir)) {
    if (!dryRun) {
      fs.mkdirSync(storybookDir, { recursive: true })
    }
    console.log(`  📁 Created .storybook/`)
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
    console.log(`  📄 ${mainExists ? 'Overwrote' : 'Created'} .storybook/main.ts`)
  } else {
    console.log(`  ⏭️  Skipped .storybook/main.ts (already exists, use --force to overwrite)`)
  }

  // Generate preview.ts
  const previewPath = path.join(storybookDir, 'preview.ts')
  const previewExists = fs.existsSync(previewPath)
  
  if (!previewExists || force) {
    const previewContent = generatePreviewTs(framework)
    if (!dryRun) {
      fs.writeFileSync(previewPath, previewContent)
    }
    result.filesCreated.push('.storybook/preview.ts')
    console.log(`  📄 ${previewExists ? 'Overwrote' : 'Created'} .storybook/preview.ts`)
  } else {
    console.log(`  ⏭️  Skipped .storybook/preview.ts (already exists, use --force to overwrite)`)
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
      console.log(`  📦 Added scripts to package.json: ${scriptsToAdd.join(', ')}`)
    } else {
      console.log(`  ⏭️  Scripts already exist in package.json`)
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
  console.log('  2. Review .storybook/preview.ts and customize as needed')
  if (framework !== 'vanilla') {
    console.log(`  3. Ensure your ${framework} theme/config is properly imported in preview.ts`)
  }
  console.log(`  ${framework !== 'vanilla' ? '4' : '3'}. Run: npm run storybook`)
  console.log('')

  if (dryRun) {
    console.log('ℹ️  Dry run mode - no files were written\n')
  }

  return result
}
