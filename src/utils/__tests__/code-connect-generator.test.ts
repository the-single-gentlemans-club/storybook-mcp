import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { generateCodeConnect, writeCodeConnectFile } from '../code-connect-generator.js'
import type { ComponentAnalysis } from '../../types.js'

// Minimal config for tests
const config = { rootDir: '/project', libraries: [] } as Parameters<typeof writeCodeConnectFile>[0]

// Factory for minimal ComponentAnalysis
function makeAnalysis(overrides: Partial<ComponentAnalysis> = {}): ComponentAnalysis {
  return {
    name: 'Button',
    filePath: 'src/components/Button.tsx',
    hasStory: false,
    exportType: 'default',
    props: [],
    dependencies: {
      usesRouter: false,
      usesReactQuery: false,
      usesChakra: false,
      usesShadcn: false,
      usesTamagui: false,
      usesGluestack: false,
      usesReactNative: false,
      usesEmotion: false,
      usesTailwind: false,
      usesFramerMotion: false,
      usesMSW: false,
      usesGlobalState: false,
      otherImports: [],
    },
    suggestions: [],
    sourcePreview: '',
    ...overrides,
  }
}

describe('generateCodeConnect', () => {
  it('generates a figma.connect call with the component name', async () => {
    const analysis = makeAnalysis({ name: 'Button', filePath: 'src/components/Button.tsx' })
    const result = await generateCodeConnect(config, analysis)
    expect(result.content).toContain('figma.connect(Button,')
  })

  it('uses placeholder URL when figmaNodeUrl is not provided', async () => {
    const analysis = makeAnalysis()
    const result = await generateCodeConnect(config, analysis)
    expect(result.content).toContain('FIGMA_NODE_URL_HERE')
  })

  it('uses provided figmaNodeUrl', async () => {
    const analysis = makeAnalysis()
    const url = 'https://figma.com/design/abc123/MyFile?node-id=1%3A2'
    const result = await generateCodeConnect(config, analysis, url)
    expect(result.content).toContain(url)
    expect(result.content).not.toContain('FIGMA_NODE_URL_HERE')
  })

  it('imports @figma/code-connect/react', async () => {
    const analysis = makeAnalysis()
    const result = await generateCodeConnect(config, analysis)
    expect(result.content).toContain("import figma from '@figma/code-connect/react'")
  })

  it('imports the component from the same directory', async () => {
    const analysis = makeAnalysis({ name: 'Button', filePath: 'src/components/Button.tsx' })
    const result = await generateCodeConnect(config, analysis)
    expect(result.content).toContain("import { Button } from './Button'")
  })

  it('output filePath is <componentDir>/<ComponentName>.figma.tsx', async () => {
    const analysis = makeAnalysis({ name: 'Button', filePath: 'src/components/Button.tsx' })
    const result = await generateCodeConnect(config, analysis)
    expect(result.filePath).toBe(path.join('src/components', 'Button.figma.tsx'))
  })

  it('maps string prop to figma.string()', async () => {
    const analysis = makeAnalysis({
      props: [{ name: 'label', type: 'string', required: true, controlType: 'text' }],
    })
    const result = await generateCodeConnect(config, analysis)
    expect(result.content).toContain("figma.string('Label')")
  })

  it('maps boolean prop to figma.boolean()', async () => {
    const analysis = makeAnalysis({
      props: [{ name: 'disabled', type: 'boolean', required: false, controlType: 'boolean' }],
    })
    const result = await generateCodeConnect(config, analysis)
    expect(result.content).toContain("figma.boolean('Disabled')")
  })

  it('maps select prop to figma.enum() with options', async () => {
    const analysis = makeAnalysis({
      props: [
        {
          name: 'variant',
          type: "'primary' | 'secondary' | 'ghost'",
          required: false,
          controlType: 'select',
          controlOptions: ['primary', 'secondary', 'ghost'],
        },
      ],
    })
    const result = await generateCodeConnect(config, analysis)
    expect(result.content).toContain("figma.enum('Variant'")
    expect(result.content).toContain('"primary": "primary"')
    expect(result.content).toContain('"secondary": "secondary"')
    expect(result.content).toContain('"ghost": "ghost"')
  })

  it('maps union type (no controlType) to figma.enum() via parsed options', async () => {
    const analysis = makeAnalysis({
      props: [
        {
          name: 'size',
          type: "'sm' | 'md' | 'lg'",
          required: false,
        },
      ],
    })
    const result = await generateCodeConnect(config, analysis)
    expect(result.content).toContain("figma.enum('Size'")
    expect(result.content).toContain('"sm"')
    expect(result.content).toContain('"md"')
    expect(result.content).toContain('"lg"')
  })

  it('maps children prop (ReactNode) to figma.children()', async () => {
    const analysis = makeAnalysis({
      props: [{ name: 'children', type: 'ReactNode', required: false }],
    })
    const result = await generateCodeConnect(config, analysis)
    expect(result.content).toContain("figma.children(['*'])")
  })

  it('maps children prop by name regardless of type', async () => {
    const analysis = makeAnalysis({
      props: [{ name: 'children', type: 'React.ReactNode', required: false }],
    })
    const result = await generateCodeConnect(config, analysis)
    expect(result.content).toContain("figma.children(['*'])")
  })

  it('skips event handler props (onX with => in type)', async () => {
    const analysis = makeAnalysis({
      props: [
        { name: 'onClick', type: '() => void', required: false },
        { name: 'label', type: 'string', required: true },
      ],
    })
    const result = await generateCodeConnect(config, analysis)
    expect(result.content).not.toContain('onClick')
    expect(result.content).toContain('label')
  })

  it('skips className, style, and ref props', async () => {
    const analysis = makeAnalysis({
      props: [
        { name: 'className', type: 'string', required: false },
        { name: 'style', type: 'CSSProperties', required: false },
        { name: 'ref', type: 'Ref<HTMLButtonElement>', required: false },
        { name: 'label', type: 'string', required: true },
      ],
    })
    const result = await generateCodeConnect(config, analysis)
    expect(result.content).not.toContain('className')
    expect(result.content).not.toContain("'Style'")
    expect(result.content).not.toContain("'Ref'")
    expect(result.content).toContain('label')
  })

  it('generates self-closing JSX for component without children', async () => {
    const analysis = makeAnalysis({
      name: 'Button',
      props: [{ name: 'label', type: 'string', required: true }],
    })
    const result = await generateCodeConnect(config, analysis)
    expect(result.content).toContain('<Button')
    expect(result.content).toContain('/>')
    expect(result.content).not.toContain('</Button>')
  })

  it('generates wrapping JSX for component with children', async () => {
    const analysis = makeAnalysis({
      name: 'Card',
      filePath: 'src/components/Card.tsx',
      props: [{ name: 'children', type: 'ReactNode', required: false }],
    })
    const result = await generateCodeConnect(config, analysis)
    expect(result.content).toContain('<Card')
    expect(result.content).toContain('</Card>')
  })

  it('converts camelCase prop name to PascalCase for Figma display', async () => {
    const analysis = makeAnalysis({
      props: [{ name: 'isLoading', type: 'boolean', required: false, controlType: 'boolean' }],
    })
    const result = await generateCodeConnect(config, analysis)
    expect(result.content).toContain("figma.boolean('IsLoading')")
  })

  it('handles component with no props (empty props array)', async () => {
    const analysis = makeAnalysis({ name: 'Spinner', filePath: 'src/components/Spinner.tsx', props: [] })
    const result = await generateCodeConnect(config, analysis)
    expect(result.content).toContain('figma.connect(Spinner,')
    expect(result.filePath).toBe(path.join('src/components', 'Spinner.figma.tsx'))
  })
})

