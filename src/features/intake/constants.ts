/**
 * Privacy-policy version the /check consent records against. Bump this whenever
 * the published policy materially changes, so each lead's
 * `metadata.consent.policy_version` proves which version that prospect agreed to.
 * Keep in sync with the version shown on the privacy policy page.
 */
export const PRIVACY_POLICY_VERSION = '2026-06';

/**
 * Public marketing site clients return to after completing the questionnaire.
 */
export const WEBSITE_URL = 'https://kaufman-finance.com';

/**
 * Public URL of the privacy policy the /check consent checkbox links to.
 */
export const PRIVACY_POLICY_URL = `${WEBSITE_URL}/privacy.html`;
