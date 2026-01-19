/**
 * Component Scanner
 * Scans project directories to find React components and their stories
 */

import fs from 'node:fs'
import path from 'node:path'
import fg from 'fast-glob'
import type {
  StorybookMCPConfig,
  ComponentInfo,
  ComponentAnalysis,
  PropDefinition,
  DependencyInfo,
} from './types.js'

/**
 * Scan for all components in configured libraries
 */
export async function scanComponents(
  config: StorybookMCPConfig,
  options?: {
    library?: string
    hasStory?: boolean
  }
): Promise<ComponentInfo[]> {
  const components: ComponentInfo[] = []

  for (const lib of config.libraries) {
    // Skip if filtering by library and this isn't it
    if (options?.library && options.library !== 'all' && options.library !== lib.name) {
      continue
    }

    const libPath = path.join(config.rootDir, lib.path)
    
    if (!fs.existsSync(libPath)) {
      continue
    }

    // Find all component files
    const componentFiles = await fg(config.componentPatterns, {
      cwd: libPath,
      ignore: config.excludePatterns,
      absolute: false,
    })

    for (const file of componentFiles) {
      const fullPath = path.join(lib.path, file)
      const componentName = extractComponentName(file)
      
      if (!componentName) continue

      // Check for story file
      const storyPath = findStoryFile(config.rootDir, fullPath)
      const hasStory = storyPath !== null

      // Apply hasStory filter
      if (options?.hasStory !== undefined && options.hasStory !== hasStory) {
        continue
      }

      components.push({
        name: componentName,
        filePath: fullPath,
        library: lib.name,
        hasStory,
        storyPath: storyPath ?? undefined,
        exportType: await detectExportType(path.join(config.rootDir, fullPath)),
      })
    }
  }

  return components.sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Analyze a component to extract props, dependencies, etc.
 */
export async function analyzeComponent(
  config: StorybookMCPConfig,
  componentPath: string
): Promise<ComponentAnalysis> {
  const fullPath = path.join(config.rootDir, componentPath)
  
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Component not found: ${componentPath}`)
  }

  const source = fs.readFileSync(fullPath, 'utf-8')
  const componentName = extractComponentName(componentPath) || 'Unknown'
  const library = findLibraryForPath(config, componentPath)
  const storyPath = findStoryFile(config.rootDir, componentPath)

  // Extract information
  const props = extractProps(source, componentName)
  const dependencies = analyzeDependencies(source)
  const suggestions = generateSuggestions(props, dependencies, !!storyPath)
  const exportType = await detectExportType(fullPath)

  return {
    name: componentName,
    filePath: componentPath,
    library: library?.name || 'unknown',
    hasStory: storyPath !== null,
    storyPath: storyPath ?? undefined,
    exportType,
    props,
    dependencies,
    suggestions,
    sourcePreview: source.slice(0, 1000) + (source.length > 1000 ? '\n// ...' : ''),
  }
}

/**
 * Extract component name from file path
 */
function extractComponentName(filePath: string): string | null {
  const basename = path.basename(filePath, path.extname(filePath))
  
  // Skip index files, look at parent directory
  if (basename === 'index') {
    const parentDir = path.basename(path.dirname(filePath))
    return toPascalCase(parentDir)
  }
  
  // Skip common non-component files
  if (['types', 'utils', 'hooks', 'constants', 'styles'].includes(basename.toLowerCase())) {
    return null
  }
  
  return toPascalCase(basename)
}

/**
 * Find story file for a component
 */
function findStoryFile(rootDir: string, componentPath: string): string | null {
  const dir = path.dirname(componentPath)
  const basename = path.basename(componentPath, path.extname(componentPath))
  
  const possiblePaths = [
    path.join(dir, `${basename}.stories.tsx`),
    path.join(dir, `${basename}.stories.ts`),
    path.join(dir, 'stories', `${basename}.stories.tsx`),
    path.join(dir, '__stories__', `${basename}.stories.tsx`),
  ]
  
  for (const storyPath of possiblePaths) {
    const fullPath = path.join(rootDir, storyPath)
    if (fs.existsSync(fullPath)) {
      return storyPath
    }
  }
  
  return null
}

/**
 * Find which library a component belongs to
 */
function findLibraryForPath(
  config: StorybookMCPConfig,
  componentPath: string
): StorybookMCPConfig['libraries'][0] | undefined {
  return config.libraries.find(lib => componentPath.startsWith(lib.path))
}

/**
 * Detect if component uses default or named export
 */
async function detectExportType(filePath: string): Promise<'default' | 'named'> {
  try {
    const source = fs.readFileSync(filePath, 'utf-8')
    
    if (source.includes('export default')) {
      return 'default'
    }
    
    return 'named'
  } catch {
    return 'named'
  }
}

/**
 * Extract props from component source
 */
function extractProps(source: string, componentName: string): PropDefinition[] {
  const props: PropDefinition[] = []
  
  // Look for interface/type definition
  const propsPattern = new RegExp(
    `(?:interface|type)\\s+${componentName}Props\\s*(?:extends[^{]+)?\\{([^}]+)\\}`,
    's'
  )
  
  const match = source.match(propsPattern)
  if (!match) return props

  const propsBlock = match[1]
  
  // Parse each prop
  const propLines = propsBlock.split('\n').filter(line => line.trim())
  
  for (const line of propLines) {
    const propMatch = line.match(
      /^\s*\/\*\*([^*]*)\*\/\s*(\w+)(\?)?:\s*(.+?)(?:;|$)/s
    ) || line.match(
      /^\s*(\w+)(\?)?:\s*(.+?)(?:;|$)/
    )
    
    if (propMatch) {
      const hasJsDoc = propMatch.length === 5
      const description = hasJsDoc ? propMatch[1].trim() : undefined
      const name = hasJsDoc ? propMatch[2] : propMatch[1]
      const optional = hasJsDoc ? propMatch[3] === '?' : propMatch[2] === '?'
      const type = hasJsDoc ? propMatch[4].trim() : propMatch[3].trim()
      
      props.push({
        name,
        type,
        required: !optional,
        description,
        ...inferControlType(type),
      })
    }
  }
  
  return props
}

/**
 * Infer Storybook control type from TypeScript type
 */
function inferControlType(type: string): Partial<PropDefinition> {
  // Boolean
  if (type === 'boolean') {
    return { controlType: 'boolean' }
  }
  
  // Number
  if (type === 'number') {
    return { controlType: 'number' }
  }
  
  // String
  if (type === 'string') {
    return { controlType: 'text' }
  }
  
  // Union of string literals
  const unionMatch = type.match(/^["']([^"']+)["'](?:\s*\|\s*["']([^"']+)["'])+$|^['"](.+?)['"](?:\s*\|\s*['"](.+?)['"])*$/)
  if (unionMatch || type.includes("'") && type.includes('|')) {
    const options = type
      .split('|')
      .map(s => s.trim().replace(/['"]/g, ''))
      .filter(Boolean)
    
    return {
      controlType: options.length <= 4 ? 'radio' : 'select',
      controlOptions: options,
    }
  }
  
  // Color-like props
  if (type.toLowerCase().includes('color') || type.includes('Color')) {
    return { controlType: 'color' }
  }
  
  // Date
  if (type === 'Date' || type.includes('Date')) {
    return { controlType: 'date' }
  }
  
  // Object/complex
  if (type.startsWith('{') || type.includes('Record') || type.includes('Object')) {
    return { controlType: 'object' }
  }
  
  return {}
}

/**
 * Analyze component dependencies
 */
function analyzeDependencies(source: string): DependencyInfo {
  return {
    usesRouter: /from ['"]react-router|from ['"]@tanstack\/react-router|from ['"]next\/navigation/.test(source),
    usesReactQuery: /from ['"]@tanstack\/react-query|from ['"]react-query/.test(source),
    usesChakra: /from ['"]@chakra-ui/.test(source),
    usesEmotion: /from ['"]@emotion/.test(source),
    usesTailwind: /className=.*['"](.*?(flex|grid|p-|m-|bg-|text-).*?)['"]/.test(source),
    usesFramerMotion: /from ['"]framer-motion/.test(source),
    usesMSW: /from ['"]msw/.test(source),
    usesGlobalState: /from ['"]zustand|from ['"]@reduxjs|from ['"]recoil|from ['"]jotai/.test(source),
    otherImports: extractNotableImports(source),
  }
}

/**
 * Extract notable imports for context
 */
function extractNotableImports(source: string): string[] {
  const imports: string[] = []
  const importRegex = /from ['"]([^'"]+)['"]/g
  let match
  
  while ((match = importRegex.exec(source)) !== null) {
    const pkg = match[1]
    // Skip relative imports and common packages
    if (!pkg.startsWith('.') && !pkg.startsWith('@types') && 
        !['react', 'react-dom'].includes(pkg)) {
      imports.push(pkg)
    }
  }
  
  return [...new Set(imports)].slice(0, 10) // Limit to 10
}

/**
 * Generate suggestions for story creation
 */
function generateSuggestions(
  props: PropDefinition[],
  deps: DependencyInfo,
  hasStory: boolean
): string[] {
  const suggestions: string[] = []
  
  if (hasStory) {
    suggestions.push('Story already exists - consider adding more variants or interaction tests')
  } else {
    suggestions.push('No story found - create one to document this component')
  }
  
  // Props-based suggestions
  const variantProps = props.filter(p => 
    ['variant', 'size', 'color', 'colorScheme'].includes(p.name)
  )
  if (variantProps.length > 0) {
    suggestions.push(`Add variant stories for: ${variantProps.map(p => p.name).join(', ')}`)
  }
  
  // Dependency-based suggestions
  if (deps.usesRouter) {
    suggestions.push('Component uses routing - wrap stories with router decorator')
  }
  
  if (deps.usesReactQuery) {
    suggestions.push('Component uses React Query - wrap stories with QueryClientProvider')
  }
  
  if (deps.usesChakra) {
    suggestions.push('Component uses Chakra UI - ensure ChakraProvider is in decorators')
  }
  
  if (deps.usesGlobalState) {
    suggestions.push('Component uses global state - mock or provide store in stories')
  }
  
  // Interactive suggestions
  const interactiveProps = props.filter(p => 
    p.name.startsWith('on') && p.type.includes('=>')
  )
  if (interactiveProps.length > 0) {
    suggestions.push(`Add interaction tests for: ${interactiveProps.map(p => p.name).join(', ')}`)
  }
  
  return suggestions
}

/**
 * Convert string to PascalCase
 */
function toPascalCase(str: string): string {
  return str
    .replace(/[-_](.)/g, (_, c) => c.toUpperCase())
    .replace(/^(.)/, (_, c) => c.toUpperCase())
}

/**
 * Convert string to kebab-case
 */
export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase()
}
