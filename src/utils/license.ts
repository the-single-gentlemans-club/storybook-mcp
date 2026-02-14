/**
 * License Manager
 * Handles license validation and feature gating via Polar.sh API
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import type { StorybookMCPConfig } from '../types.js'
import { POLAR_UPGRADE_URL } from './constants.js'

const POLAR_ORG_ID = process.env.POLAR_ORG_ID || 'c39241cb-629a-4beb-8ec8-31820430d5fd'
const POLAR_API_URL = process.env.POLAR_API_URL || 'https://api.polar.sh'

export type Feature = 
  | 'basic_stories'
  | 'advanced_templates'
  | 'test_generation'
  | 'docs_generation'
  | 'unlimited_sync'

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

// Cache duration: 24 hours
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

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
 * Validate license key and return status
 * 
 * Supports Polar.sh license keys (UUID format)
 * Validates via Polar API with local caching
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

  // Check cache first
  const cached = readCache()
  if (cached && cached.key === key) {
    const age = Date.now() - cached.checkedAt
    if (age < CACHE_TTL_MS) {
      return {
        isValid: cached.valid,
        tier: cached.valid ? 'pro' : 'free',
        maxSyncLimit: cached.valid ? Infinity : 5
      }
    }
  }

  // Return free tier for now, validate async
  // The actual validation happens in validateLicenseAsync
  return {
    isValid: true,
    tier: 'free',
    maxSyncLimit: 5
  }
}

/**
 * Async license validation with API call
 * Call this at startup to validate and cache the result
 */
export async function validateLicenseAsync(config: StorybookMCPConfig): Promise<LicenseStatus> {
  const key = config.licenseKey || process.env.STORYBOOK_MCP_LICENSE
  
  // No key = Free Tier
  if (!key) {
    return {
      isValid: true,
      tier: 'free',
      maxSyncLimit: 5
    }
  }

  // Check cache first
  const cached = readCache()
  if (cached && cached.key === key) {
    const age = Date.now() - cached.checkedAt
    if (age < CACHE_TTL_MS) {
      return {
        isValid: cached.valid,
        tier: cached.valid ? 'pro' : 'free',
        maxSyncLimit: cached.valid ? Infinity : 5
      }
    }
  }

  // Validate with Polar
  const isValid = await validateWithPolar(key)
  
  // Cache the result
  writeCache({
    key,
    valid: isValid,
    checkedAt: Date.now()
  })

  if (!isValid) {
    console.error('[storybook-mcp] Invalid or inactive license key. Using Free tier.')
  } else {
    console.error('[storybook-mcp] License validated. Pro features enabled.')
  }

  return {
    isValid,
    tier: isValid ? 'pro' : 'free',
    maxSyncLimit: isValid ? Infinity : 5
  }
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
    default:
      return false
  }
}

/**
 * Throw error if feature is not allowed
 */
export function requireFeature(feature: Feature, status: LicenseStatus): void {
  if (!checkFeatureAccess(feature, status)) {
    throw new Error(
      `Feature '${feature}' requires a Pro license.\n` +
      `Please add a valid license key to your config or environment variable STORYBOOK_MCP_LICENSE.\n` +
      `Get your license at: ${POLAR_UPGRADE_URL}`
    )
  }
}
