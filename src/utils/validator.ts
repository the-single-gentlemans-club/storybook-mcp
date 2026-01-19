/**
 * Story Validator
 * Validates existing story files for best practices
 */

import fs from 'node:fs'
import path from 'node:path'
import type {
  StorybookMCPConfig,
  ValidationResult,
  ValidationIssue,
} from './types.js'

/**
 * Validate a story file
 */
export async function validateStory(
  config: StorybookMCPConfig,
  storyPath: string
): Promise<ValidationResult> {
  const fullPath = path.join(config.rootDir, storyPath)
  
  if (!fs.existsSync(fullPath)) {
    return {
      valid: false,
      errors: [{
        type: 'error',
        code: 'FILE_NOT_FOUND',
        message: `Story file not found: ${storyPath}`,
      }],
      warnings: [],
      suggestions: [],
      score: 0,
    }
  }

  const source = fs.readFileSync(fullPath, 'utf-8')
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []
  const suggestions: ValidationIssue[] = []

  // Run all validators
  validateMeta(source, errors, warnings, suggestions)
  validateStoryExports(source, errors, warnings, suggestions)
  validateImports(source, errors, warnings, suggestions)
  validateTypes(source, errors, warnings, suggestions)
  validateDocumentation(source, errors, warnings, suggestions)
  validateInteractions(source, errors, warnings, suggestions)
  validateAccessibility(source, errors, warnings, suggestions)
  validateBestPractices(source, errors, warnings, suggestions)

  // Calculate score
  const score = calculateScore(errors, warnings, suggestions)

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions,
    score,
  }
}

/**
 * Validate meta configuration
 */
function validateMeta(
  source: string,
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
  suggestions: ValidationIssue[]
): void {
  // Check for meta export
  if (!source.includes('export default') && !source.includes('export const meta')) {
    errors.push({
      type: 'error',
      code: 'NO_META_EXPORT',
      message: 'Story file must have a default export for meta configuration',
      fix: 'Add: export default meta',
    })
  }

  // Check for title
  if (!source.includes("title:") && !source.includes("title :")) {
    warnings.push({
      type: 'warning',
      code: 'NO_TITLE',
      message: 'Story should have a title in meta',
      fix: "Add title: 'Components/YourComponent' to meta",
    })
  }

  // Check for component reference
  if (!source.includes('component:')) {
    errors.push({
      type: 'error',
      code: 'NO_COMPONENT_REF',
      message: 'Meta must reference the component',
      fix: 'Add component: YourComponent to meta',
    })
  }

  // Check for autodocs tag
  if (!source.includes("'autodocs'") && !source.includes('"autodocs"')) {
    suggestions.push({
      type: 'suggestion',
      code: 'NO_AUTODOCS',
      message: "Consider adding 'autodocs' tag for automatic documentation",
      fix: "Add tags: ['autodocs'] to meta",
    })
  }
}

/**
 * Validate story exports
 */
function validateStoryExports(
  source: string,
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
  suggestions: ValidationIssue[]
): void {
  // Check for at least one story
  const storyExports = source.match(/export const \w+:/g) || []
  const storyCount = storyExports.filter(s => !s.includes('meta')).length

  if (storyCount === 0) {
    errors.push({
      type: 'error',
      code: 'NO_STORIES',
      message: 'Story file must export at least one story',
      fix: 'Add: export const Default: Story = { args: {} }',
    })
  }

  // Check for Default story
  if (!source.includes('export const Default')) {
    warnings.push({
      type: 'warning',
      code: 'NO_DEFAULT_STORY',
      message: 'Consider having a Default story as the primary example',
      fix: 'Add: export const Default: Story = { ... }',
    })
  }

  // Suggest multiple stories
  if (storyCount === 1) {
    suggestions.push({
      type: 'suggestion',
      code: 'SINGLE_STORY',
      message: 'Consider adding more stories to showcase different states',
      fix: 'Add stories for variants, sizes, disabled states, etc.',
    })
  }
}

/**
 * Validate imports
 */
function validateImports(
  source: string,
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
  suggestions: ValidationIssue[]
): void {
  // Check for proper Storybook imports
  if (!source.includes("from '@storybook/react'") && !source.includes('from "@storybook/react"')) {
    errors.push({
      type: 'error',
      code: 'MISSING_STORYBOOK_IMPORT',
      message: 'Must import Meta and StoryObj from @storybook/react',
      fix: "Add: import type { Meta, StoryObj } from '@storybook/react'",
    })
  }

  // Check for type imports
  if (source.includes('import { Meta') && !source.includes('import type')) {
    suggestions.push({
      type: 'suggestion',
      code: 'USE_TYPE_IMPORT',
      message: 'Use type imports for Meta and StoryObj',
      fix: "Change to: import type { Meta, StoryObj } from '@storybook/react'",
    })
  }

  // Check for deprecated imports
  if (source.includes('@storybook/react/preview')) {
    warnings.push({
      type: 'warning',
      code: 'DEPRECATED_IMPORT',
      message: '@storybook/react/preview is deprecated',
      fix: "Use '@storybook/react' instead",
    })
  }

  // Check for Storybook 7 vs 8 imports
  if (source.includes('@storybook/testing-library')) {
    suggestions.push({
      type: 'suggestion',
      code: 'OUTDATED_TEST_IMPORT',
      message: '@storybook/testing-library is deprecated in Storybook 8',
      fix: "Use '@storybook/test' instead",
    })
  }
}

/**
 * Validate TypeScript types
 */
