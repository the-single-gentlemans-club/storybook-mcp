/**
 * Initialization & Sync
 * Auto-generates missing stories, tests, and docs on startup
 * Updates existing files when component changes are detected
 */

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import type {
  StorybookMCPConfig,
  ComponentInfo,
  ComponentAnalysis,
} from '../types.js'
import { scanComponents, analyzeComponent } from './scanner.js'
import { POLAR_UPGRADE_URL } from './constants.js'
import { generateStory, writeStoryFile } from './generator.js'
import { generateTest, writeTestFile } from './test-generator.js'
import { generateDocs, writeDocsFile } from './docs-generator.js'

// ===========================================
// Types
// ===========================================

export interface SyncResult {
  component: string
  path: string
  story: FileAction
  test: FileAction
  docs: FileAction
}

export interface FileAction {
  action: 'created' | 'updated' | 'skipped' | 'unchanged'
  path?: string
  reason?: string
}

export interface InitOptions {
  /** Generate stories for components without them */
  generateStories?: boolean
  /** Generate test files for components without them */
  generateTests?: boolean
  /** Generate MDX docs for components without them */
  generateDocs?: boolean
  /** Update existing files if component has changed */
  updateExisting?: boolean
  /** Dry run - report what would be done without writing */
  dryRun?: boolean
  /** Filter to specific library */
  library?: string
  /** Only process components matching this pattern */
  filter?: string
  /** Max components to process (license limit) */
  maxComponents?: number
}

export interface InitResult {
  scanned: number
  created: {
    stories: number
    tests: number
    docs: number
  }
  updated: {
    stories: number
    tests: number
    docs: number
  }
  skipped: number
  errors: Array<{ component: string; error: string }>
  details: SyncResult[]
}

// ===========================================
// Hash Cache for Change Detection
// ===========================================

const CACHE_FILE = '.storybook-mcp-cache.json'

interface HashCache {
  version: string
  components: Record<string, {
    hash: string
    storyHash?: string
    testHash?: string
    docsHash?: string
    lastSync: string
  }>
}

function loadCache(rootDir: string): HashCache {
  const cachePath = path.join(rootDir, CACHE_FILE)
  try {
    if (fs.existsSync(cachePath)) {
      return JSON.parse(fs.readFileSync(cachePath, 'utf-8'))
    }
  } catch {
    // Ignore cache errors
  }
  return { version: '1', components: {} }
}

function saveCache(rootDir: string, cache: HashCache): void {
  const cachePath = path.join(rootDir, CACHE_FILE)
  try {
    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2))
  } catch {
    // Ignore cache write errors
  }
}

function hashFile(filePath: string): string {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    return crypto.createHash('md5').update(content).digest('hex')
  } catch {
    return ''
  }
}

// ===========================================
// File Path Helpers
// ===========================================

function getStoryPath(componentPath: string): string {
  const dir = path.dirname(componentPath)
  const basename = path.basename(componentPath, path.extname(componentPath))
  return path.join(dir, `${basename}.stories.tsx`)
}

function getTestPath(componentPath: string): string {
  const dir = path.dirname(componentPath)
  const basename = path.basename(componentPath, path.extname(componentPath))
  return path.join(dir, `${basename}.test.tsx`)
}

function getDocsPath(componentPath: string): string {
  const dir = path.dirname(componentPath)
  const basename = path.basename(componentPath, path.extname(componentPath))
  return path.join(dir, `${basename}.mdx`)
}

function fileExists(rootDir: string, relativePath: string): boolean {
  return fs.existsSync(path.join(rootDir, relativePath))
}

// ===========================================
// Main Initialization Function
// ===========================================

/**
 * Initialize/sync all components on startup
 */
