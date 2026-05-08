import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
  generateStoryTool,
  generateTestTool,
  generateDocsTool,
  syncAll
} from '../tools.js'
import type { StorybookMCPConfig } from '../types.js'

let tmpDir: string

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tools-test-'))
  const compDir = path.join(tmpDir, 'src', 'components')
  fs.mkdirSync(compDir, { recursive: true })

  fs.writeFileSync(
    path.join(compDir, 'Widget.tsx'),
    `
import React from 'react'

interface WidgetProps {
  title: string
  children?: React.ReactNode
}

export const Widget: React.FC<WidgetProps> = ({ title, children }) => {
  return <div><h2>{title}</h2>{children}</div>
}
`
  )
})

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

function makeConfig(): StorybookMCPConfig {
  return {
    rootDir: tmpDir,
    libraries: [
      { name: 'ui', path: 'src/components', storyTitlePrefix: 'Components' }
    ],
    framework: 'vanilla',
    storyFilePattern: '**/*.stories.{ts,tsx}',
    componentPatterns: ['**/*.tsx', '!**/*.stories.tsx', '!**/*.test.tsx'],
    excludePatterns: ['**/node_modules/**']
  }
}

describe('tools - generation', () => {
  it('generate_test works', async () => {
    const result = await generateTestTool(makeConfig(), {
      componentPath: 'src/components/Widget.tsx',
      dryRun: true
    })
    expect(result).toBeDefined()
    expect(result.written).toBe(false) // dry run
  })

  it('generate_docs works', async () => {
    const result = await generateDocsTool(makeConfig(), {
      componentPath: 'src/components/Widget.tsx',
      dryRun: true
    })
    expect(result).toBeDefined()
    expect(result.written).toBe(false) // dry run
  })

  it('generate_story works (basic template)', async () => {
    const result = await generateStoryTool(makeConfig(), {
      componentPath: 'src/components/Widget.tsx',
      dryRun: true
    })
    expect(result.story.content).toContain('Widget')
    expect(result.written).toBe(false) // dry run
  })

  it('generate_story with advanced template succeeds', async () => {
    const result = await generateStoryTool(makeConfig(), {
      componentPath: 'src/components/Widget.tsx',
      template: 'with-msw',
      dryRun: true
    })
    expect(result.story.content.length).toBeGreaterThan(0)
    expect(result.written).toBe(false)
  })
})

describe('tools - syncAll', () => {
  it('processes multiple components', async () => {
    // Create multiple components
    const compDir = path.join(tmpDir, 'src', 'components')
    for (let i = 1; i <= 8; i++) {
      fs.writeFileSync(
        path.join(compDir, `Comp${i}.tsx`),
        `
import React from 'react'
export const Comp${i} = () => <div>Comp${i}</div>
`
      )
    }

    const result = await syncAll(makeConfig(), {
      generateStories: true,
      generateTests: true,
      generateDocs: true,
      dryRun: true
    })

    expect(result).toBeDefined()
  })

  it('allows test and docs generation', async () => {
    const result = await syncAll(makeConfig(), {
      generateTests: true,
      generateDocs: true,
      dryRun: true
    })
    expect(result).toBeDefined()
  })
})
