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
  ComponentAnalysis
} from '../types.js'
import { scanComponents, analyzeComponent } from './scanner.js'
import { POLAR_UPGRADE_URL, CACHE, FILE_EXTENSIONS } from './constants.js'
import { generateStory, writeStoryFile } from './generator.js'
import { generateTest, writeTestFile } from './test-generator.js'
import { generateDocs, writeDocsFile } from './docs-generator.js'

// Max components processed concurrently (avoids memory spikes on large repos)
const CONCURRENCY_LIMIT = 5

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

interface HashCache {
  version: string
  components: Record<
    string,
    {
      hash: string
      lastSync: string
    }
  >
}

function loadCache(rootDir: string): HashCache {
  const cachePath = path.join(rootDir, CACHE.FILENAME)
  try {
    if (fs.existsSync(cachePath)) {
      return JSON.parse(fs.readFileSync(cachePath, 'utf-8'))
    }
  } catch {
    // Ignore cache errors
  }
  return { version: CACHE.VERSION, components: {} }
}

function saveCache(rootDir: string, cache: HashCache): void {
  const cachePath = path.join(rootDir, CACHE.FILENAME)
  const tmpPath = `${cachePath}.tmp`
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(cache, null, 2))
    fs.renameSync(tmpPath, cachePath)
  } catch {
    // Clean up temp file on failure
    try {
      fs.unlinkSync(tmpPath)
    } catch {
      /* ignore */
    }
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

/**
 * Remove cache entries for files that no longer exist on disk.
 * Prevents ghost entries from accumulating over time.
 */
function pruneStaleCache(
  rootDir: string,
  cache: HashCache,
  scannedPaths: Set<string>
): void {
  for (const cachedPath of Object.keys(cache.components)) {
    if (!scannedPaths.has(cachedPath)) {
      delete cache.components[cachedPath]
    }
  }
}

// ===========================================
// File Path Helpers
// ===========================================

function getStoryPath(componentPath: string): string {
  const dir = path.dirname(componentPath)
  const basename = path.basename(componentPath, path.extname(componentPath))
  return path.join(dir, `${basename}${FILE_EXTENSIONS.STORY_TSX}`)
}

function getTestPath(componentPath: string): string {
  const dir = path.dirname(componentPath)
  const basename = path.basename(componentPath, path.extname(componentPath))
  return path.join(dir, `${basename}${FILE_EXTENSIONS.TEST_TSX}`)
}

function getDocsPath(componentPath: string): string {
  const dir = path.dirname(componentPath)
  const basename = path.basename(componentPath, path.extname(componentPath))
  return path.join(dir, `${basename}${FILE_EXTENSIONS.MDX}`)
}

function fileExists(rootDir: string, relativePath: string): boolean {
  return fs.existsSync(path.join(rootDir, relativePath))
}

/**
 * Extract named story exports (`export const Foo: Story`) from story file content.
 * Used to ensure MDX Canvas blocks only reference exports that actually exist.
 */
function extractStoryExports(storyContent: string): string[] {
  const pattern = /export const (\w+):\s*Story/g
  const names: string[] = []
  let match: RegExpExecArray | null
  while ((match = pattern.exec(storyContent)) !== null) {
    names.push(match[1])
  }
  return names
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
    maxComponents
  } = options

  const result: InitResult = {
    scanned: 0,
    created: { stories: 0, tests: 0, docs: 0 },
    updated: { stories: 0, tests: 0, docs: 0 },
    skipped: 0,
    errors: [],
    details: []
  }

  // Load cache for change detection
  const cache = loadCache(config.rootDir)
  const newCache: HashCache = { version: CACHE.VERSION, components: {} }

  // Scan all components
  let components = await scanComponents(config, { library })
  result.scanned = components.length

  // Prune stale cache entries for files that no longer exist
  const scannedPaths = new Set(components.map(c => c.filePath))
  pruneStaleCache(config.rootDir, cache, scannedPaths)

  // Apply license limit
  let limitApplied = false
  if (maxComponents && maxComponents < components.length) {
    components = components.slice(0, maxComponents)
    limitApplied = true
  }

  console.error(
    `[storybook-mcp] Scanning ${components.length} components...${limitApplied ? ` (limited from ${result.scanned})` : ''}`
  )

  // Process components in concurrent batches for speed on large repos
  for (let i = 0; i < components.length; i += CONCURRENCY_LIMIT) {
    const batch = components.slice(i, i + CONCURRENCY_LIMIT)
    await Promise.all(
      batch.map(async component => {
        // Apply filter if specified
        if (
          filter &&
          !component.name.toLowerCase().includes(filter.toLowerCase())
        ) {
          result.skipped++
          return
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
              dryRun
            }
          )

          result.details.push(syncResult)

          if (syncResult.story.action === 'created') result.created.stories++
          if (syncResult.story.action === 'updated') result.updated.stories++
          if (syncResult.test.action === 'created') result.created.tests++
          if (syncResult.test.action === 'updated') result.updated.tests++
          if (syncResult.docs.action === 'created') result.created.docs++
          if (syncResult.docs.action === 'updated') result.updated.docs++
        } catch (error) {
          result.errors.push({
            component: component.name,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      })
    )
  }

  // Save updated cache
  if (!dryRun) {
    saveCache(config.rootDir, newCache)
  }

  // Log summary
  const totalCreated =
    result.created.stories + result.created.tests + result.created.docs
  const totalUpdated =
    result.updated.stories + result.updated.tests + result.updated.docs

  console.error(`[storybook-mcp] Sync complete:`)
  console.error(`  Scanned: ${result.scanned} components`)
  console.error(
    `  Created: ${totalCreated} files (${result.created.stories} stories, ${result.created.tests} tests, ${result.created.docs} docs)`
  )
  console.error(`  Updated: ${totalUpdated} files`)
  console.error(`  Skipped: ${result.skipped}`)
  if (result.errors.length > 0) {
    console.error(`  Errors: ${result.errors.length}`)
  }
  if (limitApplied && maxComponents) {
    console.error(
      `\n⚠️  Free tier limit: Only ${maxComponents} components processed.`
    )
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
  const {
    generateStories: shouldGenStories,
    generateTests: shouldGenTests,
    generateDocs: shouldGenDocs,
    updateExisting,
    dryRun
  } = options

  const componentFullPath = path.join(config.rootDir, component.filePath)
  const componentHash = hashFile(componentFullPath)
  const cachedComponent = oldCache.components[component.filePath]
  const componentChanged =
    !cachedComponent || cachedComponent.hash !== componentHash

  const result: SyncResult = {
    component: component.name,
    path: component.filePath,
    story: { action: 'skipped' },
    test: { action: 'skipped' },
    docs: { action: 'skipped' }
  }

  // Update cache entry
  newCache.components[component.filePath] = {
    hash: componentHash,
    lastSync: new Date().toISOString()
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
  // Track exported story names so docs Canvas blocks only reference existing exports.
  let availableStoryExports: string[] | undefined
  if (shouldGenStories) {
    const storyPath = getStoryPath(component.filePath)
    const storyExists = fileExists(config.rootDir, storyPath)

    if (!storyExists) {
      // Create new story
      const componentAnalysis = await getAnalysis()
      const story = await generateStory(config, componentAnalysis, {
        componentPath: component.filePath,
        includeVariants: true,
        includeInteractive: true
      })

      availableStoryExports = extractStoryExports(story.content)

      if (!dryRun) {
        await writeStoryFile(config, story, true)
      }

      result.story = { action: 'created', path: storyPath }
    } else if (updateExisting && componentChanged) {
      // Update existing story if component changed
      const componentAnalysis = await getAnalysis()
      const story = await generateStory(config, componentAnalysis, {
        componentPath: component.filePath,
        includeVariants: true,
        includeInteractive: true,
        overwrite: true
      })

      availableStoryExports = extractStoryExports(story.content)

      if (!dryRun) {
        await writeStoryFile(config, story, true)
      }

      result.story = {
        action: 'updated',
        path: storyPath,
        reason: 'component changed'
      }
    } else {
      // Story unchanged — read existing file to learn what exports it has
      const storyFullPath = path.join(config.rootDir, storyPath)
      if (fs.existsSync(storyFullPath)) {
        availableStoryExports = extractStoryExports(
          fs.readFileSync(storyFullPath, 'utf-8')
        )
      }
      result.story = { action: 'unchanged', path: storyPath }
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
    } else if (updateExisting && componentChanged) {
      const componentAnalysis = await getAnalysis()
      const test = await generateTest(config, componentAnalysis)

      if (!dryRun) {
        await writeTestFile(config, test, true)
      }

      result.test = {
        action: 'updated',
        path: testPath,
        reason: 'component changed'
      }
    } else {
      result.test = { action: 'unchanged', path: testPath }
    }
  }

  // --- Docs ---
  if (shouldGenDocs) {
    const docsPath = getDocsPath(component.filePath)
    const docsExists = fileExists(config.rootDir, docsPath)

    if (!docsExists) {
      const componentAnalysis = await getAnalysis()
      const docs = await generateDocs(
        config,
        componentAnalysis,
        availableStoryExports
      )

      if (!dryRun) {
        await writeDocsFile(config, docs)
      }

      result.docs = { action: 'created', path: docsPath }
    } else if (updateExisting && componentChanged) {
      const componentAnalysis = await getAnalysis()
      const docs = await generateDocs(
        config,
        componentAnalysis,
        availableStoryExports
      )

      if (!dryRun) {
        await writeDocsFile(config, docs, true)
      }

      result.docs = {
        action: 'updated',
        path: docsPath,
        reason: 'component changed'
      }
    } else {
      result.docs = { action: 'unchanged', path: docsPath }
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
    exportType: analysis.exportType
  }

  const cache = loadCache(config.rootDir)
  // Deep-copy components map so mutations inside syncComponent don't corrupt the old cache
  const newCache: HashCache = {
    version: cache.version,
    components: { ...cache.components }
  }

  const result = await syncComponent(config, component, cache, newCache, {
    generateStories: options.generateStories ?? true,
    generateTests: options.generateTests ?? true,
    generateDocs: options.generateDocs ?? true,
    updateExisting: true,
    dryRun: options.dryRun ?? false
  })

  if (!options.dryRun) {
    saveCache(config.rootDir, newCache)
  }

  return result
}
// ===========================================
// File Watcher
// ===========================================

export interface WatchOptions {
  /** Generate stories for new/changed components */
  generateStories?: boolean
  /** Generate test files for new/changed components */
  generateTests?: boolean
  /** Generate MDX docs for new/changed components */
  generateDocs?: boolean
  /** Debounce delay after a file event before syncing (ms, default: 500) */
  debounceMs?: number
  /** Interval for the periodic catch-up rescan (ms, default: 30000) */
  rescanIntervalMs?: number
}

/**
 * Returns true if the absolute path looks like a component source file
 * (matches a configured library, is .tsx, is not a story/test/spec/index file).
 */
function isComponentFile(
  config: StorybookMCPConfig,
  absolutePath: string
): boolean {
  const basename = path.basename(absolutePath)
  if (!basename.endsWith('.tsx') && !basename.endsWith('.ts')) return false
  if (
    basename.endsWith('.stories.tsx') ||
    basename.endsWith('.stories.ts') ||
    basename.endsWith('.test.tsx') ||
    basename.endsWith('.test.ts') ||
    basename.endsWith('.spec.tsx') ||
    basename.endsWith('.spec.ts')
  )
    return false
  // Must live inside a configured library directory
  return config.libraries.some(lib => {
    const libAbs = path.resolve(config.rootDir, lib.path)
    return (
      absolutePath.startsWith(libAbs + path.sep) ||
      absolutePath.startsWith(libAbs + '/')
    )
  })
}

/**
 * Watch configured library directories for component changes and auto-sync.
 *
 * Uses fs.watch (recursive) as the primary mechanism, with a periodic
 * catch-up rescan to handle any events missed (especially on Linux where
 * recursive watch has limited kernel support).
 *
 * @returns A stop function — call it to close all watchers and clear timers.
 */
export function startFileWatcher(
  config: StorybookMCPConfig,
  options: WatchOptions = {}
): () => void {
  const {
    generateStories = true,
    generateTests = true,
    generateDocs = true,
    debounceMs = 500,
    rescanIntervalMs = 30_000
  } = options

  const watchers: import('fs').FSWatcher[] = []
  const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>()
  let rescanTimer: ReturnType<typeof setInterval> | null = null
  let stopped = false

  // -------------------------------------------------------
  // Process a single file path after debounce
  // -------------------------------------------------------
  async function handleFile(absolutePath: string): Promise<void> {
    if (stopped) return
    if (!isComponentFile(config, absolutePath)) return

    // File may have been deleted
    if (!fs.existsSync(absolutePath)) {
      // Remove from cache so it will be treated as new if re-added later
      const cache = loadCache(config.rootDir)
      const relPath = path.relative(config.rootDir, absolutePath)
      if (relPath in cache.components) {
        delete cache.components[relPath]
        saveCache(config.rootDir, cache)
        console.error(
          `[storybook-mcp] Removed deleted component from cache: ${relPath}`
        )
      }
      return
    }

    const relPath = path.relative(config.rootDir, absolutePath)
    console.error(`[storybook-mcp] 👁  Detected change: ${relPath}`)

    try {
      const syncResult = await syncSingleComponent(config, relPath, {
        generateStories,
        generateTests,
        generateDocs,
        updateExisting: true
      })

      const actions = [
        syncResult.story.action !== 'skipped' &&
        syncResult.story.action !== 'unchanged'
          ? `story: ${syncResult.story.action}`
          : null,
        syncResult.test.action !== 'skipped' &&
        syncResult.test.action !== 'unchanged'
          ? `test: ${syncResult.test.action}`
          : null,
        syncResult.docs.action !== 'skipped' &&
        syncResult.docs.action !== 'unchanged'
          ? `docs: ${syncResult.docs.action}`
          : null
      ].filter(Boolean)

      if (actions.length > 0) {
        console.error(
          `[storybook-mcp] ✓ ${syncResult.component}: ${actions.join(', ')}`
        )
      }
    } catch (err) {
      console.error(
        `[storybook-mcp] Watch sync error for ${relPath}: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  // -------------------------------------------------------
  // Debounced event handler
  // -------------------------------------------------------
  function onEvent(filename: string | null, watchRoot: string): void {
    if (!filename) return
    const absolutePath = path.join(watchRoot, filename)

    const existing = pendingTimers.get(absolutePath)
    if (existing) clearTimeout(existing)

    const timer = setTimeout(() => {
      pendingTimers.delete(absolutePath)
      handleFile(absolutePath).catch(err =>
        console.error(`[storybook-mcp] Unhandled watch error: ${err}`)
      )
    }, debounceMs)

    pendingTimers.set(absolutePath, timer)
  }

  // -------------------------------------------------------
  // Start a watcher for each library root
  // -------------------------------------------------------
  for (const lib of config.libraries) {
    const watchRoot = path.resolve(config.rootDir, lib.path)
    if (!fs.existsSync(watchRoot)) continue

    try {
      const watcher = fs.watch(
        watchRoot,
        { recursive: true },
        (_event, filename) => {
          onEvent(filename, watchRoot)
        }
      )
      watcher.on('error', err =>
        console.error(
          `[storybook-mcp] Watcher error (${lib.path}): ${(err as Error).message}`
        )
      )
      watchers.push(watcher)
      console.error(`[storybook-mcp] 👁  Watching: ${lib.path}`)
    } catch (err) {
      // fs.watch can fail on some network file systems — degrade gracefully
      console.error(
        `[storybook-mcp] Could not start watcher for ${lib.path} (will rely on periodic rescan): ${(err as Error).message}`
      )
    }
  }

  // -------------------------------------------------------
  // Periodic catch-up rescan
  // Catches events missed by fs.watch (Linux recursive limitations,
  // network drives, very rapid creation of many files, etc.)
  // -------------------------------------------------------
  rescanTimer = setInterval(async () => {
    if (stopped) return
    try {
      const cache = loadCache(config.rootDir)
      const components = await scanComponents(config)

      // Find components that are new (not in cache) or changed (hash mismatch)
      const needsSync = components.filter(comp => {
        const fullPath = path.join(config.rootDir, comp.filePath)
        const currentHash = hashFile(fullPath)
        const cached = cache.components[comp.filePath]
        return !cached || cached.hash !== currentHash
      })

      if (needsSync.length > 0) {
        console.error(
          `[storybook-mcp] Rescan found ${needsSync.length} component(s) to sync`
        )
        for (let i = 0; i < needsSync.length; i += CONCURRENCY_LIMIT) {
          await Promise.all(
            needsSync.slice(i, i + CONCURRENCY_LIMIT).map(async comp => {
              try {
                await syncSingleComponent(config, comp.filePath, {
                  generateStories,
                  generateTests,
                  generateDocs,
                  updateExisting: true
                })
              } catch (err) {
                console.error(
                  `[storybook-mcp] Rescan sync error for ${comp.filePath}: ${err instanceof Error ? err.message : String(err)}`
                )
              }
            })
          )
        }
      }
    } catch (err) {
      console.error(
        `[storybook-mcp] Periodic rescan error: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }, rescanIntervalMs)

  // -------------------------------------------------------
  // Stop function
  // -------------------------------------------------------
  return function stop(): void {
    stopped = true
    for (const watcher of watchers) {
      try {
        watcher.close()
      } catch {
        /* ignore */
      }
    }
    if (rescanTimer !== null) clearInterval(rescanTimer)
    for (const timer of pendingTimers.values()) clearTimeout(timer)
    pendingTimers.clear()
  }
}
