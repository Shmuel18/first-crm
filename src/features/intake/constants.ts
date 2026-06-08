/**
 * Privacy-policy version the /check consent records against. Bump this whenever
 * the published policy materially changes, so each lead's
 * `metadata.consent.policy_version` proves which version that prospect agreed to.
 * Keep in sync with the version shown on the privacy policy page.
 */
export const PRIVACY_POLICY_VERSION = '2026-06';

/**
 * Public URL of the privacy policy the /check consent checkbox links to.
 * Currently the live landing deployment (temporary); point this at the real
 * domain (e.g. https://kaufman-finance.com/privacy.html) once it's hosted there.
 */
export const PRIVACY_POLICY_URL = 'https://landing-olive-one-87.vercel.app/privacy.html';