function validateTypes(
  source: string,
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
  suggestions: ValidationIssue[]
): void {
  // Check for proper Story type
  if (source.includes('Story =') && !source.includes('StoryObj<typeof')) {
    warnings.push({
      type: 'warning',
      code: 'WEAK_STORY_TYPE',
      message: 'Stories should be typed with StoryObj<typeof Component>',
      fix: 'Add: type Story = StoryObj<typeof YourComponent>',
    })
  }

  // Check for any types
  if (source.includes(': any') || source.includes('<any>')) {
    warnings.push({
      type: 'warning',
      code: 'ANY_TYPE',
      message: 'Avoid using any type - use proper types',
      fix: 'Replace any with specific types',
    })
  }
}

/**
 * Validate documentation
 */
function validateDocumentation(
  source: string,
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
  suggestions: ValidationIssue[]
): void {
  // Check for story JSDoc comments
  const storyExports = source.match(/export const \w+/g) || []
  const jsDocCount = (source.match(/\/\*\*[\s\S]*?\*\/\s*export const/g) || []).length

  if (storyExports.length > jsDocCount + 1) { // +1 for meta
    suggestions.push({
      type: 'suggestion',
      code: 'MISSING_JSDOC',
      message: 'Add JSDoc comments to describe each story',
      fix: 'Add /** Description */ before each export const',
    })
  }

  // Check for argTypes descriptions
  if (source.includes('argTypes:') && !source.includes('description:')) {
    suggestions.push({
      type: 'suggestion',
      code: 'MISSING_ARG_DESCRIPTIONS',
      message: 'Add descriptions to argTypes for better documentation',
      fix: "Add description: 'What this prop does' to each argType",
    })
  }
}

/**
 * Validate interaction tests
 */
function validateInteractions(
  source: string,
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
  suggestions: ValidationIssue[]
): void {
  // Check if component has events but no play functions
  if (source.includes('onClick') || source.includes('onSubmit') || source.includes('onChange')) {
    if (!source.includes('play:')) {
      suggestions.push({
        type: 'suggestion',
        code: 'MISSING_INTERACTIONS',
        message: 'Component has event handlers - consider adding interaction tests',
        fix: 'Add play: async ({ canvasElement }) => { ... } to stories',
      })
    }
  }

  // Check for proper play function structure
  if (source.includes('play:')) {
    if (!source.includes('within(')) {
      warnings.push({
        type: 'warning',
        code: 'MISSING_WITHIN',
        message: "Play functions should use within(canvasElement) for scoped queries",
        fix: 'Add: const canvas = within(canvasElement)',
      })
    }

    if (!source.includes('expect(')) {
      warnings.push({
        type: 'warning',
        code: 'MISSING_ASSERTIONS',
        message: 'Play functions should include assertions',
        fix: 'Add expect() assertions to verify behavior',
      })
    }
  }
}

/**
 * Validate accessibility considerations
 */
function validateAccessibility(
  source: string,
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
  suggestions: ValidationIssue[]
): void {
  // Check for aria attributes in stories
  if (!source.includes('aria-') && !source.includes('role=')) {
    suggestions.push({
      type: 'suggestion',
      code: 'NO_A11Y_STORIES',
      message: 'Consider adding stories that demonstrate accessibility features',
      fix: "Add stories with aria-label, role, and other a11y attributes",
    })
  }

  // Check for keyboard navigation tests
  if (source.includes('play:') && !source.includes('userEvent.tab') && !source.includes('keyboard')) {
    suggestions.push({
      type: 'suggestion',
      code: 'NO_KEYBOARD_TESTS',
      message: 'Consider testing keyboard navigation in play functions',
      fix: 'Add: await userEvent.tab() to test keyboard navigation',
    })
  }
}

/**
 * Validate best practices
 */
function validateBestPractices(
  source: string,
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
  suggestions: ValidationIssue[]
): void {
  // Check for hardcoded styles in stories
  if (source.includes('style={{') && source.split('style={{').length > 3) {
    suggestions.push({
      type: 'suggestion',
      code: 'HARDCODED_STYLES',
      message: 'Consider using component props or decorators instead of inline styles',
      fix: 'Move styles to decorators or use theme values',
    })
  }

  // Check for console.log
  if (source.includes('console.log')) {
    warnings.push({
      type: 'warning',
      code: 'CONSOLE_LOG',
      message: 'Remove console.log statements from stories',
      fix: 'Remove console.log or use Storybook actions',
    })
  }

  // Check for action usage
  if (source.includes('onClick') && !source.includes("action('")) {
    suggestions.push({
      type: 'suggestion',
      code: 'USE_ACTIONS',
      message: "Use Storybook's action() for event handlers",
      fix: "Import action from '@storybook/addon-actions' and use action('click')",
    })
  }

  // Check for parameters usage
  if (!source.includes('parameters:')) {
    suggestions.push({
      type: 'suggestion',
      code: 'NO_PARAMETERS',
      message: 'Consider using parameters for backgrounds, viewport, etc.',
      fix: 'Add parameters: { backgrounds: { default: "dark" } } to stories',
    })
  }
}

/**
 * Calculate validation score
 */
function calculateScore(
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
  suggestions: ValidationIssue[]
): number {
  const maxScore = 100
  
  // Deductions
  const errorDeduction = errors.length * 20
  const warningDeduction = warnings.length * 5
  const suggestionDeduction = suggestions.length * 1
  
  const totalDeduction = errorDeduction + warningDeduction + suggestionDeduction
  
  return Math.max(0, maxScore - totalDeduction)
}
