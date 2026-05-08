/**
 * Story Merger
 * Merges regenerated template sections with user-added story blocks.
 * All functions are pure (no disk I/O) for testability.
 */

// Matches: export const Foo: Story  (also handles StoryObj<...>)
const EXPORT_STORY_RE = /^export const (\w+):\s*Story\b/gm

/**
 * Parse all story export names from a story source string.
 * Ignores `meta` and other non-story exports.
 */
export function parseStoryExports(source: string): string[] {
  const names: string[] = []
  let match: RegExpExecArray | null = null
  const re = new RegExp(EXPORT_STORY_RE.source, 'gm')
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex exec loop
  while ((match = re.exec(source)) !== null) {
    names.push(match[1])
  }
  return names
}

/**
 * Extract the complete source block for a single story export,
 * from its `export const X: Story` line to (but not including)
 * the next `export const` or end of file.
 */
export function extractStoryBlock(source: string, exportName: string): string {
  const startRe = new RegExp(`^export const ${exportName}:\\s*Story\\b`, 'm')
  const startMatch = startRe.exec(source)
  if (!startMatch) return ''

  const startIdx = startMatch.index

  // Find the next top-level export after this one
  const nextRe = /^export const \w+/gm
  nextRe.lastIndex = startIdx + startMatch[0].length
  const nextMatch = nextRe.exec(source)

  const endIdx = nextMatch ? nextMatch.index : source.length
  return source.slice(startIdx, endIdx).trimEnd() + '\n'
}

export interface MergeResult {
  /** Final merged story content */
  content: string
  /** Story export names that were in the existing file but NOT in the generated template — appended to output */
  preserved: string[]
  /** Story export names that were in the existing file but neither in generated nor user-added (should not occur with current logic, kept for future) */
  removed: string[]
}

/**
 * Merge a freshly generated story with an existing story file.
 *
 * Strategy:
 * 1. Identify which story exports in `existing` are NOT in `generatedExports` — these are user-added.
 * 2. Extract each user-added block from `existing`.
 * 3. Append them after the generated content (with a separator comment).
 *
 * @param generated      - Fresh story content from generator
 * @param existing       - Current on-disk story content
 * @param generatedExports - List of export names in `generated` (avoids re-parsing)
 */
export function mergeStories(
  generated: string,
  existing: string,
  generatedExports: string[]
): MergeResult {
  const existingExports = parseStoryExports(existing)

  // User-added: in existing but not in the freshly generated set
  const userAdded = existingExports.filter(name => !generatedExports.includes(name))

  if (userAdded.length === 0) {
    return { content: generated, preserved: [], removed: [] }
  }

  const blocks: string[] = []
  for (const name of userAdded) {
    const block = extractStoryBlock(existing, name)
    if (block) {
      blocks.push(block)
    }
  }

  const separator = '\n// ─── User-added stories (preserved by update_story) ───────────────────────\n\n'
  const merged = generated.trimEnd() + '\n' + separator + blocks.join('\n') + '\n'

  return {
    content: merged,
    preserved: userAdded,
    removed: [],
  }
}

export interface AppendMissingResult {
  /** Final story content (either original existing, or augmented) */
  content: string
  /** Story export names that were added from the generated template */
  added: string[]
}

/**
 * Append missing generated story exports into an existing story file, without
 * overwriting any existing story exports.
 *
 * This is useful for "topping up" older story files that only contain a subset
 * of the stories we now generate (variants, play tests, etc.).
 */
export function appendMissingGeneratedStories(
  generated: string,
  existing: string
): AppendMissingResult {
  const generatedExports = parseStoryExports(generated)
  const existingExports = parseStoryExports(existing)

  const missing = generatedExports.filter(name => !existingExports.includes(name))
  if (missing.length === 0) {
    return { content: existing, added: [] }
  }

  const blocks: string[] = []
  for (const name of missing) {
    const block = extractStoryBlock(generated, name)
    if (block) blocks.push(block)
  }

  if (blocks.length === 0) {
    return { content: existing, added: [] }
  }

  const separator =
    '\n// ─── Added by storybook-mcp sync (missing generated stories) ───────────────\n\n'
  const augmented = existing.trimEnd() + '\n' + separator + blocks.join('\n') + '\n'

  return { content: augmented, added: missing }
}
