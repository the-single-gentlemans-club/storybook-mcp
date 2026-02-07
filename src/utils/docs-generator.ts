/**
 * Docs Generator
 * Generates MDX documentation files for components
 */

import fs from 'node:fs'
import path from 'node:path'
import type {
  StorybookMCPConfig,
  ComponentAnalysis,
  PropDefinition,
} from '../types.js'
import { toKebabCase } from './scanner.js'

export interface GeneratedDocs {
  content: string
  filePath: string
}

/**
 * Generate MDX documentation for a component
 */
export async function generateDocs(
  config: StorybookMCPConfig,
  analysis: ComponentAnalysis
): Promise<GeneratedDocs> {
  const { name, props, dependencies } = analysis
  const kebabName = toKebabCase(name)
  const docsPath = buildDocsPath(analysis.filePath)
  
  const library = config.libraries.find(l => l.name === analysis.library)
  const importPath = library?.importAlias 
    ? `${library.importAlias}/${name}`
    : `@/components/${name}`

  let content = `---
title: ${name}
description: Documentation for the ${name} component
---

import { ${name} } from '${importPath}'
import { Canvas, Meta, Story, Controls, ArgTypes } from '@storybook/blocks'
import * as ${name}Stories from './${path.basename(analysis.filePath, path.extname(analysis.filePath))}.stories'

<Meta of={${name}Stories} />

# ${name}

${generateDescription(name, props, dependencies)}

## Import

\`\`\`tsx
import { ${name} } from '${importPath}'
\`\`\`

## Usage

### Basic Example

<Canvas of={${name}Stories.Default} />

\`\`\`tsx
<${name}${generateExampleProps(props)}>
  Content
</${name}>
\`\`\`
`

  // Add variants section if applicable
  const variantProp = props.find(p => p.name === 'variant' && p.controlOptions)
  if (variantProp?.controlOptions) {
    content += `
### Variants

The \`${name}\` supports ${variantProp.controlOptions.length} visual variants:

<Canvas of={${name}Stories.Variants} />

\`\`\`tsx
${variantProp.controlOptions.map(v => `<${name} variant="${v}">${v}</${name}>`).join('\n')}
\`\`\`
`
  }

  // Add sizes section if applicable
  const sizeProp = props.find(p => p.name === 'size' && p.controlOptions)
  if (sizeProp?.controlOptions) {
    content += `
### Sizes

Available in ${sizeProp.controlOptions.length} sizes:

<Canvas of={${name}Stories.Sizes} />

\`\`\`tsx
${sizeProp.controlOptions.map(s => `<${name} size="${s}">${s}</${name}>`).join('\n')}
\`\`\`
`
  }

  // Props table
  content += `
## Props

<ArgTypes of={${name}} />

${generatePropsTable(props)}
`

  // Accessibility section
  content += `
## Accessibility

The \`${name}\` component follows WAI-ARIA guidelines:

${generateA11ySection(name, props)}
`

  // Dependencies/Integration section
  if (hasNotableDependencies(dependencies)) {
    content += `
## Integration Notes

${generateIntegrationNotes(dependencies)}
`
  }

  // Composition examples
  content += `
## Composition

### With Other Components

\`\`\`tsx
import { Stack } from '@chakra-ui/react'

<Stack spacing={4}>
  <${name}${variantProp ? ` variant="${variantProp.controlOptions?.[0]}"` : ''}>
    First item
  </${name}>
  <${name}${variantProp ? ` variant="${variantProp.controlOptions?.[1] || variantProp.controlOptions?.[0]}"` : ''}>
    Second item
  </${name}>
</Stack>
\`\`\`
`

  // Responsive design
  content += `
## Responsive Design

Use responsive props for different screen sizes:

\`\`\`tsx
<${name}
  ${sizeProp ? `size={{ base: '${sizeProp.controlOptions?.[0]}', md: '${sizeProp.controlOptions?.[1] || sizeProp.controlOptions?.[0]}' }}` : ''}
  width={{ base: '100%', md: 'auto' }}
>
  Responsive ${name}
</${name}>
\`\`\`
`

  // Best practices
  content += `
## Best Practices

${generateBestPractices(name, props)}
`

  // Related components
  content += `
## Related Components

${generateRelatedComponents(name, dependencies)}
`

  return {
    content,
    filePath: docsPath,
  }
}

/**
 * Generate component description
 */
function generateDescription(
  name: string,
  props: PropDefinition[],
  dependencies: ComponentAnalysis['dependencies']
): string {
  const features: string[] = []
  
  if (props.some(p => p.name === 'variant')) {
    features.push('multiple visual variants')
  }
  if (props.some(p => p.name === 'size')) {
    features.push('configurable sizes')
  }
  if (props.some(p => p.name === 'disabled')) {
    features.push('disabled state support')
  }
  if (dependencies.usesFramerMotion) {
    features.push('smooth animations')
  }

  if (features.length > 0) {
    return `The \`${name}\` component provides ${features.join(', ')}.`
  }
  
  return `The \`${name}\` component is a reusable UI element.`
}

