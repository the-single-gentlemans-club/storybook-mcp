import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
  detectFramework,
  detectNextjs,
  detectProjectType,
  runSetup,
} from '../setup.js'

let tmpDir: string

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'setup-test-'))
})

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('setup - detection', () => {
  it('detectProjectType returns standard when no nx.json', () => {
    expect(detectProjectType(tmpDir)).toBe('standard')
  })

  it('detectProjectType returns nx when nx.json exists', () => {
    const nxDir = path.join(tmpDir, 'nx-project')
    fs.mkdirSync(nxDir, { recursive: true })
    fs.writeFileSync(path.join(nxDir, 'nx.json'), '{}')
    expect(detectProjectType(nxDir)).toBe('nx')
  })

  it('detectFramework returns vanilla when no package.json', () => {
    const emptyDir = path.join(tmpDir, 'empty')
    fs.mkdirSync(emptyDir, { recursive: true })
    expect(detectFramework(emptyDir)).toBe('vanilla')
  })

  it('detectFramework detects Chakra', () => {
    const dir = path.join(tmpDir, 'chakra-proj')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({
        dependencies: { '@chakra-ui/react': '^2.0.0' }
      })
    )
    expect(detectFramework(dir)).toBe('chakra')
  })

  it('detectFramework detects shadcn via class-variance-authority', () => {
    const dir = path.join(tmpDir, 'shadcn-cva')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({
        dependencies: { 'class-variance-authority': '^1.0.0' }
      })
    )
    expect(detectFramework(dir)).toBe('shadcn')
  })

  it('detectFramework detects shadcn via tailwindcss only', () => {
    const dir = path.join(tmpDir, 'shadcn-tw')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({
        devDependencies: { tailwindcss: '^4.0.0' }
      })
    )
    expect(detectFramework(dir)).toBe('shadcn')
  })

  it('detectFramework detects Gluestack', () => {
    const dir = path.join(tmpDir, 'gluestack-proj')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({
        dependencies: { '@gluestack-ui/themed': '^1.0.0' }
      })
    )
    expect(detectFramework(dir)).toBe('gluestack')
  })
})

describe('setup - config generation', () => {
  it('generates correct main.ts with SB10 structure', async () => {
    const dir = path.join(tmpDir, 'gen-test')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ scripts: {} })
    )

    await runSetup(dir, { dryRun: false, force: true })

    const mainPath = path.join(dir, '.storybook', 'main.ts')
    expect(fs.existsSync(mainPath)).toBe(true)

    const mainContent = fs.readFileSync(mainPath, 'utf-8')

    // Check stories glob
    expect(mainContent).toContain('../src/**/*.@(mdx|stories.@(js|jsx|ts|tsx))')

    // Check NO autodocs config (legacy config in this branch)
    expect(mainContent).not.toContain("autodocs: 'tag'")
    expect(mainContent).not.toContain('autodocs')

    // Check framework
    expect(mainContent).toContain('@storybook/react-vite')
  })

  it('generates Chakra preview with ChakraProvider', async () => {
    const dir = path.join(tmpDir, 'chakra-gen')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({
        scripts: {},
        dependencies: { '@chakra-ui/react': '^2.0.0' }
      })
    )

    await runSetup(dir, { force: true })

    const previewPath = path.join(dir, '.storybook', 'preview.tsx')
    expect(fs.existsSync(previewPath)).toBe(true)
    const content = fs.readFileSync(previewPath, 'utf-8')
    expect(content).toContain('ChakraProvider')
  })

  it('generates shadcn preview with Tailwind CSS import', async () => {
    const dir = path.join(tmpDir, 'shadcn-gen')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({
        scripts: {},
        dependencies: { 'class-variance-authority': '^1.0.0' }
      })
    )

    await runSetup(dir, { force: true })

    const previewPath = path.join(dir, '.storybook', 'preview.tsx')
    const content = fs.readFileSync(previewPath, 'utf-8')
    expect(content).toContain('index.css')
  })

  it('generates Gluestack preview with GluestackUIProvider', async () => {
    const dir = path.join(tmpDir, 'gluestack-gen')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({
        scripts: {},
        dependencies: { '@gluestack-ui/themed': '^1.0.0' }
      })
    )

    await runSetup(dir, { force: true })

    const previewPath = path.join(dir, '.storybook', 'preview.tsx')
    const content = fs.readFileSync(previewPath, 'utf-8')
    expect(content).toContain('GluestackUIProvider')
  })

  it('generates Tamagui preview with TamaguiProvider', async () => {
    const dir = path.join(tmpDir, 'tamagui-gen')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({
        scripts: {},
        dependencies: { tamagui: '^1.0.0' }
      })
    )

    await runSetup(dir, { force: true })

    const previewPath = path.join(dir, '.storybook', 'preview.tsx')
    const content = fs.readFileSync(previewPath, 'utf-8')
    expect(content).toContain('TamaguiProvider')

    // Tamagui uses webpack
    const mainPath = path.join(dir, '.storybook', 'main.ts')
    const mainContent = fs.readFileSync(mainPath, 'utf-8')
    expect(mainContent).toContain('@storybook/react-webpack5')
  })

  it('adds scripts to package.json', async () => {
    const dir = path.join(tmpDir, 'scripts-test')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ scripts: {} })
    )

    const result = await runSetup(dir, { force: true })

    const pkg = JSON.parse(
      fs.readFileSync(path.join(dir, 'package.json'), 'utf-8')
    )
    expect(pkg.scripts.storybook).toBe('storybook dev -p 6006')
    expect(pkg.scripts['build-storybook']).toBe('storybook build')
    expect(result.scriptsAdded).toContain('storybook')
  })
})

