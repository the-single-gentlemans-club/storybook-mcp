/**
 * Story Generator
 * Generates Storybook story files based on component analysis
 */

import fs from 'node:fs'
import path from 'node:path'
import type {
  StorybookMCPConfig,
  ComponentAnalysis,
  StoryGenerationOptions,
  GeneratedStory,
  PropDefinition,
} from '../types.js'
import { toKebabCase } from './scanner.js'

/**
 * Generate a story file for a component
 */
export async function generateStory(
  config: StorybookMCPConfig,
  analysis: ComponentAnalysis,
  options: StoryGenerationOptions
): Promise<GeneratedStory> {
  const {
    includeVariants = true,
    includeInteractive = true,
    includeA11y = false,
    includeResponsive = false,
    template = 'basic',
  } = options

  const library = config.libraries.find(l => l.name === analysis.library)
  const storyTitle = buildStoryTitle(library?.storyTitlePrefix, analysis.name)
  const imports = buildImports(analysis, config.framework, options)
  const decorators = buildDecorators(analysis, library?.decorators, options)
  const argTypes = buildArgTypes(analysis.props)
  const defaultArgs = buildDefaultArgs(analysis.props)

  const stories: string[] = ['Default']
  let content = ''

  // Build meta
  content += imports.join('\n') + '\n\n'
  content += buildMeta(analysis, storyTitle, decorators, argTypes, defaultArgs)
  content += '\n\n'
  content += `type Story = StoryObj<typeof ${analysis.name}>\n\n`

  // Default story
  content += buildDefaultStory(analysis, defaultArgs)

  // Variant stories
  if (includeVariants) {
    const variantStories = buildVariantStories(analysis)
    if (variantStories) {
      content += '\n' + variantStories
      stories.push('Sizes', 'Variants')
    }
  }

  // Interactive story (Web only)
  if (includeInteractive && config.framework !== 'react-native' && !analysis.dependencies.usesReactNative) {
    content += '\n' + buildInteractiveStory(analysis)
    stories.push('Interactive')
  }

  // Accessibility story (Web only)
  if (includeA11y && config.framework !== 'react-native' && !analysis.dependencies.usesReactNative) {
    content += '\n' + buildA11yStory(analysis)
    stories.push('Accessibility')
  }

  // Responsive stories
  if (includeResponsive) {
    content += '\n' + buildResponsiveStories(analysis)
    stories.push('Mobile', 'Desktop')
  }

  // Determine output path
  const storyPath = analysis.storyPath || buildStoryPath(analysis.filePath)

  const warnings: string[] = []
  
  if (analysis.dependencies.usesRouter && !options.decorators?.includes('withRouter')) {
    warnings.push('Component uses routing - add withRouter decorator if not already configured')
  }
  
  if (analysis.dependencies.usesReactQuery) {
    warnings.push('Component uses React Query - ensure QueryClientProvider is in decorators')
  }

  if (analysis.dependencies.usesGluestack) {
    warnings.push('Component uses Gluestack UI - ensure GluestackUIProvider is in decorators (usually in .storybook/preview.tsx)')
  }

  if (analysis.dependencies.usesReactNative) {
    warnings.push('Component uses React Native - ensure @storybook/react-native is configured')
  }

  return {
    content,
    filePath: storyPath,
    imports: imports.map(i => i.replace(/^import .+ from ['"](.+)['"].*$/, '$1')),
    stories,
    warnings,
  }
}

/**
 * Build story title from prefix and component name
 */
function buildStoryTitle(prefix: string | undefined, componentName: string): string {
  if (prefix) {
    return `${prefix}/${componentName}`
  }
  return `Components/${componentName}`
}

/**
 * Build import statements
 */
function buildImports(
  analysis: ComponentAnalysis,
  framework: StorybookMCPConfig['framework'],
  options: StoryGenerationOptions
): string[] {
  const imports: string[] = [
    `import type { Meta, StoryObj } from '@storybook/react'`,
  ]

  // Add test utilities if interactive (only for web)
  if ((options.includeInteractive || options.includeA11y) && 
      framework !== 'react-native' && 
      !analysis.dependencies.usesReactNative) {
    imports.push(`import { expect, userEvent, within } from 'storybook/test'`)
  }

  // Add component import
  const componentDir = path.dirname(analysis.filePath)
  const componentFile = path.basename(analysis.filePath, path.extname(analysis.filePath))
  const importPath = `./${componentFile === 'index' ? '' : componentFile}`
  
  if (analysis.exportType === 'default') {
    imports.push(`import ${analysis.name} from '${importPath}'`)
  } else {
    imports.push(`import { ${analysis.name} } from '${importPath}'`)
  }

  // Add router decorator if needed
  if (analysis.dependencies.usesRouter) {
    imports.push(`import { withRouter } from 'storybook-addon-remix-react-router'`)
  }

  // Add framework-specific imports (Chakra/Tamagui/Gluestack providers are in .storybook/preview.tsx)
  if (framework === 'react-native' || analysis.dependencies.usesReactNative) {
    // React Native specific imports
    imports.push(`import { View } from 'react-native'`)
    
    // Remove web-only imports that might have been added by default
    const webImports = [
      `import { expect, userEvent, within } from 'storybook/test'`,
      `import { withRouter } from 'storybook-addon-remix-react-router'`
    ]
    
    for (const imp of webImports) {
      const index = imports.indexOf(imp)
      if (index !== -1) {
        imports.splice(index, 1)
      }
    }
  }

  return imports
}

/**
 * Build decorators array
 */
function buildDecorators(
  analysis: ComponentAnalysis,
  libraryDecorators: string[] | undefined,
  options: StoryGenerationOptions
): string[] {
  const decorators: string[] = []

  if (libraryDecorators) {
    decorators.push(...libraryDecorators)
  }

  if (options.decorators) {
    decorators.push(...options.decorators)
  }

  if (analysis.dependencies.usesRouter) {
    decorators.push('withRouter')
  }

  return decorators
}

/**
 * Build argTypes from props
 */
function buildArgTypes(props: PropDefinition[]): string {
  const argTypes: Record<string, object> = {}

  for (const prop of props) {
    if (prop.controlType) {
      const argType: Record<string, unknown> = {
        control: prop.controlOptions 
          ? { type: prop.controlType, options: prop.controlOptions }
          : prop.controlType,
      }
      
      if (prop.description) {
        argType.description = prop.description
      }

      argTypes[prop.name] = argType
    }
  }

  if (Object.keys(argTypes).length === 0) {
    return ''
  }

  return `argTypes: ${JSON.stringify(argTypes, null, 4).replace(/"(\w+)":/g, '$1:')}`
}

/**
 * Build default args from props
 */
function buildDefaultArgs(props: PropDefinition[]): Record<string, unknown> {
  const args: Record<string, unknown> = {}

  for (const prop of props) {
    if (prop.defaultValue !== undefined) {
      args[prop.name] = prop.defaultValue
    } else if (prop.controlOptions && prop.controlOptions.length > 0) {
      args[prop.name] = prop.controlOptions[0]
    } else if (prop.name === 'children') {
      args[prop.name] = 'Content'
    }
  }

  return args
}

/**
 * Build the meta export
 */
function buildMeta(
  analysis: ComponentAnalysis,
  title: string,
  decorators: string[],
  argTypes: string,
  defaultArgs: Record<string, unknown>
): string {
  let meta = `const meta: Meta<typeof ${analysis.name}> = {\n`
  meta += `  title: '${title}',\n`
  meta += `  component: ${analysis.name},\n`
  meta += `  tags: [],\n`
  
  if (decorators.length > 0) {
    meta += `  decorators: [${decorators.join(', ')}],\n`
  }
  
  if (argTypes) {
    meta += `  ${argTypes},\n`
  }
  
  if (Object.keys(defaultArgs).length > 0) {
    meta += `  args: ${JSON.stringify(defaultArgs, null, 4).replace(/"(\w+)":/g, '$1:')},\n`
  }
  
  meta += `}\n\nexport default meta`
  
  return meta
}

/**
 * Build the default story
 */
function buildDefaultStory(
  analysis: ComponentAnalysis,
  defaultArgs: Record<string, unknown>
): string {
  let story = `/**\n * Default ${analysis.name}\n */\n`
  story += `export const Default: Story = {\n`
  
  if (Object.keys(defaultArgs).length > 0) {
    story += `  args: ${JSON.stringify(defaultArgs, null, 4).replace(/"(\w+)":/g, '$1:')},\n`
  }
  
  story += `}\n`
  
  return story
}

/**
 * Build variant stories (sizes, variants, etc.)
 */
function buildVariantStories(analysis: ComponentAnalysis): string | null {
  const variantProps = analysis.props.filter(p => 
    ['variant', 'size', 'colorScheme'].includes(p.name) && p.controlOptions
  )

  if (variantProps.length === 0) {
    return null
  }

  const hasChildren = analysis.props.some(p => p.name === 'children')
  let stories = ''

  // Size story
  const sizeProp = variantProps.find(p => p.name === 'size')
  if (sizeProp?.controlOptions) {
    stories += `/**\n * All size variants\n */\n`
    stories += `export const Sizes: Story = {\n`
    stories += `  render: () => (\n`
    stories += `    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>\n`
    for (const size of sizeProp.controlOptions) {
      if (hasChildren) {
        stories += `      <${analysis.name} size="${size}">${size}</${analysis.name}>\n`
      } else {
        stories += `      <${analysis.name} size="${size}" />\n`
      }
    }
    stories += `    </div>\n`
    stories += `  ),\n`
    stories += `}\n\n`
  }

  // Variant story
  const variantProp = variantProps.find(p => p.name === 'variant')
  if (variantProp?.controlOptions) {
    stories += `/**\n * All style variants\n */\n`
    stories += `export const Variants: Story = {\n`
    stories += `  render: () => (\n`
    stories += `    <div style={{ display: 'flex', gap: '1rem' }}>\n`
    for (const variant of variantProp.controlOptions) {
      if (hasChildren) {
        stories += `      <${analysis.name} variant="${variant}">${variant}</${analysis.name}>\n`
      } else {
        stories += `      <${analysis.name} variant="${variant}" />\n`
      }
    }
    stories += `    </div>\n`
    stories += `  ),\n`
    stories += `}\n`
  }

  return stories
}

/**
 * Build interactive story with play function
 * Adapts query strategy based on component props
 */
function buildInteractiveStory(analysis: ComponentAnalysis): string {
  const hasChildren = analysis.props.some(p => p.name === 'children')
  const hasOnClick = analysis.props.some(p => p.name === 'onClick')
  const hasRole = analysis.props.some(p => p.name === 'role')

  let story = `/**\n * Interactive test\n */\n`
  story += `export const Interactive: Story = {\n`

  if (hasChildren) {
    // Component with children - use text query
    story += `  args: {\n`
    story += `    children: 'Click me',\n`
    if (hasOnClick) {
      story += `    onClick: () => {},\n`
    }
    story += `  },\n`
    story += `  play: async ({ canvasElement }) => {\n`
    story += `    const canvas = within(canvasElement)\n`
    story += `    const element = canvas.getByText(/click me/i)\n`
    story += `    \n`
    story += `    // Verify element renders\n`
    story += `    await expect(element).toBeInTheDocument()\n`
    if (hasOnClick) {
      story += `    \n`
      story += `    // Test interaction\n`
      story += `    await userEvent.click(element)\n`
    }
    story += `  },\n`
  } else if (hasRole) {
    // Component with role prop - use role query
    story += `  args: {\n`
    story += `    role: 'button',\n`
    if (hasOnClick) {
      story += `    onClick: () => {},\n`
    }
    story += `  },\n`
    story += `  play: async ({ canvasElement }) => {\n`
    story += `    const canvas = within(canvasElement)\n`
    story += `    const element = canvas.getByRole('button')\n`
    story += `    \n`
    story += `    await expect(element).toBeInTheDocument()\n`
    if (hasOnClick) {
      story += `    await userEvent.click(element)\n`
    }
    story += `  },\n`
  } else {
    // Fallback - just verify render, no interaction
    story += `  play: async ({ canvasElement }) => {\n`
    story += `    // Verify component renders\n`
    story += `    await expect(canvasElement.firstElementChild).toBeInTheDocument()\n`
    story += `  },\n`
  }

  story += `}\n`

  return story
}

/**
 * Build accessibility story
 * Only adds aria-label if component accepts it
 */
function buildA11yStory(analysis: ComponentAnalysis): string {
  const hasChildren = analysis.props.some(p => p.name === 'children')
  const hasAriaLabel = analysis.props.some(p => p.name === 'aria-label' || p.name === 'ariaLabel')
  const hasRole = analysis.props.some(p => p.name === 'role')

  let story = `/**\n * Accessibility test\n */\n`
  story += `export const Accessibility: Story = {\n`
  story += `  args: {\n`

  if (hasChildren) {
    story += `    children: 'Accessible ${analysis.name}',\n`
  }
  if (hasAriaLabel) {
    story += `    'aria-label': '${analysis.name} example',\n`
  }
  if (hasRole && !hasAriaLabel) {
    story += `    role: 'region',\n`
  }

  story += `  },\n`
  story += `  play: async ({ canvasElement }) => {\n`
  story += `    const canvas = within(canvasElement)\n`

  // Choose query strategy based on available props
  if (hasAriaLabel) {
    story += `    const element = canvas.getByLabelText(/${analysis.name} example/i)\n`
  } else if (hasRole) {
    story += `    const element = canvas.getByRole('region')\n`
  } else if (hasChildren) {
    story += `    const element = canvas.getByText(/accessible ${analysis.name}/i)\n`
  } else {
    story += `    const element = canvasElement.firstElementChild as HTMLElement\n`
  }

  story += `    \n`
  story += `    await expect(element).toBeInTheDocument()\n`

  // Only test keyboard navigation if element is likely focusable
  const likelyFocusable = hasAriaLabel || hasRole || analysis.props.some(p => p.name === 'onClick' || p.name === 'onKeyDown')
  if (likelyFocusable) {
    story += `    \n`
    story += `    // Test keyboard navigation\n`
    story += `    await userEvent.tab()\n`
    story += `    // Check if element received focus\n`
    story += `    if (document.activeElement === element) {\n`
    story += `      await expect(element).toHaveFocus()\n`
    story += `    }\n`
  }

  story += `  },\n`
  story += `}\n`

  return story
}

/**
 * Build responsive stories
 */
function buildResponsiveStories(analysis: ComponentAnalysis): string {
  let stories = `/**\n * Mobile viewport\n */\n`
  stories += `export const Mobile: Story = {\n`
  stories += `  parameters: {\n`
  stories += `    viewport: {\n`
  stories += `      defaultViewport: 'mobile1',\n`
  stories += `    },\n`
  stories += `  },\n`
  stories += `}\n\n`
  
  stories += `/**\n * Desktop viewport\n */\n`
  stories += `export const Desktop: Story = {\n`
  stories += `  parameters: {\n`
  stories += `    viewport: {\n`
  stories += `      defaultViewport: 'desktop',\n`
  stories += `    },\n`
  stories += `  },\n`
  stories += `}\n`
  
  return stories
}

/**
 * Build story file path from component path
 */
function buildStoryPath(componentPath: string): string {
  const dir = path.dirname(componentPath)
  const basename = path.basename(componentPath, path.extname(componentPath))
  return path.join(dir, `${basename}.stories.tsx`)
}

/**
 * Write story file to disk
 */
export async function writeStoryFile(
  config: StorybookMCPConfig,
  story: GeneratedStory,
  overwrite: boolean = false
): Promise<boolean> {
  const fullPath = path.join(config.rootDir, story.filePath)
  
  if (fs.existsSync(fullPath) && !overwrite) {
    return false
  }
  
  const dir = path.dirname(fullPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  
  fs.writeFileSync(fullPath, story.content, 'utf-8')
  return true
}
