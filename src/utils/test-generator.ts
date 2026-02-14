/**
 * Test Generator
 * Generates Playwright/Vitest test files for components
 */

import fs from 'node:fs'
import path from 'node:path'
import type {
  StorybookMCPConfig,
  ComponentAnalysis,
} from '../types.js'
import { toKebabCase } from './scanner.js'

export interface GeneratedTest {
  content: string
  filePath: string
}

/**
 * Check if a package is installed in the project
 */
function isPackageInstalled(rootDir: string, packageName: string): boolean {
  try {
    const pkgPath = path.join(rootDir, 'package.json')
    if (!fs.existsSync(pkgPath)) return false
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }
    return !!deps[packageName]
  } catch {
    return false
  }
}

/**
 * Generate a test file for a component
 */
export async function generateTest(
  config: StorybookMCPConfig,
  analysis: ComponentAnalysis
): Promise<GeneratedTest> {
  const kebabName = toKebabCase(analysis.name)
  const testPath = buildTestPath(analysis.filePath)
  
  let content = ''

  // Only use Playwright if it's actually installed in the project
  // Otherwise default to vitest + @testing-library (works for all components)
  const hasPlaywright = isPackageInstalled(config.rootDir, '@playwright/test')
  
  if (hasPlaywright && (analysis.dependencies.usesRouter || analysis.props.some(p => p.name.startsWith('on')))) {
    content = generatePlaywrightTest(analysis, kebabName)
  } else {
    content = generateVitestTest(analysis, kebabName)
  }

  return {
    content,
    filePath: testPath,
  }
}

/**
 * Generate Playwright test
 */
function generatePlaywrightTest(analysis: ComponentAnalysis, kebabName: string): string {
  const { name, props } = analysis
  
  let content = `import { test, expect } from '@playwright/test'

test.describe('${name}', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to Storybook story
    await page.goto('/iframe.html?id=components-${kebabName}--default')
  })

  test('renders correctly', async ({ page }) => {
    const component = page.locator('[data-testid="${kebabName}"]').first()
    await expect(component).toBeVisible()
  })
`

  // Add variant tests if component has variants
  const variantProp = props.find(p => p.name === 'variant' && p.controlOptions)
  if (variantProp?.controlOptions) {
    content += `
  test('displays all variants', async ({ page }) => {
    await page.goto('/iframe.html?id=components-${kebabName}--variants')
    
${variantProp.controlOptions.map(v => `    await expect(page.getByText('${v}')).toBeVisible()`).join('\n')}
  })
`
  }

  // Add size tests if component has sizes
  const sizeProp = props.find(p => p.name === 'size' && p.controlOptions)
  if (sizeProp?.controlOptions) {
    content += `
  test('displays all sizes', async ({ page }) => {
    await page.goto('/iframe.html?id=components-${kebabName}--sizes')
    
${sizeProp.controlOptions.map(s => `    await expect(page.getByText('${s}')).toBeVisible()`).join('\n')}
  })
`
  }

  // Add interaction tests for event handlers
  const eventProps = props.filter(p => p.name.startsWith('on'))
  if (eventProps.length > 0) {
    content += `
  test('handles interactions', async ({ page }) => {
    const component = page.locator('[data-testid="${kebabName}"]').first()
    
    // Click interaction
    await component.click()
    
    // Add assertions for expected behavior
  })
`
  }

  // Add keyboard accessibility test
  content += `
  test('is keyboard accessible', async ({ page }) => {
    // Tab to component
    await page.keyboard.press('Tab')
    
    const component = page.locator('[data-testid="${kebabName}"]').first()
    await expect(component).toBeFocused()
    
    // Test Enter key
    await page.keyboard.press('Enter')
    
    // Test Space key
    await page.keyboard.press(' ')
  })

  test('meets accessibility standards', async ({ page }) => {
    // Install @axe-core/playwright for this test
    // const { injectAxe, checkA11y } = require('@axe-core/playwright')
    // await injectAxe(page)
    // await checkA11y(page)
  })
`

  // Add responsive tests
  content += `
  test('responsive - mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    
    const component = page.locator('[data-testid="${kebabName}"]').first()
    await expect(component).toBeVisible()
  })

  test('responsive - desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    
    const component = page.locator('[data-testid="${kebabName}"]').first()
    await expect(component).toBeVisible()
  })
})
`

  return content
}

/**
 * Generate Vitest test
 */
