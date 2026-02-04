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
 * In a real implementation, this would call an API.
 * For now, we check if a key is present and follows a simple format.
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

  // Developer / Team Bypass Key
  // You can give this key to your team members
  if (key === 'FORGE-DEV-BYPASS-2026') {
    return {
      isValid: true,
      tier: 'pro',
      maxSyncLimit: Infinity
    }
  }

  // Simple validation for now (can be anything non-empty that looks like a key)
  // In production, this would be a proper format check or API call
  const isValid = key.length > 8
  
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
      `Visit https://forgekit.cloud to get a license.`
    )
  }
}
