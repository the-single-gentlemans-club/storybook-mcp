/**
 * Test Generator
 * Generates Playwright/Vitest test files for components
 */

import fs from 'node:fs'
import path from 'node:path'
import type {
  StorybookMCPConfig,
  ComponentAnalysis,
} from './types.js'
import { toKebabCase } from './scanner.js'

export interface GeneratedTest {
  content: string
  filePath: string
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

  // Determine test type based on dependencies
  if (analysis.dependencies.usesRouter || analysis.props.some(p => p.name.startsWith('on'))) {
    // Use Playwright for interactive components
    content = generatePlaywrightTest(analysis, kebabName)
  } else {
    // Use Vitest for simpler components
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
  const { name, filePath } = analysis
  const importPath = `./${path.basename(filePath, path.extname(filePath))}`
  
  let content = `import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ${name} } from '${importPath}'

describe('${name}', () => {
  it('renders correctly', () => {
    render(<${name}>Test Content</${name}>)
    
    expect(screen.getByText('Test Content')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<${name} className="custom-class">Content</${name}>)
    
    const element = screen.getByText('Content')
    expect(element).toHaveClass('custom-class')
  })
`

  // Add variant tests
  const variantProp = analysis.props.find(p => p.name === 'variant' && p.controlOptions)
  if (variantProp?.controlOptions) {
    for (const variant of variantProp.controlOptions) {
      content += `
  it('renders ${variant} variant', () => {
    render(<${name} variant="${variant}">Content</${name}>)
    
    const element = screen.getByText('Content')
    expect(element).toHaveAttribute('data-variant', '${variant}')
  })
`
    }
  }

  // Add size tests
  const sizeProp = analysis.props.find(p => p.name === 'size' && p.controlOptions)
  if (sizeProp?.controlOptions) {
    for (const size of sizeProp.controlOptions) {
      content += `
  it('renders ${size} size', () => {
    render(<${name} size="${size}">Content</${name}>)
    
    const element = screen.getByText('Content')
    expect(element).toHaveAttribute('data-size', '${size}')
  })
`
    }
  }

  // Add event handler tests
  const eventProps = analysis.props.filter(p => p.name.startsWith('on'))
  for (const prop of eventProps) {
    const eventName = prop.name.replace(/^on/, '').toLowerCase()
    content += `
  it('calls ${prop.name} when ${eventName}ed', async () => {
    const user = userEvent.setup()
    const handleEvent = vi.fn()
    
    render(<${name} ${prop.name}={handleEvent}>Content</${name}>)
    
    await user.click(screen.getByText('Content'))
    
    expect(handleEvent).toHaveBeenCalled()
  })
`
  }

  // Add disabled state test if component has disabled prop
  if (analysis.props.some(p => p.name === 'disabled')) {
    content += `
  it('respects disabled state', () => {
    render(<${name} disabled>Content</${name}>)
    
    const element = screen.getByText('Content')
    expect(element).toBeDisabled()
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
