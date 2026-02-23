/**
 * Preflight Health Check for Storybook 10 Compatibility
 *
 * Checks for missing packages, outdated config patterns, and version mismatches
 * before the MCP server starts.
 */

import fs from 'node:fs'
import path from 'node:path'

export interface PreflightResult {
  passed: boolean
  checks: PreflightCheck[]
  installCommands: string[]
  summary: string
}

export interface PreflightCheck {
  name: string
  status: 'pass' | 'warn' | 'fail'
  message: string
  fix?: string
}

/**
 * Run all preflight checks against the given project root.
 */
export async function runPreflight(rootDir: string): Promise<PreflightResult> {
  const checks: PreflightCheck[] = []
  const installCommands: string[] = []

  // 1. Check required packages
  checkRequiredPackages(rootDir, checks, installCommands)

  // 2. Check storybook version
  checkStorybookVersion(rootDir, checks)

  // 3. Check .storybook/main.ts for outdated patterns
  checkMainConfig(rootDir, checks)

  // 4. Check .storybook/preview.ts for outdated patterns
  checkPreviewConfig(rootDir, checks)

  const fails = checks.filter(c => c.status === 'fail')
  const warns = checks.filter(c => c.status === 'warn')
  const passed = fails.length === 0 && warns.length === 0

  const parts: string[] = []
  if (fails.length > 0) parts.push(`${fails.length} error(s)`)
  if (warns.length > 0) parts.push(`${warns.length} warning(s)`)
  const summary = passed
    ? `All ${checks.length} preflight checks passed`
    : `Preflight: ${parts.join(', ')} out of ${checks.length} checks`

  return { passed, checks, installCommands, summary }
}

// ---------------------------------------------------------------------------
// Individual check helpers
// ---------------------------------------------------------------------------

function packageExists(rootDir: string, pkg: string): boolean {
  try {
    const pkgJson = path.join(
      rootDir,
      'node_modules',
      ...pkg.split('/'),
      'package.json'
    )
    return fs.existsSync(pkgJson)
  } catch {
    return false
  }
}

function readPackageVersion(rootDir: string, pkg: string): string | null {
  try {
    const pkgJson = path.join(
      rootDir,
      'node_modules',
      ...pkg.split('/'),
      'package.json'
    )
    const data = JSON.parse(fs.readFileSync(pkgJson, 'utf-8'))
    return data.version ?? null
  } catch {
    return null
  }
}

function readFileIfExists(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }
}

function checkRequiredPackages(
  rootDir: string,
  checks: PreflightCheck[],
  installCommands: string[]
) {
  const required = [
    'storybook',
    '@storybook/react',
    '@storybook/addon-docs',
    'react',
    'react-dom'
  ]
  const missing: string[] = []

  for (const pkg of required) {
    const exists = packageExists(rootDir, pkg)
    checks.push({
      name: `package:${pkg}`,
      status: exists ? 'pass' : 'fail',
      message: exists ? `${pkg} is installed` : `${pkg} is not installed`,
      fix: exists ? undefined : `npm install -D ${pkg}`
    })
    if (!exists) missing.push(pkg)
  }

  // Check for framework package (vite or webpack)
  const hasVite = packageExists(rootDir, '@storybook/react-vite')
  const hasWebpack = packageExists(rootDir, '@storybook/react-webpack5')
  if (hasVite || hasWebpack) {
    checks.push({
      name: 'package:framework',
      status: 'pass',
      message: `Framework package installed: ${hasVite ? '@storybook/react-vite' : '@storybook/react-webpack5'}`
    })
  } else {
    checks.push({
      name: 'package:framework',
      status: 'fail',
      message:
        'No Storybook framework package found (@storybook/react-vite or @storybook/react-webpack5)',
      fix: 'npm install -D @storybook/react-vite'
    })
    missing.push('@storybook/react-vite')
  }

  if (missing.length > 0) {
    installCommands.push(`npm install -D ${missing.join(' ')}`)
  }
}

