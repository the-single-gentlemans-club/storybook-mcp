/**
 * Storybook MCP Tools
 * Tool implementations for the MCP server
 */

import fs from 'node:fs'
import path from 'node:path'
import type { StorybookMCPConfig, StoryGenerationOptions } from './types.js'
import { scanComponents, analyzeComponent } from './utils/scanner.js'
import { generateStory, writeStoryFile } from './utils/generator.js'
import { validateStory, validateGeneratedStory } from './utils/validator.js'
import { getTemplate, getTemplates } from './utils/templates.js'
import { generateTest, writeTestFile } from './utils/test-generator.js'
import { generateDocs, writeDocsFile } from './utils/docs-generator.js'
import {
  initializeComponents,
  syncSingleComponent
} from './utils/initializer.js'
import { validateLicense, requireFeature } from './utils/license.js'
import { runPreflight } from './utils/preflight.js'
import { mergeStories, parseStoryExports } from './utils/story-merger.js'
import { recordStoryVersion, hashContent } from './utils/story-history.js'
import { generateCodeConnect, writeCodeConnectFile } from './utils/code-connect-generator.js'

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
    hasStory: args.hasStory
  })

  const withStories = components.filter(c => c.hasStory)
  const withoutStories = components.filter(c => !c.hasStory)

  return {
    components,
    total: components.length,
    withStories: withStories.length,
    withoutStories: withoutStories.length,
    summary: `Found ${components.length} components: ${withStories.length} with stories, ${withoutStories.length} without stories`
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
    recommendations: analysis.suggestions
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

  // Prepare story generation options with proper typing
  const storyOptions: StoryGenerationOptions = {
    componentPath: args.componentPath,
    includeVariants: args.includeVariants ?? true,
    includeInteractive: args.includeInteractive ?? true,
    includeA11y: args.includeA11y ?? false,
    includeResponsive: args.includeResponsive ?? false,
    overwrite: args.overwrite ?? false
  }

  // Add template if provided (already validated for license)
  if (args.template) {
    storyOptions.template = args.template as StoryGenerationOptions['template']
  }

  // Generate the story
  const story = await generateStory(config, analysis, storyOptions)

  // Pre-write import validation (non-blocking)
  const importValidation = validateGeneratedStory(config, story.content, args.componentPath)

  // Write to disk unless dry run
  let written = false
  if (!args.dryRun) {
    written = await writeStoryFile(config, story, args.overwrite)
    if (written) {
      const storyFullPath = path.join(config.rootDir, story.filePath)
      recordStoryVersion(config.rootDir, {
        storyPath: story.filePath,
        componentPath: args.componentPath,
        generatedAt: new Date().toISOString(),
        storyHash: hashContent(fs.existsSync(storyFullPath) ? fs.readFileSync(storyFullPath, 'utf-8') : story.content),
        action: 'created',
      })
    }
  }

  return {
    story,
    written,
    path: story.filePath,
    validation: importValidation,
    summary: args.dryRun
      ? `Generated story for ${analysis.name} (dry run - not written)`
      : written
        ? `Created story at ${story.filePath}`
        : `Story already exists at ${story.filePath} (use overwrite: true to replace)`
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
      : `Story has ${validation.errors.length} errors (score: ${validation.score}/100)`
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
      availableTemplates: available
    }
  }

  return {
    template,
    usage: `Replace placeholders: ${template.placeholders.join(', ')}`
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
  const list = Array.from(templates.entries()).map(([name, template]) => {
    const isBasic = name === 'basic'
    return {
      name,
      description:
        template.description + (isBasic || isPro ? '' : ' (Pro Only)'),
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
    library: args?.library
  })

  const withStories = components.filter(c => c.hasStory)
  const withoutStories = components.filter(c => !c.hasStory)
  const coverage =
    components.length > 0
      ? Math.round((withStories.length / components.length) * 100)
      : 0

  // Group by library
  const byLibrary: Record<string, { total: number; withStories: number }> = {}
  for (const lib of config.libraries) {
    const libComponents = components.filter(c => c.library === lib.name)
    const libWithStories = libComponents.filter(c => c.hasStory)
    byLibrary[lib.name] = {
      total: libComponents.length,
      withStories: libWithStories.length
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
      library: c.library
    }))
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
    hasStory: false
  })

  const limit = args?.limit ?? 10
  const suggestions = components.slice(0, limit)

  return {
    suggestions: suggestions.map(c => ({
      component: c.name,
      path: c.filePath,
      library: c.library,
      command: `generate_story with componentPath: "${c.filePath}"`
    })),
    total: components.length,
    showing: suggestions.length,
    summary: `${components.length} components without stories. Showing top ${suggestions.length}.`
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
    dryRun: args?.dryRun ?? false
  }

  // Force disable Pro features if no license
  if (license.tier === 'free') {
    if (typeof globalThis !== 'undefined' && options.generateTests) {
      // eslint-disable-next-line no-console
      globalThis.console?.warn?.(
        '[storybook-mcp] Warning: Test generation disabled (Free Tier)'
      )
      options.generateTests = false
    }
    if (typeof globalThis !== 'undefined' && options.generateDocs) {
      // eslint-disable-next-line no-console
      console.warn(
        '[storybook-mcp] Warning: Docs generation disabled (Free Tier)'
      )
      options.generateDocs = false
    }
  }

  const result = await initializeComponents(config, {
    ...options,
    maxComponents:
      license.maxSyncLimit === Infinity ? undefined : license.maxSyncLimit
  })

  // Notify if sync limit was applied
  if (
    license.tier === 'free' &&
    result.scanned > (license.maxSyncLimit || Infinity)
  ) {
    return {
      ...result,
      summary: `Free Tier Limit: Synced first ${license.maxSyncLimit} of ${result.scanned} components. Upgrade to Pro for unlimited sync.`,
      warning: `Sync limit reached (${license.maxSyncLimit} components max for Free Tier)`
    }
  }

  return {
    ...result,
    summary: args?.dryRun
      ? `Dry run: Would create ${result.created.stories + result.created.tests + result.created.docs} files, update ${result.updated.stories + result.updated.tests + result.updated.docs} files`
      : `Synced ${result.scanned} components: Created ${result.created.stories} stories, ${result.created.tests} tests, ${result.created.docs} docs. Updated ${result.updated.stories + result.updated.tests + result.updated.docs} files.`
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
    dryRun: args.dryRun ?? false
  })

  const actions = [
    result.story.action !== 'skipped' ? `story: ${result.story.action}` : null,
    result.test.action !== 'skipped' ? `test: ${result.test.action}` : null,
    result.docs.action !== 'skipped' ? `docs: ${result.docs.action}` : null
  ].filter(Boolean)

  return {
    result,
    summary: `${result.component}: ${actions.join(', ')}`
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
        : `Test already exists at ${test.filePath}`
  }
}