/**
 * Generate example props for code snippet
 */
function generateExampleProps(props: PropDefinition[]): string {
  const exampleProps: string[] = []
  
  const variantProp = props.find(p => p.name === 'variant' && p.controlOptions)
  if (variantProp?.controlOptions?.[0]) {
    exampleProps.push(`variant="${variantProp.controlOptions[0]}"`)
  }
  
  const sizeProp = props.find(p => p.name === 'size' && p.controlOptions)
  if (sizeProp?.controlOptions?.[1]) { // Use middle size
    exampleProps.push(`size="${sizeProp.controlOptions[1]}"`)
  }

  return exampleProps.length > 0 ? ' ' + exampleProps.join(' ') : ''
}

/**
 * Generate props table
 */
function generatePropsTable(props: PropDefinition[]): string {
  if (props.length === 0) {
    return 'This component accepts standard HTML attributes.'
  }

  let table = `| Prop | Type | Default | Description |
|------|------|---------|-------------|
`

  for (const prop of props) {
    const type = prop.type.replace(/\|/g, '\\|')
    const defaultVal = prop.defaultValue || '-'
    const desc = prop.description || '-'
    table += `| \`${prop.name}\` | \`${type}\` | \`${defaultVal}\` | ${desc} |\n`
  }

  return table
}

/**
 * Generate accessibility section
 */
function generateA11ySection(name: string, props: PropDefinition[]): string {
  const features: string[] = [
    '- Supports keyboard navigation',
    '- Includes proper ARIA attributes',
    '- Compatible with screen readers',
  ]

  if (props.some(p => p.name === 'disabled')) {
    features.push('- Correctly announces disabled state')
  }

  features.push(`
### Keyboard Interactions

| Key | Description |
|-----|-------------|
| \`Tab\` | Moves focus to the component |
| \`Enter\` | Activates the component |
| \`Space\` | Activates the component |`)

  return features.join('\n')
}

/**
 * Check if component has notable dependencies
 */
function hasNotableDependencies(deps: ComponentAnalysis['dependencies']): boolean {
  return deps.usesRouter || deps.usesReactQuery || deps.usesGlobalState || deps.usesMSW
}

/**
 * Generate integration notes
 */
function generateIntegrationNotes(deps: ComponentAnalysis['dependencies']): string {
  const notes: string[] = []

  if (deps.usesRouter) {
    notes.push(`### Router Integration

This component uses React Router. Ensure it's wrapped in a Router provider:

\`\`\`tsx
import { BrowserRouter } from 'react-router-dom'

<BrowserRouter>
  <YourComponent />
</BrowserRouter>
\`\`\``)
  }

  if (deps.usesReactQuery) {
    notes.push(`### React Query Integration

This component uses TanStack Query. Ensure QueryClientProvider is configured:

\`\`\`tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

<QueryClientProvider client={queryClient}>
  <YourComponent />
</QueryClientProvider>
\`\`\``)
  }

  if (deps.usesGlobalState) {
    notes.push(`### State Management

This component relies on global state. Ensure the appropriate store provider is configured.`)
  }

  return notes.join('\n\n')
}

/**
 * Generate best practices
 */
function generateBestPractices(name: string, props: PropDefinition[]): string {
  const practices = [
    `1. **Accessibility**: Always provide meaningful content or aria-label`,
  ]

  if (props.some(p => p.name === 'variant')) {
    practices.push(`2. **Variants**: Choose the appropriate variant for the context (e.g., primary actions vs secondary)`)
  }

  if (props.some(p => p.name === 'size')) {
    practices.push(`3. **Sizing**: Use consistent sizes within the same section of your UI`)
  }

  practices.push(
    `4. **Composition**: Combine with other components using Stack or Flex for layouts`,
    `5. **Performance**: Avoid creating new callback functions on each render`
  )

  return practices.join('\n')
}

/**
 * Generate related components section
 */
function generateRelatedComponents(
  name: string,
  deps: ComponentAnalysis['dependencies']
): string {
  const related: string[] = []

  if (deps.usesChakra) {
    related.push(
      '- [Box](/components/box) - Base layout component',
      '- [Stack](/components/stack) - Layout with spacing',
      '- [Flex](/components/flex) - Flexbox layout'
    )
  } else {
    related.push(
      '- See your design system documentation for related components'
    )
  }

  return related.join('\n')
}

/**
 * Build docs file path from component path
 */
function buildDocsPath(componentPath: string): string {
  const dir = path.dirname(componentPath)
  const basename = path.basename(componentPath, path.extname(componentPath))
  return path.join(dir, `${basename}.mdx`)
}

/**
 * Write docs file to disk
 */
export async function writeDocsFile(
  config: StorybookMCPConfig,
  docs: GeneratedDocs,
  overwrite: boolean = false
): Promise<boolean> {
  const fullPath = path.join(config.rootDir, docs.filePath)
  
  if (fs.existsSync(fullPath) && !overwrite) {
    return false
  }
  
  const dir = path.dirname(fullPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  
  fs.writeFileSync(fullPath, docs.content, 'utf-8')
  return true
}
