/**
 * Storybook MCP Types
 */

// ===========================================
// Configuration
// ===========================================

export interface StorybookMCPConfig {
  /** Project root directory */
  rootDir: string

  /** Component library locations */
  libraries: LibraryConfig[]

  /** UI framework being used */
  framework:
    | 'chakra'
    | 'shadcn'
    | 'tamagui'
    | 'gluestack'
    | 'react-native'
    | 'vanilla'
    | 'custom'

  /** Story file naming convention */
  storyFilePattern: string

  /** Component file patterns to scan */
  componentPatterns: string[]

  /** Directories to exclude */
  excludePatterns: string[]

  /** License key for Pro features */
  licenseKey?: string

  /** Custom templates directory (optional) */
  templatesDir?: string

  /** Storybook version */
  storybookVersion?: 10
}

export interface LibraryConfig {
  /** Library name (for filtering) */
  name: string

  /** Path to library relative to rootDir */
  path: string

  /** Story title prefix (e.g., "Components / UI") */
  storyTitlePrefix: string

  /** Custom decorators for this library */
  decorators?: string[]

  /** Import path alias (e.g., "@ui", "@shared") */
  importAlias?: string
}

// ===========================================
// Component Analysis
// ===========================================

export interface ComponentInfo {
  /** Component name (PascalCase) */
  name: string

  /** File path relative to rootDir */
  filePath: string

  /** Which library this component belongs to */
  library: string

  /** Whether a story file exists */
  hasStory: boolean

  /** Story file path if exists */
  storyPath?: string

  /** Export type (default or named) */
  exportType: 'default' | 'named'
}

export interface ComponentAnalysis extends ComponentInfo {
  /** Extracted props with types */
  props: PropDefinition[]

  /** Dependencies detected */
  dependencies: DependencyInfo

  /** Suggestions for story generation */
  suggestions: string[]

  /** Raw source code (truncated) */
  sourcePreview: string
}

export interface PropDefinition {
  /** Prop name */
  name: string

  /** TypeScript type as string */
  type: string

  /** Whether prop is required */
  required: boolean

  /** Default value if any */
  defaultValue?: string

  /** JSDoc description */
  description?: string

  /** Suggested Storybook control type */
  controlType?:
    | 'text'
    | 'boolean'
    | 'number'
    | 'select'
    | 'radio'
    | 'color'
    | 'date'
    | 'object'

  /** Options for select/radio controls */
  controlOptions?: string[]
}

export interface DependencyInfo {
  /** Uses React Router */
  usesRouter: boolean

  /** Uses React Query / TanStack Query */
  usesReactQuery: boolean

  /** Uses Chakra UI */
  usesChakra: boolean

  /** Uses shadcn/ui */
  usesShadcn: boolean

  /** Uses Tamagui */
  usesTamagui: boolean

  /** Uses Gluestack UI */
  usesGluestack: boolean

  /** Uses React Native */
  usesReactNative: boolean

  /** Uses Emotion */
  usesEmotion: boolean

  /** Uses Tailwind */
  usesTailwind: boolean

  /** Uses Framer Motion */
  usesFramerMotion: boolean

  /** Uses MSW for mocking */
  usesMSW: boolean

  /** Uses Zustand/Redux/other state */
  usesGlobalState: boolean

  /** Other notable imports */
  otherImports: string[]
}

// ===========================================
// Story Generation
// ===========================================

export interface StoryGenerationOptions {
  /** Component file path */
  componentPath: string

  /** Include variant stories */
  includeVariants?: boolean

  /** Include interactive play functions */
  includeInteractive?: boolean

  /** Include accessibility story */
  includeA11y?: boolean

  /** Include responsive stories */
  includeResponsive?: boolean

  /** Template to use */
  template?:
    | 'basic'
    | 'with-controls'
    | 'with-variants'
    | 'with-msw'
    | 'with-router'
    | 'page'

  /** Custom args to include */
  customArgs?: Record<string, unknown>

  /** Decorators to wrap stories */
  decorators?: string[]

  /** Whether to overwrite existing story */
  overwrite?: boolean
}

export interface GeneratedStory {
  /** Generated story file content */
  content: string

  /** Suggested file path */
  filePath: string

  /** Imports needed */
  imports: string[]

  /** Stories generated */
  stories: string[]

  /** Warnings or notes */
  warnings: string[]
}

// ===========================================
// Story Validation
// ===========================================

export interface ValidationResult {
  /** Overall validity */
  valid: boolean

  /** Error messages */
  errors: ValidationIssue[]

  /** Warning messages */
  warnings: ValidationIssue[]

  /** Suggestions for improvement */
  suggestions: ValidationIssue[]

  /** Score out of 100 */
  score: number
}

export interface ValidationIssue {
  /** Issue type */
  type: 'error' | 'warning' | 'suggestion'

  /** Issue code for programmatic handling */
  code: string

  /** Human-readable message */
  message: string

  /** Line number if applicable */
  line?: number

  /** How to fix */
  fix?: string
}

// ===========================================
// Template Types
// ===========================================

export interface StoryTemplate {
  /** Template name */
  name: string

  /** Description */
  description: string

  /** When to use this template */
  useCase: string

  /** Template content with placeholders */
  content: string

  /** Required placeholders */
  placeholders: string[]
}

// ===========================================
// Tool Responses
// ===========================================

export interface ListComponentsResponse {
  components: ComponentInfo[]
  total: number
  withStories: number
  withoutStories: number
}

export interface AnalyzeComponentResponse {
  analysis: ComponentAnalysis
}

export interface GenerateStoryResponse {
  story: GeneratedStory
  written: boolean
  path: string
}

export interface ValidateStoryResponse {
  validation: ValidationResult
}

export interface GetTemplateResponse {
  template: StoryTemplate
}

// ===========================================
// Default Configuration
// ===========================================

export const DEFAULT_CONFIG: Partial<StorybookMCPConfig> = {
  storyFilePattern: '**/*.stories.{ts,tsx}',
  componentPatterns: [
    '**/src/**/*.tsx',
    '**/lib/**/*.tsx',
    '!**/*.stories.tsx',
    '!**/*.test.tsx',
    '!**/*.spec.tsx'
  ],
  excludePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.storybook/**'
  ],
  storybookVersion: 10
}
