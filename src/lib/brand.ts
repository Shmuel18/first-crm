/**
 * White-label brand registry. One codebase serves multiple advisor offices;
 * the active office is selected at build/deploy time via NEXT_PUBLIC_BRAND.
 *
 * Everything visual that differs per office belongs here (names, logo asset
 * paths, PWA colors) or in the matching `[data-brand=...]` palette block in
 * `globals.css` — components must keep using the brand-* Tailwind tokens and
 * this config, never a concrete office's name/asset.
 */
export type BrandKey = 'kaufman' | 'perlstein';

export type Brand = {
  key: BrandKey;
  /** Full display name, Hebrew (primary UI language). */
  nameHe: string;
  /** Full display name, English (LTR locale + image alt/aria). */
  nameEn: string;
  /** Short name for PWA icon label / iOS home screen. */
  shortNameHe: string;
  shortNameEn: string;
  /** Sub-line under the brand name in PDF headers. */
  taglineHe: string;
  taglineEn: string;
  /** Wordmark for light surfaces (login card, public pages). */
  logo: string;
  /** Wordmark for the dark topbar/sidebar surface. */
  logoOnDark: string;
  /** Square mark (loading overlay, transactional email header). */
  logoSquare: string;
  /** PWA/browser chrome color — matches the brand's dark surface token. */
  themeColor: string;
  /**
   * CSS palette mirrored for surfaces stylesheets can't reach (email HTML,
   * PDF renderers). Keep in sync with the [data-brand] block in globals.css.
   */
  colors: {
    ink: string;
    gold: string;
    goldLight: string;
    goldDark: string;
    goldText: string;
  };
  /** Two-line wordmark rendered in the transactional email header. */
  emailWordmark: { top: string; bottom: string };
  /** Absolute URL of the square mark for email clients; unset = text-only header. */
  emailLogoUrl?: string;
  /** Footer contact block for transactional emails; unset items are omitted. */
  contact: {
    phone?: string;
    email?: string;
    website?: string;
    /** wa.me link for client-facing CTAs; unset = no WhatsApp CTA. */
    whatsapp?: string;
  };
};

const BRANDS: Record<BrandKey, Brand> = {
  kaufman: {
    key: 'kaufman',
    nameHe: 'קופמן פייננס גרופ',
    nameEn: 'Kaufman Finance Group',
    shortNameHe: 'קופמן',
    shortNameEn: 'Kaufman',
    taglineHe: 'קופמן ייעוץ משכנתאות',
    taglineEn: 'Kaufman mortgage advisors',
    logo: '/logo.png',
    logoOnDark: '/logo.png',
    logoSquare: '/logo-coin-square.png',
    themeColor: '#0A0A0A',
    colors: {
      ink: '#0A0A0A',
      gold: '#C9A961',
      goldLight: '#E8C77B',
      goldDark: '#B8945A',
      goldText: '#8A6E2D',
    },
    emailWordmark: { top: 'KAUFMAN', bottom: 'FINANCE GROUP' },
    emailLogoUrl: 'https://kaufman-finance.com/assets/logo-coin-square.png',
    contact: {
      phone: '02-568-1681',
      email: 'office@kaufman-finance.com',
      website: 'https://kaufman-finance.com',
      whatsapp: 'https://wa.me/97225681681',
    },
  },
  perlstein: {
    key: 'perlstein',
    nameHe: 'פרלשטיין משכנתאות',
    nameEn: 'Perlstein Mortgages',
    shortNameHe: 'פרלשטיין',
    shortNameEn: 'Perlstein',
    taglineHe: 'פרלשטיין ייעוץ משכנתאות',
    taglineEn: 'Perlstein mortgage advisors',
    logo: '/brands/perlstein/logo.png',
    logoOnDark: '/brands/perlstein/logo-on-dark.png',
    logoSquare: '/brands/perlstein/mark.png',
    themeColor: '#12375B',
    colors: {
      ink: '#12375B',
      gold: '#D0A549',
      goldLight: '#E2C077',
      goldDark: '#B98F3A',
      goldText: '#8C6C26',
    },
    emailWordmark: { top: 'פרלשטיין', bottom: 'משכנתאות' },
    contact: {
      phone: '053-314-0442',
      email: 'M33140442@gmail.com',
      whatsapp: 'https://wa.me/972533140442',
    },
  },
};

function resolveBrand(): Brand {
  // Read process.env directly (statically inlined by Next on the client)
  // instead of via publicEnv: BRAND is imported by domain/PDF/email modules,
  // and pulling the full zod env schema into those import graphs would make
  // every consumer (and its tests) require a complete env. publicEnv still
  // validates NEXT_PUBLIC_BRAND at build time; this narrowing is the safe
  // runtime fallback.
  const key = process.env.NEXT_PUBLIC_BRAND;
  return key === 'perlstein' ? BRANDS.perlstein : BRANDS.kaufman;
}

/** The active brand for this deployment. */
export const BRAND: Brand = resolveBrand();