function generateVitestTest(analysis: ComponentAnalysis, kebabName: string): string {
  const { name, filePath, props } = analysis
  const importPath = `./${path.basename(filePath, path.extname(filePath))}`
  const hasChildren = props.some(p => p.name === 'children')
  const eventProps = props.filter(p => p.name.startsWith('on'))
  const hasEvents = eventProps.length > 0
  
  // Build required props for rendering (non-optional, non-event, non-children)
  const requiredProps = props.filter(p => p.required && p.name !== 'children' && !p.name.startsWith('on'))
  
  // Build a minimal valid render call
  const buildRenderProps = (extraProps: string = ''): string => {
    const propStrs: string[] = []
    for (const p of requiredProps) {
      if (p.controlOptions && p.controlOptions.length > 0) {
        propStrs.push(`${p.name}="${p.controlOptions[0]}"`)
      } else if (p.type?.includes('string')) {
        propStrs.push(`${p.name}="Test ${p.name}"`)
      } else if (p.type?.includes('boolean')) {
        propStrs.push(`${p.name}`)
      } else if (p.type?.includes('number')) {
        propStrs.push(`${p.name}={0}`)
      } else {
        propStrs.push(`${p.name}="test"`)
      }
    }
    if (extraProps) propStrs.push(extraProps)
    const propsStr = propStrs.length > 0 ? ' ' + propStrs.join(' ') : ''
    
    if (hasChildren) {
      return `<${name}${propsStr}>Test Content</${name}>`
    } else {
      return `<${name}${propsStr} />`
    }
  }

  // Only import vi if we need vi.fn()
  const vitestImports = hasEvents ? `import { describe, it, expect, vi } from 'vitest'` : `import { describe, it, expect } from 'vitest'`
  // Only import userEvent if we have events
  const userEventImport = hasEvents ? `import userEvent from '@testing-library/user-event'` : ''
  
  let content = `${vitestImports}
import { render, screen } from '@testing-library/react'
${userEventImport}
import { ${name} } from '${importPath}'

describe('${name}', () => {
  it('renders correctly', () => {
    render(${buildRenderProps()})
    
    ${hasChildren ? `expect(screen.getByText('Test Content')).toBeInTheDocument()` : `expect(document.querySelector('[class]')).toBeInTheDocument()`}
  })
`

  // Add variant tests
  const variantProp = props.find(p => p.name === 'variant' && p.controlOptions)
  if (variantProp?.controlOptions) {
    for (const variant of variantProp.controlOptions) {
      content += `
  it('renders ${variant} variant', () => {
    render(${hasChildren ? `<${name} variant="${variant}">Content</${name}>` : `<${name} variant="${variant}" />`})
    
    ${hasChildren ? `expect(screen.getByText('Content')).toBeInTheDocument()` : `// Variant "${variant}" renders without error`}
  })
`
    }
  }

  // Add size tests
  const sizeProp = props.find(p => p.name === 'size' && p.controlOptions)
  if (sizeProp?.controlOptions) {
    for (const size of sizeProp.controlOptions) {
      content += `
  it('renders ${size} size', () => {
    render(${hasChildren ? `<${name} size="${size}">Content</${name}>` : `<${name} size="${size}" />`})
    
    ${hasChildren ? `expect(screen.getByText('Content')).toBeInTheDocument()` : `// Size "${size}" renders without error`}
  })
`
    }
  }

  // Add event handler tests
  for (const prop of eventProps) {
    const eventName = prop.name.replace(/^on/, '').toLowerCase()
    content += `
  it('calls ${prop.name} when ${eventName}ed', async () => {
    const user = userEvent.setup()
    const handleEvent = vi.fn()
    
    render(${hasChildren ? `<${name} ${prop.name}={handleEvent}>Content</${name}>` : `<${name} ${prop.name}={handleEvent} />`})
    
    ${hasChildren ? `await user.click(screen.getByText('Content'))` : `const el = document.querySelector('[class]')\n    if (el) await user.click(el)`}
    
    expect(handleEvent).toHaveBeenCalled()
  })
`
  }

  // Add disabled state test if component has disabled prop
  if (props.some(p => p.name === 'disabled')) {
    content += `
  it('respects disabled state', () => {
    render(${hasChildren ? `<${name} disabled>Content</${name}>` : `<${name} disabled />`})
    
    ${hasChildren ? `const element = screen.getByText('Content')\n    expect(element).toBeDisabled()` : `// Disabled state renders without error`}
  })
`
  }

  content += `})
`

  return content
}

/**
 * Build test file path from component path
 */
function buildTestPath(componentPath: string): string {
  const dir = path.dirname(componentPath)
  const basename = path.basename(componentPath, path.extname(componentPath))
  return path.join(dir, `${basename}.test.tsx`)
}

/**
 * Write test file to disk
 */
export async function writeTestFile(
  config: StorybookMCPConfig,
  test: GeneratedTest,
  overwrite: boolean = false
): Promise<boolean> {
  const fullPath = path.join(config.rootDir, test.filePath)
  
  if (fs.existsSync(fullPath) && !overwrite) {
    return false
  }
  
  const dir = path.dirname(fullPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  
  fs.writeFileSync(fullPath, test.content, 'utf-8')
  return true
}
