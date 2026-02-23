/**
 * Shared constants — single source of truth.
 * All hardcoded values should be defined here for easy maintenance.
 */

// ===========================================
// License & Pro Features
// ===========================================
export const POLAR_UPGRADE_URL = 'https://polar.sh/forgekit'
export const FORGEKIT_EMAIL = 'forgekit@pm.me'
export const FREE_TIER_MAX_SYNC = 10
export const LICENSE_CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

// ===========================================
// File Extensions
// ===========================================
export const FILE_EXTENSIONS = {
  STORY_TSX: '.stories.tsx',
  STORY_TS: '.stories.ts',
  TEST_TSX: '.test.tsx',
  TEST_TS: '.test.ts',
  SPEC_TSX: '.spec.tsx',
  SPEC_TS: '.spec.ts',
  MDX: '.mdx',
  TSX: '.tsx',
  TS: '.ts',
  JSX: '.jsx',
  JS: '.js'
} as const

// ===========================================
// File Patterns
// ===========================================
export const DEFAULT_STORY_PATTERN = '**/*.stories.{ts,tsx}'
export const DEFAULT_COMPONENT_PATTERNS = [
  '**/*.tsx',
  '!**/*.stories.tsx',
  '!**/*.test.tsx'
]
export const DEFAULT_EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/.next/**',
  '**/build/**'
]

// ===========================================
// Special File Names (Non-Components)
// ===========================================
export const NON_COMPONENT_FILES = [
  'index',
  'types',
  'utils',
  'hooks',
  'constants',
  'styles',
  'helpers',
  'config',
  'api'
] as const

// ===========================================
// Directory Names
// ===========================================
export const DIRECTORIES = {
  STORYBOOK: '.storybook',
  STORIES: 'stories',
  STORIES_ALT: '__stories__',
  TESTS: '__tests__'
} as const

// ===========================================
// Storybook Configuration Files
// ===========================================
export const STORYBOOK_FILES = {
  PREVIEW_TSX: 'preview.tsx',
  PREVIEW_TS: 'preview.ts',
  MAIN_TS: 'main.ts',
  CACHE: '.storybook-mcp-cache.json'
} as const

// ===========================================
// Cache Settings
// ===========================================
export const CACHE = {
  VERSION: '1',
  FILENAME: '.storybook-mcp-cache.json'
} as const

// ===========================================
// ForgeKit Output Directory
// ===========================================
export const FORGEKIT_DIR = '.forgekit'
export const STORY_HISTORY_FILENAME = 'story-history.json'

// ===========================================
// File Thresholds
// ===========================================
export const THRESHOLDS = {
  EMPTY_FILE_SIZE: 50, // Bytes - files smaller than this are considered empty/minimal
  SOURCE_PREVIEW_LENGTH: 1000, // Characters to include in source preview
  MAX_NOTABLE_IMPORTS: 10 // Maximum number of imports to track
} as const

// ===========================================
// Timeouts & Delays
// ===========================================
export const TIMEOUTS = {
  MSW_LOADING_STORY: 5000, // MSW loading story timeout in ms
  MSW_NETWORK_DELAY: 1000 // Default MSW network delay in ms
} as const

// ===========================================
// Storybook Version
// ===========================================
/** Minimum required Storybook major version */
export const STORYBOOK_VERSION = 10
/** Fallback version used when no Storybook installation is detected */
export const DEFAULT_STORYBOOK_VERSION = '10.2.0'

// ===========================================
// Required Packages
// ===========================================
export const REQUIRED_PACKAGES = {
  STORYBOOK: '@storybook/react',
  TESTING_LIBRARY: '@testing-library/react',
  PLAYWRIGHT: '@playwright/test',
  VITEST: 'vitest'
} as const

// ===========================================
// Storybook Addons
// ===========================================
export const STORYBOOK_ADDONS = {
  ESSENTIALS: '@storybook/addon-essentials',
  INTERACTIONS: '@storybook/addon-interactions',
  A11Y: '@storybook/addon-a11y',
  LINKS: '@storybook/addon-links',
  DOCS: '@storybook/addon-docs',
  ROUTER: 'storybook-addon-remix-react-router',
  MSW: 'msw-storybook-addon'
} as const

// ===========================================
// Story Subdirectories (in priority order)
// ===========================================
export const STORY_SEARCH_PATHS = [
  '', // Same directory as component
  DIRECTORIES.STORIES,
  DIRECTORIES.STORIES_ALT
] as const
