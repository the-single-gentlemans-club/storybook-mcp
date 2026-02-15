/**
 * Custom Error Classes & Error Handling
 * Provides consistent error types with codes for better error handling
 */

// ===========================================
// Error Codes
// ===========================================

export enum ErrorCode {
  // File System Errors (1000-1099)
  COMPONENT_NOT_FOUND = 'COMPONENT_NOT_FOUND',
  STORY_NOT_FOUND = 'STORY_NOT_FOUND',
  FILE_READ_ERROR = 'FILE_READ_ERROR',
  FILE_WRITE_ERROR = 'FILE_WRITE_ERROR',
  INVALID_PATH = 'INVALID_PATH',

  // License & Feature Errors (2000-2099)
  LICENSE_REQUIRED = 'LICENSE_REQUIRED',
  FEATURE_NOT_AVAILABLE = 'FEATURE_NOT_AVAILABLE',
  LICENSE_VALIDATION_FAILED = 'LICENSE_VALIDATION_FAILED',
  SYNC_LIMIT_EXCEEDED = 'SYNC_LIMIT_EXCEEDED',

  // Configuration Errors (3000-3099)
  INVALID_CONFIG = 'INVALID_CONFIG',
  MISSING_CONFIG = 'MISSING_CONFIG',
  INVALID_FRAMEWORK = 'INVALID_FRAMEWORK',
  INVALID_LIBRARY_CONFIG = 'INVALID_LIBRARY_CONFIG',

  // Component Analysis Errors (4000-4099)
  PARSE_ERROR = 'PARSE_ERROR',
  INVALID_COMPONENT = 'INVALID_COMPONENT',
  NO_PROPS_FOUND = 'NO_PROPS_FOUND',
  INVALID_EXPORT = 'INVALID_EXPORT',

  // Generation Errors (5000-5099)
  GENERATION_FAILED = 'GENERATION_FAILED',
  TEMPLATE_NOT_FOUND = 'TEMPLATE_NOT_FOUND',
  INVALID_TEMPLATE = 'INVALID_TEMPLATE',

  // Validation Errors (6000-6099)
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  INVALID_STORY_FORMAT = 'INVALID_STORY_FORMAT',
  MISSING_META = 'MISSING_META',

  // Network Errors (7000-7099)
  NETWORK_ERROR = 'NETWORK_ERROR',
  API_ERROR = 'API_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',

  // Unknown/Generic (9000-9099)
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

// ===========================================
// Base Error Class
// ===========================================

export class StorybookMCPError extends Error {
  public readonly code: ErrorCode
  public readonly details?: unknown
  public readonly isOperational: boolean

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
    details?: unknown,
    isOperational = true
  ) {
    super(message)
    this.name = this.constructor.name
    this.code = code
    this.details = details
    this.isOperational = isOperational
    Error.captureStackTrace(this, this.constructor)
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      isOperational: this.isOperational,
    }
  }
}

// ===========================================
// Specific Error Classes
// ===========================================

export class FileSystemError extends StorybookMCPError {
  constructor(message: string, code: ErrorCode, path?: string) {
    super(message, code, { path })
  }
}

export class LicenseError extends StorybookMCPError {
  constructor(message: string, feature?: string) {
    super(message, ErrorCode.FEATURE_NOT_AVAILABLE, { feature })
  }
}

export class ConfigurationError extends StorybookMCPError {
  constructor(message: string, code: ErrorCode = ErrorCode.INVALID_CONFIG, details?: unknown) {
    super(message, code, details)
  }
}

export class ComponentAnalysisError extends StorybookMCPError {
  constructor(message: string, code: ErrorCode, componentPath?: string) {
    super(message, code, { componentPath })
  }
}

export class GenerationError extends StorybookMCPError {
  constructor(message: string, code: ErrorCode = ErrorCode.GENERATION_FAILED, details?: unknown) {
    super(message, code, details)
  }
}

export class ValidationError extends StorybookMCPError {
  constructor(message: string, code: ErrorCode = ErrorCode.VALIDATION_FAILED, details?: unknown) {
    super(message, code, details)
  }
}

// ===========================================
// Error Utilities
// ===========================================

/**
 * Check if error is operational (expected) vs programming error
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof StorybookMCPError) {
    return error.isOperational
  }
  return false
}

/**
 * Extract error message safely
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return 'An unknown error occurred'
}

/**
 * Extract error code safely
 */
export function getErrorCode(error: unknown): ErrorCode {
  if (error instanceof StorybookMCPError) {
    return error.code
  }
  return ErrorCode.UNKNOWN_ERROR
}

/**
 * Format error for logging
 */
export function formatError(error: unknown): string {
  if (error instanceof StorybookMCPError) {
    const parts = [
      `[${error.code}]`,
      error.message,
    ]
    if (error.details) {
      parts.push(`Details: ${JSON.stringify(error.details)}`)
    }
    return parts.join(' ')
  }
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`
  }
  return String(error)
}

/**
 * Wrap unknown errors in StorybookMCPError
 */
export function wrapError(error: unknown, code: ErrorCode = ErrorCode.UNKNOWN_ERROR): StorybookMCPError {
  if (error instanceof StorybookMCPError) {
    return error
  }
  if (error instanceof Error) {
    return new StorybookMCPError(error.message, code, { originalError: error.name })
  }
  return new StorybookMCPError(String(error), code)
}