export async function initializeComponents(
  config: StorybookMCPConfig,
  options: InitOptions = {}
): Promise<InitResult> {
  const {
    generateStories = true,
    generateTests = true,
    generateDocs = true,
    updateExisting = true,
    dryRun = false,
    library,
    filter,
    maxComponents,
  } = options

  const result: InitResult = {
    scanned: 0,
    created: { stories: 0, tests: 0, docs: 0 },
    updated: { stories: 0, tests: 0, docs: 0 },
    skipped: 0,
    errors: [],
    details: [],
  }

  // Load cache for change detection
  const cache = loadCache(config.rootDir)
  const newCache: HashCache = { version: '1', components: {} }

  // Scan all components
  let components = await scanComponents(config, { library })
  result.scanned = components.length

  // Apply license limit
  let limitApplied = false
  if (maxComponents && maxComponents < components.length) {
    components = components.slice(0, maxComponents)
    limitApplied = true
  }

  console.error(`[storybook-mcp] Scanning ${components.length} components...${limitApplied ? ` (limited from ${result.scanned})` : ''}`)

  for (const component of components) {
    // Apply filter if specified
    if (filter && !component.name.toLowerCase().includes(filter.toLowerCase())) {
      result.skipped++
      continue
    }

    try {
      const syncResult = await syncComponent(
        config,
        component,
        cache,
        newCache,
        {
          generateStories,
          generateTests,
          generateDocs,
          updateExisting,
          dryRun,
        }
      )

      result.details.push(syncResult)

      // Count actions
      if (syncResult.story.action === 'created') result.created.stories++
      if (syncResult.story.action === 'updated') result.updated.stories++
      if (syncResult.test.action === 'created') result.created.tests++
      if (syncResult.test.action === 'updated') result.updated.tests++
      if (syncResult.docs.action === 'created') result.created.docs++
      if (syncResult.docs.action === 'updated') result.updated.docs++

    } catch (error) {
      result.errors.push({
        component: component.name,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // Save updated cache
  if (!dryRun) {
    saveCache(config.rootDir, newCache)
  }

  // Log summary
  const totalCreated = result.created.stories + result.created.tests + result.created.docs
  const totalUpdated = result.updated.stories + result.updated.tests + result.updated.docs
  
  console.error(`[storybook-mcp] Sync complete:`)
  console.error(`  Scanned: ${result.scanned} components`)
  console.error(`  Created: ${totalCreated} files (${result.created.stories} stories, ${result.created.tests} tests, ${result.created.docs} docs)`)
  console.error(`  Updated: ${totalUpdated} files`)
  console.error(`  Skipped: ${result.skipped}`)
  if (result.errors.length > 0) {
    console.error(`  Errors: ${result.errors.length}`)
  }
  if (limitApplied && maxComponents) {
    console.error(`\n⚠️  Free tier limit: Only ${maxComponents} components processed.`)
    console.error(`   Upgrade to Pro for unlimited: ${POLAR_UPGRADE_URL}`)
  }

  return result
}

/**
 * Sync a single component
 */
async function syncComponent(
  config: StorybookMCPConfig,
  component: ComponentInfo,
  oldCache: HashCache,
  newCache: HashCache,
  options: {
    generateStories: boolean
    generateTests: boolean
    generateDocs: boolean
    updateExisting: boolean
    dryRun: boolean
  }
): Promise<SyncResult> {
  const { generateStories: shouldGenStories, generateTests: shouldGenTests, generateDocs: shouldGenDocs, updateExisting, dryRun } = options
  
  const componentFullPath = path.join(config.rootDir, component.filePath)
  const componentHash = hashFile(componentFullPath)
  const cachedComponent = oldCache.components[component.filePath]
  const componentChanged = !cachedComponent || cachedComponent.hash !== componentHash

  const result: SyncResult = {
    component: component.name,
    path: component.filePath,
    story: { action: 'skipped' },
    test: { action: 'skipped' },
    docs: { action: 'skipped' },
  }

  // Update cache entry
  newCache.components[component.filePath] = {
    hash: componentHash,
    lastSync: new Date().toISOString(),
  }

  // Analyze component for generation
  let analysis: ComponentAnalysis | null = null
  const getAnalysis = async () => {
    if (!analysis) {
      analysis = await analyzeComponent(config, component.filePath)
    }
    return analysis
  }

  // --- Stories ---
  if (shouldGenStories) {
    const storyPath = getStoryPath(component.filePath)
    const storyExists = fileExists(config.rootDir, storyPath)

    if (!storyExists) {
      // Create new story
      const componentAnalysis = await getAnalysis()
      const story = await generateStory(config, componentAnalysis, {
        componentPath: component.filePath,
        includeVariants: true,
        includeInteractive: true,
      })

      if (!dryRun) {
        await writeStoryFile(config, story, true)
      }

      result.story = { action: 'created', path: storyPath }
      newCache.components[component.filePath].storyHash = hashFile(path.join(config.rootDir, storyPath))

    } else if (updateExisting && componentChanged) {
      // Update existing story if component changed
      const componentAnalysis = await getAnalysis()
      const story = await generateStory(config, componentAnalysis, {
        componentPath: component.filePath,
        includeVariants: true,
        includeInteractive: true,
        overwrite: true,
      })

      if (!dryRun) {
        await writeStoryFile(config, story, true)
      }

      result.story = { action: 'updated', path: storyPath, reason: 'component changed' }
      newCache.components[component.filePath].storyHash = hashFile(path.join(config.rootDir, storyPath))

    } else {
      result.story = { action: 'unchanged', path: storyPath }
      newCache.components[component.filePath].storyHash = cachedComponent?.storyHash
    }
  }

  // --- Tests ---
  if (shouldGenTests) {
    const testPath = getTestPath(component.filePath)
    const testExists = fileExists(config.rootDir, testPath)

    if (!testExists) {
      const componentAnalysis = await getAnalysis()
      const test = await generateTest(config, componentAnalysis)

      if (!dryRun) {
        await writeTestFile(config, test)
      }

      result.test = { action: 'created', path: testPath }
      newCache.components[component.filePath].testHash = hashFile(path.join(config.rootDir, testPath))

    } else if (updateExisting && componentChanged) {
      const componentAnalysis = await getAnalysis()
      const test = await generateTest(config, componentAnalysis)

      if (!dryRun) {
        await writeTestFile(config, test, true)
      }

      result.test = { action: 'updated', path: testPath, reason: 'component changed' }
      newCache.components[component.filePath].testHash = hashFile(path.join(config.rootDir, testPath))

    } else {
      result.test = { action: 'unchanged', path: testPath }
      newCache.components[component.filePath].testHash = cachedComponent?.testHash
    }
  }

  // --- Docs ---
  if (shouldGenDocs) {
    const docsPath = getDocsPath(component.filePath)
    const docsExists = fileExists(config.rootDir, docsPath)

    if (!docsExists) {
      const componentAnalysis = await getAnalysis()
      const docs = await generateDocs(config, componentAnalysis)

      if (!dryRun) {
        await writeDocsFile(config, docs)
      }

      result.docs = { action: 'created', path: docsPath }
      newCache.components[component.filePath].docsHash = hashFile(path.join(config.rootDir, docsPath))

    } else if (updateExisting && componentChanged) {
      const componentAnalysis = await getAnalysis()
      const docs = await generateDocs(config, componentAnalysis)

      if (!dryRun) {
        await writeDocsFile(config, docs, true)
      }

      result.docs = { action: 'updated', path: docsPath, reason: 'component changed' }
      newCache.components[component.filePath].docsHash = hashFile(path.join(config.rootDir, docsPath))

    } else {
      result.docs = { action: 'unchanged', path: docsPath }
      newCache.components[component.filePath].docsHash = cachedComponent?.docsHash
    }
  }

  return result
}

/**
 * Force sync a specific component
 */
export async function syncSingleComponent(
  config: StorybookMCPConfig,
  componentPath: string,
  options: Partial<InitOptions> = {}
): Promise<SyncResult> {
  const analysis = await analyzeComponent(config, componentPath)
  
  const component: ComponentInfo = {
    name: analysis.name,
    filePath: componentPath,
    library: analysis.library,
    hasStory: analysis.hasStory,
    storyPath: analysis.storyPath,
    exportType: analysis.exportType,
  }

  const cache = loadCache(config.rootDir)
  const newCache = { ...cache }

  const result = await syncComponent(config, component, cache, newCache, {
    generateStories: options.generateStories ?? true,
    generateTests: options.generateTests ?? true,
    generateDocs: options.generateDocs ?? true,
    updateExisting: true,
    dryRun: options.dryRun ?? false,
  })

  if (!options.dryRun) {
    saveCache(config.rootDir, newCache)
  }

  return result
}
