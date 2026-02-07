/**
 * Storybook MCP Tools
 * Tool implementations for the MCP server
 */

import type { StorybookMCPConfig } from './types.js'
import { scanComponents, analyzeComponent } from './utils/scanner.js'
import { generateStory, writeStoryFile } from './utils/generator.js'
import { validateStory } from './utils/validator.js'
import { getTemplate, getTemplates } from './utils/templates.js'
import { generateTest, writeTestFile } from './utils/test-generator.js'
import { generateDocs, writeDocsFile } from './utils/docs-generator.js'
import { initializeComponents, syncSingleComponent } from './utils/initializer.js'
import { validateLicense, requireFeature } from './utils/license.js'

/**
 * Tool: list_components
 * List all React components in the configured libraries
 */
export async function listComponents(
  config: StorybookMCPConfig,
  args: {
    library?: string
    hasStory?: boolean
  }
) {
  const components = await scanComponents(config, {
    library: args.library,
    hasStory: args.hasStory,
  })

  const withStories = components.filter(c => c.hasStory)
  const withoutStories = components.filter(c => !c.hasStory)

  return {
    components,
    total: components.length,
    withStories: withStories.length,
    withoutStories: withoutStories.length,
    summary: `Found ${components.length} components: ${withStories.length} with stories, ${withoutStories.length} without stories`,
  }
}

/**
 * Tool: analyze_component
 * Analyze a React component to extract its structure
 */
export async function analyzeComponentTool(
  config: StorybookMCPConfig,
  args: {
    componentPath: string
  }
) {
  const analysis = await analyzeComponent(config, args.componentPath)

  return {
    analysis,
    summary: `Analyzed ${analysis.name}: ${analysis.props.length} props, ${analysis.hasStory ? 'has story' : 'no story'}`,
    recommendations: analysis.suggestions,
  }
}

/**
 * Tool: generate_story
 * Generate a Storybook story file for a component
 */
export async function generateStoryTool(
  config: StorybookMCPConfig,
  args: {
    componentPath: string
    includeVariants?: boolean
    includeInteractive?: boolean
    includeA11y?: boolean
    includeResponsive?: boolean
    template?: string
    overwrite?: boolean
    dryRun?: boolean
  }
) {
  // Check license
  const license = validateLicense(config)
  
  // Check template restrictions
  if (args.template && args.template !== 'basic') {
    requireFeature('advanced_templates', license)
  }

  // First analyze the component
  const analysis = await analyzeComponent(config, args.componentPath)

  // Generate the story
  const story = await generateStory(config, analysis, {
    componentPath: args.componentPath,
    includeVariants: args.includeVariants ?? true,
    includeInteractive: args.includeInteractive ?? true,
    includeA11y: args.includeA11y ?? false,
    includeResponsive: args.includeResponsive ?? false,
    template: args.template as any,
    overwrite: args.overwrite ?? false,
  })

  // Write to disk unless dry run
  let written = false
  if (!args.dryRun) {
    written = await writeStoryFile(config, story, args.overwrite)
  }

  return {
    story,
    written,
    path: story.filePath,
    summary: args.dryRun
      ? `Generated story for ${analysis.name} (dry run - not written)`
      : written
        ? `Created story at ${story.filePath}`
        : `Story already exists at ${story.filePath} (use overwrite: true to replace)`,
  }
}

/**
 * Tool: validate_story
 * Validate an existing story file
 */
export async function validateStoryTool(
  config: StorybookMCPConfig,
  args: {
    storyPath: string
  }
) {
  const validation = await validateStory(config, args.storyPath)

  return {
    validation,
    summary: validation.valid
      ? `Story is valid (score: ${validation.score}/100)`
      : `Story has ${validation.errors.length} errors (score: ${validation.score}/100)`,
  }
}

/**
 * Tool: get_story_template
 * Get a template for a specific story type
 */
export async function getStoryTemplate(
  config: StorybookMCPConfig,
  args: {
    template: string
  }
) {
  // Check license
  const license = validateLicense(config)
  if (args.template !== 'basic') {
    requireFeature('advanced_templates', license)
  }

  const template = getTemplate(args.template)

  if (!template) {
    const available = Array.from(getTemplates().keys())
    return {
      error: `Template '${args.template}' not found`,
      availableTemplates: available,
    }
  }

  return {
    template,
    usage: `Replace placeholders: ${template.placeholders.join(', ')}`,
  }
}

/**
 * Tool: list_templates
 * List all available story templates
 */
export async function listTemplates(config: StorybookMCPConfig) {
  // Check license
  const license = validateLicense(config)
  const isPro = license.tier === 'pro'

  // Filter templates based on license
  const templates = getTemplates()
  const list = Array.from(templates.entries())
    .map(([name, template]) => {
      const isBasic = name === 'basic'
      return {
        name,
        description: template.description + (isBasic || isPro ? '' : ' (Pro Only)'),
        useCase: template.useCase,
        available: isBasic || isPro
      }
    })

  return {
    templates: list,
    count: list.length,
    tier: license.tier
  }
}

/**
 * Tool: get_component_coverage
 * Get story coverage statistics for the project
 */
export async function getComponentCoverage(
  config: StorybookMCPConfig,
  args?: {
    library?: string
  }
) {
  const components = await scanComponents(config, {
    library: args?.library,
  })

  const withStories = components.filter(c => c.hasStory)
  const withoutStories = components.filter(c => !c.hasStory)
  const coverage = components.length > 0
    ? Math.round((withStories.length / components.length) * 100)
    : 0

  // Group by library
  const byLibrary: Record<string, { total: number; withStories: number }> = {}
  for (const lib of config.libraries) {
    const libComponents = components.filter(c => c.library === lib.name)
    const libWithStories = libComponents.filter(c => c.hasStory)
    byLibrary[lib.name] = {
      total: libComponents.length,
      withStories: libWithStories.length,
    }
  }

  return {
    total: components.length,
    withStories: withStories.length,
    withoutStories: withoutStories.length,
    coverage: `${coverage}%`,
    byLibrary,
    componentsNeedingStories: withoutStories.map(c => ({
      name: c.name,
      path: c.filePath,
      library: c.library,
    })),
  }
}

