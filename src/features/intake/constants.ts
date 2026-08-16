import { BRAND } from '@/lib/brand';
import { publicEnv } from '@/lib/public-env';

/**
 * Privacy-policy version the /check consent records against. Bump this whenever
 * the published policy materially changes, so each lead's
 * `metadata.consent.policy_version` proves which version that prospect agreed to.
 * Keep in sync with the version shown on the privacy policy page.
 */
export const PRIVACY_POLICY_VERSION = '2026-06';

/**
 * Public marketing site clients return to after completing the questionnaire.
 * Offices without their own marketing site fall back to the CRM's own origin,
 * so the legal links below never point at another office's domain.
 */
export const WEBSITE_URL = BRAND.contact.website ?? publicEnv.NEXT_PUBLIC_APP_URL;

/**
 * Public URL of the privacy policy the /check consent checkbox links to.
 */
export const PRIVACY_POLICY_URL = `${WEBSITE_URL}/privacy.html`;

/**
 * Public URL of the accessibility statement, linked from the /check footer.
 * The statement lives on the marketing site; /check runs on the CRM domain.
 */
export const ACCESSIBILITY_URL = `${WEBSITE_URL}/accessibility.html`;
