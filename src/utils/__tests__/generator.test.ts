import { describe, it, expect } from 'vitest'
import { generateStory } from '../generator.js'
import type { StorybookMCPConfig, ComponentAnalysis } from '../../types.js'

function makeConfig(overrides: Partial<StorybookMCPConfig> = {}): StorybookMCPConfig {
  return {
    rootDir: '/tmp/test-project',
    libraries: [{ name: 'ui', path: 'src/components', storyTitlePrefix: 'Components' }],
    framework: 'vanilla',
    storyFilePattern: '**/*.stories.{ts,tsx}',
    componentPatterns: ['**/src/**/*.tsx'],
    excludePatterns: ['**/node_modules/**'],
    ...overrides,
  }
}

function makeAnalysis(overrides: Partial<ComponentAnalysis> = {}): ComponentAnalysis {
  return {
    name: 'Button',
    filePath: 'src/components/Button.tsx',
    library: 'ui',
    hasStory: false,
    exportType: 'named',
    props: [],
    dependencies: {
      usesRouter: false, usesReactQuery: false, usesChakra: false,
      usesGluestack: false, usesReactNative: false, usesEmotion: false,
      usesTailwind: false, usesFramerMotion: false, usesMSW: false,
      usesGlobalState: false, otherImports: [],
    },
    suggestions: [],
    sourcePreview: '',
    ...overrides,
  }
}

describe('generator', () => {
  it('generates story with SB10 imports', async () => {
    const story = await generateStory(makeConfig(), makeAnalysis(), { componentPath: 'src/components/Button.tsx' })
    expect(story.content).toContain("import type { Meta, StoryObj } from '@storybook/react'")
  })

  it('generates story with tags: []', async () => {
    const story = await generateStory(makeConfig(), makeAnalysis(), { componentPath: 'src/components/Button.tsx' })
    expect(story.content).toContain('tags: []')
    expect(story.content).not.toContain("'autodocs'")
  })

  it('generates Default story export', async () => {
    const story = await generateStory(makeConfig(), makeAnalysis(), { componentPath: 'src/components/Button.tsx' })
    expect(story.content).toContain('export const Default: Story')
    expect(story.stories).toContain('Default')
  })

  it('generates variant stories with correct JSX when props have controlOptions', async () => {
    const analysis = makeAnalysis({
      props: [
        { name: 'variant', type: "'solid' | 'outline'", required: false, controlType: 'select', controlOptions: ['solid', 'outline'] },
        { name: 'size', type: "'sm' | 'md' | 'lg'", required: false, controlType: 'select', controlOptions: ['sm', 'md', 'lg'] },
      ],
    })
    const story = await generateStory(makeConfig(), analysis, { componentPath: 'src/components/Button.tsx', includeVariants: true })
    
    // Should have variant stories
    expect(story.content).toContain('export const Sizes: Story')
    expect(story.content).toContain('export const Variants: Story')
    
    // JSX should use self-closing tags when component has no children prop
    expect(story.content).toContain('<Button size="sm" />')
    expect(story.content).toContain('<Button variant="solid" />')
  })

  it('generates interactive story for web components', async () => {
    const story = await generateStory(makeConfig(), makeAnalysis(), {
      componentPath: 'src/components/Button.tsx',
      includeInteractive: true,
    })
    expect(story.content).toContain('export const Interactive: Story')
    expect(story.content).toContain("import { expect, userEvent, within } from 'storybook/test'")
  })

  it('skips interactive story for react-native', async () => {
    const analysis = makeAnalysis({
      dependencies: {
        usesRouter: false, usesReactQuery: false, usesChakra: false,
        usesGluestack: false, usesReactNative: true, usesEmotion: false,
        usesTailwind: false, usesFramerMotion: false, usesMSW: false,
        usesGlobalState: false, otherImports: [],
      },
    })
    const story = await generateStory(makeConfig(), analysis, {
      componentPath: 'src/components/Button.tsx',
      includeInteractive: true,
    })
    expect(story.content).not.toContain('export const Interactive: Story')
  })

  it('adds router decorator when component uses router', async () => {
    const analysis = makeAnalysis({
      dependencies: {
        usesRouter: true, usesReactQuery: false, usesChakra: false,
        usesGluestack: false, usesReactNative: false, usesEmotion: false,
        usesTailwind: false, usesFramerMotion: false, usesMSW: false,
        usesGlobalState: false, otherImports: [],
      },
    })
    const story = await generateStory(makeConfig(), analysis, { componentPath: 'src/components/Button.tsx' })
    expect(story.content).toContain('withRouter')
    expect(story.content).toContain('decorators:')
  })

  it('handles component with no props', async () => {
    const story = await generateStory(makeConfig(), makeAnalysis({ props: [] }), { componentPath: 'src/components/Button.tsx' })
    expect(story.content).toContain('export const Default: Story')
    expect(story.filePath).toContain('.stories.tsx')
  })

  it('handles component with event handlers', async () => {
    const analysis = makeAnalysis({
      props: [
        { name: 'onClick', type: '() => void', required: false },
        { name: 'children', type: 'string', required: false },
      ],
    })
    const story = await generateStory(makeConfig(), analysis, { componentPath: 'src/components/Button.tsx' })
    expect(story.content).toBeTruthy()
  })
})