/**
 * Tool: check_health
 * Check Storybook installation health
 */
export async function checkHealthTool(config: StorybookMCPConfig) {
  const result = await runPreflight(config.rootDir)
  return {
    ...result,
    summary: result.summary
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
        : `Docs already exist at ${docs.filePath}`
  }
}

/**
 * Tool: update_story
 * Update an existing story — regenerates template sections while preserving user-added exports.
 * Pro tier only.
 */
export async function updateStoryTool(
  config: StorybookMCPConfig,
  args: {
    componentPath: string
    includeVariants?: boolean
    includeInteractive?: boolean
    includeA11y?: boolean
    includeResponsive?: boolean
    template?: string
    dryRun?: boolean
  }
) {
  // Pro only
  const license = validateLicense(config)
  requireFeature('advanced_templates', license)

  // Analyze component
  const analysis = await analyzeComponent(config, args.componentPath)

  // Build generation options
  const storyOptions: StoryGenerationOptions = {
    componentPath: args.componentPath,
    includeVariants: args.includeVariants ?? true,
    includeInteractive: args.includeInteractive ?? true,
    includeA11y: args.includeA11y ?? false,
    includeResponsive: args.includeResponsive ?? false,
    overwrite: true,
  }
  if (args.template) {
    storyOptions.template = args.template as StoryGenerationOptions['template']
  }

  // Generate fresh story
  const story = await generateStory(config, analysis, storyOptions)

  // Check if an existing story is on disk
  const storyFullPath = path.join(config.rootDir, story.filePath)
  const existingContent = fs.existsSync(storyFullPath)
    ? fs.readFileSync(storyFullPath, 'utf-8')
    : null

  // Merge: preserve user-added stories from existing file
  let finalContent = story.content
  let preserved: string[] = []
  let removed: string[] = []

  if (existingContent) {
    const generatedExports = parseStoryExports(story.content)
    const merged = mergeStories(story.content, existingContent, generatedExports)
    finalContent = merged.content
    preserved = merged.preserved
    removed = merged.removed
  }

  // Pre-write import validation (non-blocking)
  const importValidation = validateGeneratedStory(config, finalContent, args.componentPath)

  // Write merged content
  let written = false
  if (!args.dryRun) {
    const dir = path.dirname(storyFullPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(storyFullPath, finalContent, 'utf-8')
    written = true

    recordStoryVersion(config.rootDir, {
      storyPath: story.filePath,
      componentPath: args.componentPath,
      generatedAt: new Date().toISOString(),
      storyHash: hashContent(finalContent),
      action: existingContent ? 'merged' : 'created',
    })
  }

  return {
    story: { ...story, content: finalContent },
    preserved,
    removed,
    written,
    path: story.filePath,
    validation: importValidation,
    summary: args.dryRun
      ? `Updated story for ${analysis.name} (dry run — not written)${preserved.length > 0 ? `, would preserve: ${preserved.join(', ')}` : ''}`
      : written
        ? `Updated story at ${story.filePath}${preserved.length > 0 ? `. Preserved user stories: ${preserved.join(', ')}` : ''}`
        : `Failed to write story at ${story.filePath}`,
  }
}

/**
 * Tool: generate_code_connect
 * Generate a @figma/code-connect .figma.tsx file linking the component to Figma dev mode.
 * Pro tier only.
 */
export async function generateCodeConnectTool(
  config: StorybookMCPConfig,
  args: {
    componentPath: string
    figmaNodeUrl?: string
    overwrite?: boolean
    dryRun?: boolean
  }
) {
  const license = validateLicense(config)
  requireFeature('code_connect', license)

  const analysis = await analyzeComponent(config, args.componentPath)
  const cc = await generateCodeConnect(config, analysis, args.figmaNodeUrl)

  let written = false
  if (!args.dryRun) {
    written = await writeCodeConnectFile(config, cc, args.overwrite)
  }

  return {
    codeConnect: cc,
    written,
    path: cc.filePath,
    hasPlaceholderUrl: !args.figmaNodeUrl,
    summary: args.dryRun
      ? `Generated Code Connect for ${analysis.name} (dry run — not written)`
      : written
        ? `Created ${cc.filePath}${!args.figmaNodeUrl ? ' — replace FIGMA_NODE_URL_HERE with your Figma component URL' : ''}`
        : `Code Connect file already exists at ${cc.filePath} (use overwrite: true to replace)`,
  }
}