function checkStorybookVersion(rootDir: string, checks: PreflightCheck[]) {
  const sbVersion = readPackageVersion(rootDir, 'storybook')
  if (!sbVersion) return // already caught by package check

  const major = parseInt(sbVersion.split('.')[0], 10)
  if (major < 10) {
    checks.push({
      name: 'version:storybook',
      status: 'fail',
      message: `Storybook ${sbVersion} detected — v10+ is required`,
      fix: 'npx storybook@latest upgrade'
    })
  } else {
    checks.push({
      name: 'version:storybook',
      status: 'pass',
      message: `Storybook ${sbVersion} installed`
    })
  }

  // Check version match between storybook and @storybook/react
  const reactVersion = readPackageVersion(rootDir, '@storybook/react')
  if (reactVersion && sbVersion) {
    const sbMajorMinor = sbVersion.split('.').slice(0, 2).join('.')
    const reactMajorMinor = reactVersion.split('.').slice(0, 2).join('.')
    if (sbMajorMinor !== reactMajorMinor) {
      checks.push({
        name: 'version:mismatch',
        status: 'warn',
        message: `Version mismatch: storybook@${sbVersion} vs @storybook/react@${reactVersion}`,
        fix: 'Ensure storybook and @storybook/react are the same version'
      })
    } else {
      checks.push({
        name: 'version:mismatch',
        status: 'pass',
        message: 'storybook and @storybook/react versions match'
      })
    }
  }
}

function checkMainConfig(rootDir: string, checks: PreflightCheck[]) {
  const mainTs = readFileIfExists(path.join(rootDir, '.storybook', 'main.ts'))
  const mainJs = readFileIfExists(path.join(rootDir, '.storybook', 'main.js'))
  const content = mainTs ?? mainJs

  if (!content) {
    checks.push({
      name: 'config:main',
      status: 'warn',
      message: 'No .storybook/main.ts or main.js found',
      fix: 'Run npx forgekit-storybook-mcp --setup to create config'
    })
    return
  }

  // Check for required addons in SB10
  const requiredAddons = ['@storybook/addon-docs']
  for (const addon of requiredAddons) {
    if (!content.includes(addon)) {
      checks.push({
        name: `config:main:addon:${addon}`,
        status: 'warn',
        message: `${addon} should be in addons array for SB10`,
        fix: `Add '${addon}' to addons array in .storybook/main`
      })
    }
  }

  // Check for deprecated/bundled addons that should be removed
  const deprecatedAddons = [
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-links'
  ]
  for (const addon of deprecatedAddons) {
    if (content.includes(addon)) {
      checks.push({
        name: `config:main:addon:${addon}`,
        status: 'warn',
        message: `${addon} is bundled into storybook in v10 — can be removed from addons list`,
        fix: `Remove '${addon}' from addons array in .storybook/main`
      })
    }
  }

  // StorybookConfig can be imported from the framework package — that's fine in SB10

  // Check for framework.name
  if (!content.includes('framework')) {
    checks.push({
      name: 'config:main:framework',
      status: 'warn',
      message: 'No framework configuration found in .storybook/main',
      fix: "Add framework: { name: '@storybook/react-vite' } to main config"
    })
  }
}

function checkPreviewConfig(rootDir: string, checks: PreflightCheck[]) {
  const previewTs = readFileIfExists(
    path.join(rootDir, '.storybook', 'preview.ts')
  )
  const previewTsx = readFileIfExists(
    path.join(rootDir, '.storybook', 'preview.tsx')
  )
  const previewJs = readFileIfExists(
    path.join(rootDir, '.storybook', 'preview.js')
  )
  const content = previewTs ?? previewTsx ?? previewJs

  if (!content) return // preview is optional

  // Check for deprecated argTypesRegex
  if (content.includes('argTypesRegex')) {
    checks.push({
      name: 'config:preview:argTypesRegex',
      status: 'warn',
      message:
        'argTypesRegex is deprecated in SB10 — actions are now auto-detected',
      fix: 'Remove the argTypesRegex line from preview config'
    })
  }

  // Check for old @storybook/testing-library import
  if (content.includes('@storybook/testing-library')) {
    checks.push({
      name: 'config:preview:testing-library',
      status: 'warn',
      message:
        "@storybook/testing-library is deprecated — use 'storybook/test' in SB10",
      fix: "Replace imports from '@storybook/testing-library' with 'storybook/test'"
    })
  }

  // Check for old @storybook/jest import
  if (content.includes('@storybook/jest')) {
    checks.push({
      name: 'config:preview:jest',
      status: 'warn',
      message: "@storybook/jest is deprecated — use 'storybook/test' in SB10",
      fix: "Replace imports from '@storybook/jest' with 'storybook/test'"
    })
  }
}