describe('setup - Next.js detection', () => {
  it('detectNextjs returns false when no next dependency', () => {
    const dir = path.join(tmpDir, 'nextjs-none')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ dependencies: {} })
    )
    expect(detectNextjs(dir)).toBe(false)
  })

  it('detectNextjs returns false when next is in deps but no next.config', () => {
    const dir = path.join(tmpDir, 'nextjs-no-config')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ dependencies: { next: '^15.0.0' } })
    )
    expect(detectNextjs(dir)).toBe(false)
  })

  it('detectNextjs returns true when next + next.config.js exist', () => {
    const dir = path.join(tmpDir, 'nextjs-js')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ dependencies: { next: '^15.0.0' } })
    )
    fs.writeFileSync(path.join(dir, 'next.config.js'), 'module.exports = {}')
    expect(detectNextjs(dir)).toBe(true)
  })

  it('detectNextjs returns true for next.config.ts/.mjs/.cjs', () => {
    for (const ext of ['ts', 'mjs', 'cjs']) {
      const dir = path.join(tmpDir, `nextjs-${ext}`)
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(
        path.join(dir, 'package.json'),
        JSON.stringify({ dependencies: { next: '^15.0.0' } })
      )
      fs.writeFileSync(path.join(dir, `next.config.${ext}`), 'export default {}')
      expect(detectNextjs(dir)).toBe(true)
    }
  })
})

describe('setup - Next.js scaffolding', () => {
  it('emits @storybook/nextjs framework package in main.ts for Next.js project', async () => {
    const dir = path.join(tmpDir, 'nextjs-vanilla-gen')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({
        scripts: {},
        dependencies: { next: '^15.0.0', react: '^19.0.0' }
      })
    )
    fs.writeFileSync(path.join(dir, 'next.config.js'), 'module.exports = {}')

    const result = await runSetup(dir, { force: true })

    expect(result.isNextjs).toBe(true)

    const mainContent = fs.readFileSync(
      path.join(dir, '.storybook', 'main.ts'),
      'utf-8'
    )
    expect(mainContent).toContain('@storybook/nextjs')
    expect(mainContent).not.toContain('@storybook/react-vite')
  })

  it('Next.js + Chakra: framework package is @storybook/nextjs, preview still ChakraProvider', async () => {
    const dir = path.join(tmpDir, 'nextjs-chakra-gen')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({
        scripts: {},
        dependencies: {
          next: '^15.0.0',
          react: '^19.0.0',
          '@chakra-ui/react': '^2.0.0'
        }
      })
    )
    fs.writeFileSync(path.join(dir, 'next.config.js'), 'module.exports = {}')

    const result = await runSetup(dir, { force: true })

    expect(result.isNextjs).toBe(true)
    expect(result.framework).toBe('chakra')

    const mainContent = fs.readFileSync(
      path.join(dir, '.storybook', 'main.ts'),
      'utf-8'
    )
    expect(mainContent).toContain('@storybook/nextjs')

    const previewContent = fs.readFileSync(
      path.join(dir, '.storybook', 'preview.tsx'),
      'utf-8'
    )
    expect(previewContent).toContain('ChakraProvider')
    expect(previewContent).toContain('@storybook/nextjs')
    expect(previewContent).toContain('appDirectory: true')
  })

  it('emits @storybook/nextjs in dependencies.dev for Next.js project', async () => {
    const dir = path.join(tmpDir, 'nextjs-deps')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({
        scripts: {},
        dependencies: { next: '^15.0.0' }
      })
    )
    fs.writeFileSync(path.join(dir, 'next.config.js'), 'module.exports = {}')

    const result = await runSetup(dir, { force: true, dryRun: true })

    expect(
      result.dependencies.dev.some(d => d.startsWith('@storybook/nextjs@'))
    ).toBe(true)
    expect(
      result.dependencies.dev.some(d => d.startsWith('@storybook/react-vite@'))
    ).toBe(false)
  })
})