describe('writeCodeConnectFile', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('writes the file to disk', async () => {
    const tmpConfig = { rootDir: tmpDir, libraries: [] } as Parameters<typeof writeCodeConnectFile>[0]
    const cc = { content: 'hello figma', filePath: 'src/Button.figma.tsx' }
    const written = await writeCodeConnectFile(tmpConfig, cc)
    expect(written).toBe(true)
    const fullPath = path.join(tmpDir, 'src/Button.figma.tsx')
    expect(fs.existsSync(fullPath)).toBe(true)
    expect(fs.readFileSync(fullPath, 'utf-8')).toBe('hello figma')
  })

  it('does not overwrite existing file when overwrite=false', async () => {
    const tmpConfig = { rootDir: tmpDir, libraries: [] } as Parameters<typeof writeCodeConnectFile>[0]
    const filePath = 'src/Button.figma.tsx'
    const fullPath = path.join(tmpDir, filePath)
    fs.mkdirSync(path.dirname(fullPath), { recursive: true })
    fs.writeFileSync(fullPath, 'original content')

    const written = await writeCodeConnectFile(tmpConfig, { content: 'new content', filePath })
    expect(written).toBe(false)
    expect(fs.readFileSync(fullPath, 'utf-8')).toBe('original content')
  })

  it('overwrites existing file when overwrite=true', async () => {
    const tmpConfig = { rootDir: tmpDir, libraries: [] } as Parameters<typeof writeCodeConnectFile>[0]
    const filePath = 'src/Button.figma.tsx'
    const fullPath = path.join(tmpDir, filePath)
    fs.mkdirSync(path.dirname(fullPath), { recursive: true })
    fs.writeFileSync(fullPath, 'original content')

    const written = await writeCodeConnectFile(tmpConfig, { content: 'new content', filePath }, true)
    expect(written).toBe(true)
    expect(fs.readFileSync(fullPath, 'utf-8')).toBe('new content')
  })

  it('creates intermediate directories if needed', async () => {
    const tmpConfig = { rootDir: tmpDir, libraries: [] } as Parameters<typeof writeCodeConnectFile>[0]
    const cc = { content: 'test', filePath: 'deep/nested/dir/Component.figma.tsx' }
    const written = await writeCodeConnectFile(tmpConfig, cc)
    expect(written).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, cc.filePath))).toBe(true)
  })
})
