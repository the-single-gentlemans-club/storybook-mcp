import { describe, it, expect } from 'vitest'
import { generateTest } from '../test-generator.js'
import type { StorybookMCPConfig, ComponentAnalysis } from '../../types.js'

function makeConfig(): StorybookMCPConfig {
  return {
    rootDir: '/tmp/test-project',
    libraries: [{ name: 'ui', path: 'src/components', storyTitlePrefix: 'Components' }],
    framework: 'vanilla',
    storyFilePattern: '**/*.stories.{ts,tsx}',
    componentPatterns: ['**/src/**/*.tsx'],
    excludePatterns: ['**/node_modules/**'],
  }
}

const baseDeps = {
  usesRouter: false, usesReactQuery: false, usesChakra: false,
  usesShadcn: false, usesTamagui: false, usesGluestack: false,
  usesReactNative: false, usesEmotion: false, usesTailwind: false,
  usesFramerMotion: false, usesMSW: false, usesGlobalState: false,
  otherImports: [] as string[],
}

describe('test-generator', () => {
  it('falls back to vitest for interactive component when Playwright not installed', async () => {
    const analysis: ComponentAnalysis = {
      name: 'Button',
      filePath: 'src/components/Button.tsx',
      library: 'ui',
      hasStory: false,
      exportType: 'named',
      props: [
        { name: 'onClick', type: '() => void', required: false },
        { name: 'children', type: 'string', required: false },
      ],
      dependencies: baseDeps,
      suggestions: [],
      sourcePreview: '',
    }
    // rootDir doesn't have @playwright/test installed, so should fall back to vitest
    const test = await generateTest(makeConfig(), analysis)
    expect(test.content).toContain("from 'vitest'")
    expect(test.content).toContain("from '@testing-library/react'")
    expect(test.content).toContain("describe('Button'")
    expect(test.content).toContain('calls onClick')
    expect(test.filePath).toContain('.test.tsx')
  })

  it('falls back to vitest for router component when Playwright not installed', async () => {
    const analysis: ComponentAnalysis = {
      name: 'NavLink',
      filePath: 'src/components/NavLink.tsx',
      library: 'ui',
      hasStory: false,
      exportType: 'named',
      props: [{ name: 'to', type: 'string', required: true }],
      dependencies: { ...baseDeps, usesRouter: true },
      suggestions: [],
      sourcePreview: '',
    }
    // rootDir doesn't have @playwright/test installed, so should fall back to vitest
    const test = await generateTest(makeConfig(), analysis)
    expect(test.content).toContain("from 'vitest'")
    expect(test.content).not.toContain("from '@playwright/test'")
  })

  it('generates Vitest test for simple component (no events, no router)', async () => {
    const analysis: ComponentAnalysis = {
      name: 'Badge',
      filePath: 'src/components/Badge.tsx',
      library: 'ui',
      hasStory: false,
      exportType: 'named',
      props: [
        { name: 'children', type: 'string', required: true },
        { name: 'variant', type: "'solid' | 'outline'", required: false, controlType: 'select', controlOptions: ['solid', 'outline'] },
      ],
      dependencies: baseDeps,
      suggestions: [],
      sourcePreview: '',
    }
    const test = await generateTest(makeConfig(), analysis)
    expect(test.content).toContain("from 'vitest'")
    expect(test.content).toContain("from '@testing-library/react'")
    expect(test.content).toContain("describe('Badge'")
    expect(test.content).toContain('renders correctly')
    // Should have variant tests
    expect(test.content).toContain('renders solid variant')
    expect(test.content).toContain('renders outline variant')
  })

  it('generates test file path with .test.tsx extension', async () => {
    const analysis: ComponentAnalysis = {
      name: 'Text',
      filePath: 'src/components/Text.tsx',
      library: 'ui',
      hasStory: false,
      exportType: 'named',
      props: [],
      dependencies: baseDeps,
      suggestions: [],
      sourcePreview: '',
    }
    const test = await generateTest(makeConfig(), analysis)
    expect(test.filePath.replace(/\\/g, '/')).toBe('src/components/Text.test.tsx')
  })
})
