import { describe, it, expect } from 'vitest'
import {
  parseStoryExports,
  extractStoryBlock,
  mergeStories,
  appendMissingGeneratedStories,
} from '../story-merger.js'

const GENERATED = `import type { Meta, StoryObj } from '@storybook/react'
import { Button } from './Button'

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
}

export default meta
type Story = StoryObj<typeof Button>

export const Default: Story = {
  args: { label: 'Click me' },
}

export const WithVariant: Story = {
  args: { label: 'Variant', variant: 'secondary' },
}
`

const EXISTING_WITH_USER_STORY = `import type { Meta, StoryObj } from '@storybook/react'
import { Button } from './Button'

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
}

export default meta
type Story = StoryObj<typeof Button>

export const Default: Story = {
  args: { label: 'Click me' },
}

export const WithVariant: Story = {
  args: { label: 'Variant', variant: 'secondary' },
}

export const MyCustomStory: Story = {
  args: { label: 'My custom story', disabled: true },
}
`

describe('parseStoryExports', () => {
  it('finds all Story export names', () => {
    const names = parseStoryExports(GENERATED)
    expect(names).toContain('Default')
    expect(names).toContain('WithVariant')
  })

  it('does not include meta or non-Story exports', () => {
    const source = `
export const meta = { title: 'X' }
export default meta
export const Default: Story = { args: {} }
export const NotAStory = 42
`
    const names = parseStoryExports(source)
    expect(names).toEqual(['Default'])
  })

  it('returns empty array for source with no story exports', () => {
    expect(parseStoryExports('export const meta = {}')).toEqual([])
  })
})

describe('extractStoryBlock', () => {
  it('extracts the correct block for a known export', () => {
    const block = extractStoryBlock(GENERATED, 'Default')
    expect(block).toContain('export const Default: Story')
    expect(block).toContain("label: 'Click me'")
    // Should not include the next export
    expect(block).not.toContain('WithVariant')
  })

  it('extracts the last export block to EOF', () => {
    const block = extractStoryBlock(GENERATED, 'WithVariant')
    expect(block).toContain('export const WithVariant: Story')
    expect(block).toContain("variant: 'secondary'")
  })

  it('returns empty string for unknown export name', () => {
    expect(extractStoryBlock(GENERATED, 'NonExistent')).toBe('')
  })
})

describe('mergeStories', () => {
  it('preserves user-added stories not in generated set', () => {
    const generatedExports = parseStoryExports(GENERATED)
    const result = mergeStories(GENERATED, EXISTING_WITH_USER_STORY, generatedExports)

    expect(result.preserved).toContain('MyCustomStory')
    expect(result.content).toContain('export const MyCustomStory: Story')
    expect(result.content).toContain("disabled: true")
  })

  it('user story appears after the generated content', () => {
    const generatedExports = parseStoryExports(GENERATED)
    const { content } = mergeStories(GENERATED, EXISTING_WITH_USER_STORY, generatedExports)

    const defaultIdx = content.indexOf('export const Default: Story')
    const customIdx = content.indexOf('export const MyCustomStory: Story')
    expect(customIdx).toBeGreaterThan(defaultIdx)
  })

  it('returns generated content unchanged when no user stories exist', () => {
    const generatedExports = parseStoryExports(GENERATED)
    const result = mergeStories(GENERATED, GENERATED, generatedExports)

    expect(result.preserved).toHaveLength(0)
    expect(result.content).toBe(GENERATED)
  })

  it('still includes separator comment when user stories are present', () => {
    const generatedExports = parseStoryExports(GENERATED)
    const { content } = mergeStories(GENERATED, EXISTING_WITH_USER_STORY, generatedExports)

    expect(content).toContain('User-added stories')
  })

  it('returned content still contains all generated stories', () => {
    const generatedExports = parseStoryExports(GENERATED)
    const { content } = mergeStories(GENERATED, EXISTING_WITH_USER_STORY, generatedExports)

    expect(content).toContain('export const Default: Story')
    expect(content).toContain('export const WithVariant: Story')
  })
})

describe('appendMissingGeneratedStories', () => {
  it('appends generated exports missing from the existing file', () => {
    const generated = `${GENERATED}\n\nexport const Interactive: Story = {\n  play: async () => {},\n}\n`
    const existing = `${GENERATED}\n` // missing Interactive

    const result = appendMissingGeneratedStories(generated, existing)
    expect(result.added).toEqual(['Interactive'])
    expect(result.content).toContain('export const Interactive: Story')
    expect(result.content).toContain('Added by storybook-mcp sync')
  })

  it('does nothing when existing already has all generated exports', () => {
    const result = appendMissingGeneratedStories(GENERATED, GENERATED)
    expect(result.added).toEqual([])
    expect(result.content).toBe(GENERATED)
  })
})
