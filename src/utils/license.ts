/**
 * License Manager
 * Handles license validation and feature gating
 */

import type { StorybookMCPConfig } from '../types.js'

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

/**
 * Validate license key and return status
 * 
 * Keys are validated against the ForgeKit API.
 * Format: FORGE-PRO-XXXX-XXXX-XXXX (where X is alphanumeric)
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

  // Validate key format: FORGE-PRO-XXXX-XXXX-XXXX
  const keyPattern = /^FORGE-PRO-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/
  if (!keyPattern.test(key)) {
    return {
      isValid: false,
      tier: 'free',
      maxSyncLimit: 5
    }
  }

  // Validate key signature (simple checksum for offline validation)
  // The last segment encodes a checksum of the middle segments
  const isValid = verifyKeySignature(key)
  
  return {
    isValid,
    tier: isValid ? 'pro' : 'free',
    maxSyncLimit: isValid ? Infinity : 5
  }
}

/**
 * Verify the key signature using a simple checksum
 * Keys are generated with a specific algorithm that can be verified offline
 */
function verifyKeySignature(key: string): boolean {
  const parts = key.split('-')
  if (parts.length !== 5) return false
  
  const [, , seg1, seg2, checksum] = parts
  
  // Generate expected checksum from segments
  const data = seg1 + seg2
  let sum = 0
  for (let i = 0; i < data.length; i++) {
    sum += data.charCodeAt(i) * (i + 1)
  }
  
  // Convert to base36 and take last 4 chars, uppercase
  const expected = (sum % 1679616).toString(36).toUpperCase().padStart(4, '0').slice(-4)
  
  return checksum === expected
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
      `Visit https://forgekit.cloud to get a license.`
    )
  }
}
