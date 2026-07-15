/**
 * Shared wallpaper artwork for built-in themes.
 *
 * Every wallpaper here is pure CSS (gradients) or an inline SVG data-URI,
 * so themes cost ZERO network requests and work offline. Pixel-perfect
 * original bitmaps can be dropped into `public/pc-themes/<theme>/wallpapers/`
 * later and referenced with `imageWallpaper()` — the registry needs no other
 * change.
 */

/** Wrap raw SVG markup as a CSS `background` value. */
export const svgBg = (svg: string, fallback: string): string =>
  `url("data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}") center / cover no-repeat, ${fallback}`;

/** Reference a real bitmap dropped into public/pc-themes/… */
export const imageWallpaper = (path: string, fallback = '#000'): string =>
  `url(${path}) center / cover no-repeat, ${fallback}`;

/**
 * "Clouds" — the classic Win95/98 blue-sky wallpaper (the Arcade95 look):
 * deep blue sky fading toward the horizon with soft white cumulus clusters.
 */
export const CLOUDS_SKY = svgBg(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#2a5ca8"/>
        <stop offset="0.55" stop-color="#4f86c6"/>
        <stop offset="1" stop-color="#9cc3e5"/>
      </linearGradient>
      <filter id="soft"><feGaussianBlur stdDeviation="7"/></filter>
    </defs>
    <rect width="800" height="600" fill="url(#sky)"/>
    <g fill="#ffffff" opacity="0.92" filter="url(#soft)">
      <ellipse cx="150" cy="130" rx="120" ry="38"/>
      <ellipse cx="215" cy="105" rx="80" ry="30"/>
      <ellipse cx="95" cy="110" rx="60" ry="24"/>
      <ellipse cx="560" cy="90" rx="140" ry="34"/>
      <ellipse cx="640" cy="70" rx="70" ry="24"/>
      <ellipse cx="380" cy="230" rx="95" ry="26"/>
      <ellipse cx="440" cy="212" rx="60" ry="20"/>
      <ellipse cx="690" cy="270" rx="110" ry="30"/>
      <ellipse cx="120" cy="330" rx="130" ry="30"/>
      <ellipse cx="200" cy="312" rx="70" ry="22"/>
      <ellipse cx="480" cy="420" rx="150" ry="34"/>
      <ellipse cx="560" cy="398" rx="80" ry="24"/>
      <ellipse cx="80" cy="520" rx="110" ry="28"/>
      <ellipse cx="720" cy="540" rx="120" ry="30"/>
    </g>
    <g fill="#e8f2fb" opacity="0.55" filter="url(#soft)">
      <ellipse cx="300" cy="60" rx="90" ry="18"/>
      <ellipse cx="620" cy="180" rx="70" ry="14"/>
      <ellipse cx="250" cy="470" rx="90" ry="16"/>
    </g>
  </svg>`,
  '#4f86c6'
);

/** "Bliss"-like rolling green hill under a blue spring sky (Windows XP). */
export const BLISS_HILL = svgBg(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#1d64c8"/>
        <stop offset="0.5" stop-color="#4f9be8"/>
        <stop offset="0.72" stop-color="#a8d4f5"/>
      </linearGradient>
      <linearGradient id="hill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#8ec63f"/>
        <stop offset="0.5" stop-color="#57a639"/>
        <stop offset="1" stop-color="#2e7d32"/>
      </linearGradient>
      <filter id="soft"><feGaussianBlur stdDeviation="6"/></filter>
    </defs>
    <rect width="800" height="600" fill="url(#sky)"/>
    <g fill="#ffffff" opacity="0.9" filter="url(#soft)">
      <ellipse cx="180" cy="110" rx="110" ry="26"/>
      <ellipse cx="250" cy="90" rx="60" ry="20"/>
      <ellipse cx="600" cy="150" rx="130" ry="28"/>
      <ellipse cx="680" cy="128" rx="60" ry="20"/>
      <ellipse cx="420" cy="70" rx="70" ry="16"/>
    </g>
    <path d="M0,430 C140,340 320,320 470,380 C610,436 720,420 800,370 L800,600 L0,600 Z" fill="url(#hill)"/>
    <path d="M0,470 C180,400 360,392 520,440 C650,478 740,468 800,440 L800,600 L0,600 Z" fill="#3f8c31" opacity="0.65"/>
  </svg>`,
  '#4f9be8'
);

/** Vista "Aurora": deep teal-green light ribbons on near-black. */
export const AURORA_VISTA =
  'radial-gradient(140% 90% at 15% 100%, rgba(48,164,120,0.55) 0%, transparent 55%),' +
  'radial-gradient(120% 80% at 70% 110%, rgba(28,110,160,0.6) 0%, transparent 60%),' +
  'radial-gradient(90% 60% at 90% 0%, rgba(60,180,140,0.25) 0%, transparent 60%),' +
  'linear-gradient(160deg, #04121c 0%, #062431 55%, #041019 100%)';

/** Windows 7 "Harmony": luminous blue with a soft central glow. */
export const HARMONY_7 =
  'radial-gradient(70% 90% at 50% 45%, rgba(140,200,255,0.55) 0%, rgba(70,140,220,0.25) 45%, transparent 75%),' +
  'radial-gradient(120% 100% at 50% 120%, rgba(10,60,140,0.8) 0%, transparent 70%),' +
  'linear-gradient(180deg, #0a3f86 0%, #1863b8 50%, #0a2f66 100%)';

/** Windows 8 angular Metro backdrop. */
export const METRO_8 =
  'linear-gradient(115deg, transparent 0 55%, rgba(255,255,255,0.06) 55% 70%, transparent 70%),' +
  'linear-gradient(245deg, transparent 0 60%, rgba(0,0,0,0.18) 60% 78%, transparent 78%),' +
  'linear-gradient(135deg, #1a5fb4 0%, #2672ec 55%, #1f4fc0 100%)';

/** Windows 10 "Hero": dark blue with a diagonal light beam. */
export const HERO_10 =
  'linear-gradient(62deg, transparent 0 44%, rgba(120,190,255,0.34) 49%, rgba(190,230,255,0.5) 50%, rgba(120,190,255,0.34) 51%, transparent 56%),' +
  'radial-gradient(90% 90% at 50% 55%, rgba(0,90,180,0.5) 0%, transparent 70%),' +
  'linear-gradient(180deg, #01143a 0%, #032a66 55%, #01102e 100%)';

/** Windows 11 "Bloom": soft blue ribbon folds. */
export const BLOOM_11 =
  'radial-gradient(60% 80% at 30% 40%, rgba(120,180,255,0.75) 0%, transparent 60%),' +
  'radial-gradient(55% 70% at 68% 55%, rgba(60,110,220,0.8) 0%, transparent 65%),' +
  'radial-gradient(70% 90% at 55% 85%, rgba(160,200,255,0.5) 0%, transparent 60%),' +
  'linear-gradient(160deg, #2456c4 0%, #3f74e0 45%, #1c3f9e 100%)';