/**
 * Tool: suggest_stories
 * Get suggestions for which components need stories
 */
export async function suggestStories(
  config: StorybookMCPConfig,
  args?: {
    limit?: number
    library?: string
  }
) {
  const components = await scanComponents(config, {
    library: args?.library,
    hasStory: false,
  })

  const limit = args?.limit ?? 10
  const suggestions = components.slice(0, limit)

  return {
    suggestions: suggestions.map(c => ({
      component: c.name,
      path: c.filePath,
      library: c.library,
      command: `generate_story with componentPath: "${c.filePath}"`,
    })),
    total: components.length,
    showing: suggestions.length,
    summary: `${components.length} components without stories. Showing top ${suggestions.length}.`,
  }
}

/**
 * Tool: sync_all
 * Sync all components - create missing stories/tests/docs, update changed ones
 */
export async function syncAll(
  config: StorybookMCPConfig,
  args?: {
    library?: string
    generateStories?: boolean
    generateTests?: boolean
    generateDocs?: boolean
    updateExisting?: boolean
    dryRun?: boolean
  }
) {
  // Check license for limits
  const license = validateLicense(config)
  
  // If requesting features not allowed in free tier, warn/disable them
  const options = {
    library: args?.library,
    generateStories: args?.generateStories ?? true,
    generateTests: args?.generateTests ?? true,
    generateDocs: args?.generateDocs ?? true,
    updateExisting: args?.updateExisting ?? true,
    dryRun: args?.dryRun ?? false,
  }

  // Force disable Pro features if no license
  if (license.tier === 'free') {
    if (options.generateTests) {
      console.error('[storybook-mcp] Warning: Test generation disabled (Free Tier)')
      options.generateTests = false
    }
    if (options.generateDocs) {
      console.error('[storybook-mcp] Warning: Docs generation disabled (Free Tier)')
      options.generateDocs = false
    }
  }

  const result = await initializeComponents(config, options)

  // Apply sync limit for free tier
  if (license.tier === 'free' && result.scanned > license.maxSyncLimit) {
    return {
      ...result,
      summary: `Free Tier Limit: Synced first ${license.maxSyncLimit} components only. Upgrade to Pro for unlimited sync.`,
      warning: 'Sync limit reached (5 components max for Free Tier)'
    }
  }

  return {
    ...result,
    summary: args?.dryRun
      ? `Dry run: Would create ${result.created.stories + result.created.tests + result.created.docs} files, update ${result.updated.stories + result.updated.tests + result.updated.docs} files`
      : `Synced ${result.scanned} components: Created ${result.created.stories} stories, ${result.created.tests} tests, ${result.created.docs} docs. Updated ${result.updated.stories + result.updated.tests + result.updated.docs} files.`,
  }
}

/**
 * Tool: sync_component
 * Sync a single component - create or update its story/test/docs
 */
export async function syncComponentTool(
  config: StorybookMCPConfig,
  args: {
    componentPath: string
    generateStories?: boolean
    generateTests?: boolean
    generateDocs?: boolean
    dryRun?: boolean
  }
) {
  const result = await syncSingleComponent(config, args.componentPath, {
    generateStories: args.generateStories ?? true,
    generateTests: args.generateTests ?? true,
    generateDocs: args.generateDocs ?? true,
    dryRun: args.dryRun ?? false,
  })

  const actions = [
    result.story.action !== 'skipped' ? `story: ${result.story.action}` : null,
    result.test.action !== 'skipped' ? `test: ${result.test.action}` : null,
    result.docs.action !== 'skipped' ? `docs: ${result.docs.action}` : null,
  ].filter(Boolean)

  return {
    result,
    summary: `${result.component}: ${actions.join(', ')}`,
  }
}

/**
 * Tool: generate_test
 * Generate a test file for a component
 */
export async function generateTestTool(
  config: StorybookMCPConfig,
  args: {
    componentPath: string
    overwrite?: boolean
    dryRun?: boolean
  }
) {
  // Check license
  const license = validateLicense(config)
  requireFeature('test_generation', license)

  const analysis = await analyzeComponent(config, args.componentPath)
  const test = await generateTest(config, analysis)

  let written = false
  if (!args.dryRun) {
    written = await writeTestFile(config, test, args.overwrite)
  }

  return {
    test,
    written,
    path: test.filePath,
    summary: args.dryRun
      ? `Generated test for ${analysis.name} (dry run)`
      : written
        ? `Created test at ${test.filePath}`
        : `Test already exists at ${test.filePath}`,
  }
}

/**
 * Tool: generate_docs
 * Generate MDX documentation for a component
 */
export async function generateDocsTool(
  config: StorybookMCPConfig,
  args: {
    componentPath: string
    overwrite?: boolean
    dryRun?: boolean
  }
) {
  // Check license
  const license = validateLicense(config)
  requireFeature('docs_generation', license)

  const analysis = await analyzeComponent(config, args.componentPath)
  const docs = await generateDocs(config, analysis)

  let written = false
  if (!args.dryRun) {
    written = await writeDocsFile(config, docs, args.overwrite)
  }

  return {
    docs,
    written,
    path: docs.filePath,
    summary: args.dryRun
      ? `Generated docs for ${analysis.name} (dry run)`
      : written
        ? `Created docs at ${docs.filePath}`
        : `Docs already exist at ${docs.filePath}`,
  }
}
