/**
 * Code Connect Generator
 * Generates @figma/code-connect .figma.tsx files from component analysis.
 * Connects React components to Figma dev mode so designers see real code.
 */

import fs from 'node:fs'
import path from 'node:path'
import type { StorybookMCPConfig, ComponentAnalysis, PropDefinition } from '../types.js'

export interface GeneratedCodeConnect {
  /** File content for the .figma.tsx Code Connect file */
  content: string
  /** Path relative to project root, e.g. src/components/Button.figma.tsx */
  filePath: string
}

// ===========================================
// Prop Mapping
// ===========================================

/**
 * Map a PropDefinition to a figma.* call string.
 * Uses controlType and type to pick the right Figma property binding.
 */
function mapPropToFigma(prop: PropDefinition): string {
  const displayName = toPascalCase(prop.name)

  // Children / ReactNode → figma.children
  if (
    prop.name === 'children' ||
    prop.type === 'ReactNode' ||
    prop.type.includes('ReactNode')
  ) {
    return `figma.children(['*'])`
  }

  // Boolean
  if (prop.controlType === 'boolean' || prop.type === 'boolean') {
    return `figma.boolean('${displayName}')`
  }

  // Select / Radio / Union enum → figma.enum
  if (
    prop.controlType === 'select' ||
    prop.controlType === 'radio' ||
    prop.type.includes('|')
  ) {
    const options = prop.controlOptions ?? parseUnionOptions(prop.type)
    if (options.length > 0) {
      const entries = options
        .map(o => `      ${JSON.stringify(o)}: ${JSON.stringify(o)}`)
        .join(',\n')
      return `figma.enum('${displayName}', {\n${entries},\n    })`
    }
  }

  // Number
  if (prop.controlType === 'number' || prop.type === 'number') {
    return `figma.number('${displayName}')`
  }

  // Default: string
  return `figma.string('${displayName}')`
}

/** Extract union literal values from a type string like `'primary' | 'secondary'` */
function parseUnionOptions(type: string): string[] {
  return type
    .split('|')
    .map(t => t.trim().replace(/^['"]|['"]$/g, ''))
    .filter(t => t.length > 0 && !['undefined', 'null', 'ReactNode', 'string', 'number', 'boolean'].includes(t))
}

/** Convert camelCase or snake_case to PascalCase for Figma display names */
function toPascalCase(str: string): string {
  return str
    .replace(/[-_](.)/g, (_, c: string) => c.toUpperCase())
    .replace(/^(.)/, c => c.toUpperCase())
}

// ===========================================
// Generator
// ===========================================

/**
 * Generate a @figma/code-connect file for a component.
 *
 * @param figmaNodeUrl - Figma component URL. If omitted, a placeholder is used.
 *                       Format: https://figma.com/design/<fileId>/<fileName>?node-id=<nodeId>
 */
export async function generateCodeConnect(
  config: StorybookMCPConfig,
  analysis: ComponentAnalysis,
  figmaNodeUrl?: string
): Promise<GeneratedCodeConnect> {
  const { name, filePath, props } = analysis
  const nodeUrl = figmaNodeUrl ?? 'FIGMA_NODE_URL_HERE'

  // Relative import path from the .figma.tsx file to the component
  const componentBase = path.basename(filePath, path.extname(filePath))

  // Filter out props that shouldn't appear in Code Connect
  const connectProps = props.filter(p => {
    // Skip internal/callback-only props
    if (p.name.startsWith('on') && p.type.includes('=>')) return false
    if (p.name === 'className' || p.name === 'style' || p.name === 'ref') return false
    return true
  })

  // Build props block
  const propsLines = connectProps.map(prop => {
    const figmaBinding = mapPropToFigma(prop)
    return `    ${prop.name}: ${figmaBinding},`
  })

  // Build example function args
  const argNames = connectProps.map(p => p.name)
  const argsDestructure = argNames.length > 0 ? `{ ${argNames.join(', ')} }` : '_'

  // Build JSX for the example
  const jsxProps = connectProps
    .map(p => {
      if (p.name === 'children') return `{children}`
      return `${p.name}={${p.name}}`
    })
    .filter(p => p !== 'children')
    .join(' ')

  const hasChildren = connectProps.some(p => p.name === 'children')

  const exampleJsx = hasChildren
    ? `<${name} ${jsxProps}>{children}</${name}>`
    : `<${name} ${jsxProps} />`

  const propsSection =
    connectProps.length > 0
      ? `  props: {\n${propsLines.join('\n')}\n  },\n  `
      : '  '

  const content = `import figma from '@figma/code-connect/react'
import { ${name} } from './${componentBase}'

figma.connect(${name}, '${nodeUrl}', {
${propsSection}example: (${argsDestructure}) => (
    ${exampleJsx}
  ),
})
`

  // File path: same directory as component, .figma.tsx extension
  const dir = path.dirname(filePath)
  const outputFilePath = path.join(dir, `${componentBase}.figma.tsx`)

  return { content, filePath: outputFilePath }
}

// ===========================================
// File Writer
// ===========================================

export async function writeCodeConnectFile(
  config: StorybookMCPConfig,
  cc: GeneratedCodeConnect,
  overwrite = false
): Promise<boolean> {
  const fullPath = path.join(config.rootDir, cc.filePath)
  if (fs.existsSync(fullPath) && !overwrite) return false
  fs.mkdirSync(path.dirname(fullPath), { recursive: true })
  fs.writeFileSync(fullPath, cc.content, 'utf-8')
  return true
}
