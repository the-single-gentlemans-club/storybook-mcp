/**
 * License Manager
 * Handles license validation and feature gating via Polar.sh API
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import type { StorybookMCPConfig } from '../types.js'
import { POLAR_UPGRADE_URL, LICENSE_CACHE_TTL_MS } from './constants.js'
import { LicenseError } from './errors.js'

const POLAR_ORG_ID = process.env.POLAR_ORG_ID || 'c39241cb-629a-4beb-8ec8-31820430d5fd'
const POLAR_API_URL = process.env.POLAR_API_URL || 'https://api.polar.sh'

export type Feature =
  | 'basic_stories'
  | 'advanced_templates'
  | 'test_generation'
  | 'docs_generation'
  | 'unlimited_sync'
  | 'code_connect'

interface LicenseStatus {
  isValid: boolean
  tier: 'free' | 'pro'
  maxSyncLimit: number
}

interface CachedLicense {
  key: string
  valid: boolean
  checkedAt: number
}

// Cache location
const CACHE_DIR = path.join(os.homedir(), '.forgekit')
const CACHE_FILE = path.join(CACHE_DIR, 'license-cache.json')

// Cache duration imported from constants

// Module-level cache for async validation results
let cachedValidation: LicenseStatus | null = null

/**
 * Read cached license status
 */
function readCache(): CachedLicense | null {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null
    const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'))
    return data as CachedLicense
  } catch {
    return null
  }
}

/**
 * Write license status to cache
 */
function writeCache(cache: CachedLicense): void {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true })
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2))
  } catch {
    // Ignore cache write errors
  }
}

/**
 * Validate license key via Polar.sh API
 * Uses the customer-portal endpoint (no auth token required)
 */
async function validateWithPolar(key: string): Promise<boolean> {
  try {
    const response = await fetch(`${POLAR_API_URL}/v1/customer-portal/license-keys/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key,
        organization_id: POLAR_ORG_ID,
      }),
    })

    if (!response.ok) {
      return false
    }

    const data = await response.json() as {
      id?: string
      status?: string
      expires_at?: string | null
    }

    // Check if key exists and is in granted status
    if (data.id && data.status === 'granted') {
      // Check expiration if set
      if (data.expires_at) {
        const expiresAt = new Date(data.expires_at)
        if (expiresAt < new Date()) {
          return false
        }
      }
      return true
    }

    return false
  } catch (error) {
    console.error('[storybook-mcp] License validation failed:', error)
    return false
  }
}

/**
 * Validate license key and return status (synchronous)
 *
 * Returns cached results from async validation if available.
 * Otherwise checks file cache or returns free tier.
 *
 * Call validateLicenseAsync() at startup to populate the cache.
 */
export function validateLicense(config: StorybookMCPConfig): LicenseStatus {
  const key = config.licenseKey || process.env.STORYBOOK_MCP_LICENSE

  // No key = Free Tier
  if (!key) {
    return {
      isValid: true,
      tier: 'free',
      maxSyncLimit: 5
    }
  }

  // Return cached validation result if available (set by validateLicenseAsync)
  if (cachedValidation !== null) {
    return cachedValidation
  }

  // Check file cache as fallback
  const cached = readCache()
  if (cached && cached.key === key) {
    const age = Date.now() - cached.checkedAt
    if (age < LICENSE_CACHE_TTL_MS) {
      return {
        isValid: cached.valid,
        tier: cached.valid ? 'pro' : 'free',
        maxSyncLimit: cached.valid ? Infinity : 5
      }
    }
  }

  // No cache available - return free tier
  // validateLicenseAsync should be called at startup to populate cache
  return {
    isValid: true,
    tier: 'free',
    maxSyncLimit: 5
  }
}

/**
 * Async license validation with API call
 * Call this at startup to validate and cache the result.
 * Populates the module-level cache for subsequent validateLicense() calls.
 */
export async function validateLicenseAsync(config: StorybookMCPConfig): Promise<LicenseStatus> {
  const key = config.licenseKey || process.env.STORYBOOK_MCP_LICENSE

  // No key = Free Tier
  if (!key) {
    const status: LicenseStatus = {
      isValid: true,
      tier: 'free',
      maxSyncLimit: 5
    }
    cachedValidation = status
    return status
  }

  // Check cache first
  const cached = readCache()
  if (cached && cached.key === key) {
    const age = Date.now() - cached.checkedAt
    if (age < LICENSE_CACHE_TTL_MS) {
      const status: LicenseStatus = {
        isValid: cached.valid,
        tier: cached.valid ? 'pro' : 'free',
        maxSyncLimit: cached.valid ? Infinity : 5
      }
      cachedValidation = status
      return status
    }
  }

  // Validate with Polar
  const isValid = await validateWithPolar(key)

  // Write to file cache
  writeCache({
    key,
    valid: isValid,
    checkedAt: Date.now()
  })

  // Create status object
  const status: LicenseStatus = {
    isValid,
    tier: isValid ? 'pro' : 'free',
    maxSyncLimit: isValid ? Infinity : 5
  }

  // Store in module-level cache for synchronous access
  cachedValidation = status

  // Log result (use console.log for success, console.error for failure)
  if (!isValid) {
    console.error('[storybook-mcp] Invalid or inactive license key. Using Free tier.')
  } else {
    console.log('[storybook-mcp] License validated. Pro features enabled.')
  }

  return status
}

/**
 * Check if a feature is allowed for the current license
 */
export function checkFeatureAccess(feature: Feature, status: LicenseStatus): boolean {
  if (status.tier === 'pro') return true

  switch (feature) {
    case 'basic_stories':
      return true
    case 'advanced_templates':
      return false
    case 'test_generation':
      return false
    case 'docs_generation':
      return false
    case 'unlimited_sync':
      return false
    case 'code_connect':
      return false
    default:
      return false
  }
}

/**
 * Throw error if feature is not allowed
 */
export function requireFeature(feature: Feature, status: LicenseStatus): void {
  if (!checkFeatureAccess(feature, status)) {
    throw new LicenseError(
      `Feature '${feature}' requires a Pro license.\n` +
      `Please add a valid license key to your config or environment variable STORYBOOK_MCP_LICENSE.\n` +
      `Get your license at: ${POLAR_UPGRADE_URL}`,
      feature
    )
  }
}
