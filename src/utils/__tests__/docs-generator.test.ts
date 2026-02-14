import { describe, it, expect } from 'vitest'
import { generateDocs } from '../docs-generator.js'
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

function makeAnalysis(overrides: Partial<ComponentAnalysis> = {}): ComponentAnalysis {
  return {
    name: 'Card',
    filePath: 'src/components/Card.tsx',
    library: 'ui',
    hasStory: false,
    exportType: 'named',
    props: [
      { name: 'variant', type: "'solid' | 'outline'", required: false, controlType: 'select', controlOptions: ['solid', 'outline'] },
      { name: 'size', type: "'sm' | 'md'", required: false, controlType: 'select', controlOptions: ['sm', 'md'] },
      { name: 'children', type: 'React.ReactNode', required: true },
    ],
    dependencies: {
      usesRouter: false, usesReactQuery: false, usesChakra: false,
      usesShadcn: false, usesTamagui: false, usesGluestack: false,
      usesReactNative: false, usesEmotion: false, usesTailwind: false,
      usesFramerMotion: false, usesMSW: false, usesGlobalState: false,
      otherImports: [],
    },
    suggestions: [],
    sourcePreview: '',
    ...overrides,
  }
}

describe('docs-generator', () => {
  it('starts with correct addon-docs/blocks import', async () => {
    const docs = await generateDocs(makeConfig(), makeAnalysis())
    expect(docs.content).toMatch(/^import \{ Canvas, Meta, ArgTypes \} from '@storybook\/addon-docs\/blocks'/)
  })

  it('does NOT contain YAML frontmatter', async () => {
    const docs = await generateDocs(makeConfig(), makeAnalysis())
    expect(docs.content).not.toMatch(/^---/m)
    // Also check there's no --- ... --- block
    expect(docs.content).not.toMatch(/^---\n[\s\S]*?\n---/m)
  })

  it('uses <ArgTypes of={CardStories} /> (not of={Card})', async () => {
    const docs = await generateDocs(makeConfig(), makeAnalysis())
    expect(docs.content).toContain('<ArgTypes of={CardStories} />')
    // Should NOT have <ArgTypes of={Card} />
    expect(docs.content).not.toMatch(/<ArgTypes of=\{Card\} \/>/)
  })

  it('uses <Meta of={CardStories} />', async () => {
    const docs = await generateDocs(makeConfig(), makeAnalysis())
    expect(docs.content).toContain('<Meta of={CardStories} />')
  })

  it('imports stories as: import * as CardStories from ./Card.stories', async () => {
    const docs = await generateDocs(makeConfig(), makeAnalysis())
    expect(docs.content).toContain("import * as CardStories from './Card.stories'")
  })

  it('does NOT import the component directly from @/ path', async () => {
    const docs = await generateDocs(makeConfig(), makeAnalysis())
    expect(docs.content).not.toMatch(/import \{ Card \} from ['"]@\//)
  })

  it('generates MDX file path', async () => {
    const docs = await generateDocs(makeConfig(), makeAnalysis())
    expect(docs.filePath).toContain('.mdx')
  })

  it('includes variant docs when component has variants', async () => {
    const docs = await generateDocs(makeConfig(), makeAnalysis())
    expect(docs.content).toContain('Variants')
    expect(docs.content).toContain('CardStories.Variants')
  })

  it('includes size docs when component has sizes', async () => {
    const docs = await generateDocs(makeConfig(), makeAnalysis())
    expect(docs.content).toContain('Sizes')
    expect(docs.content).toContain('CardStories.Sizes')
  })
})
