/**
 * ProTech Services Repair Manager — Professional Design Tokens
 * Single source of truth for colors, spacing, typography, radii, shadows, motion
 */

// ─── Color Palette (HSL-based for dark mode math) ───
export const colors = {
  // Brand / Primary — Neutral slate (professional, not pure blue)
  primary: {
    50: 'hsl(210 20% 98%)',
    100: 'hsl(210 20% 95%)',
    200: 'hsl(210 18% 90%)',
    300: 'hsl(210 16% 82%)',
    400: 'hsl(210 12% 68%)',
    500: 'hsl(210 10% 52%)',
    600: 'hsl(210 10% 42%)',
    700: 'hsl(210 12% 32%)',
    800: 'hsl(210 15% 22%)',
    900: 'hsl(210 18% 14%)',
    950: 'hsl(210 20% 8%)',
  },

  // Functional colors — Only for state, not decoration
  success: {
    light: 'hsl(142 76% 36%)',
    DEFAULT: 'hsl(142 70% 45%)',
    dark: 'hsl(142 65% 52%)',
    bg: 'hsl(142 50% 95%)',
    border: 'hsl(142 50% 85%)',
    text: 'hsl(142 70% 30%)',
  },
  warning: {
    light: 'hsl(38 92% 50%)',
    DEFAULT: 'hsl(38 92% 50%)',
    dark: 'hsl(38 85% 42%)',
    bg: 'hsl(38 80% 96%)',
    border: 'hsl(38 60% 88%)',
    text: 'hsl(38 70% 28%)',
  },
  danger: {
    light: 'hsl(0 84% 60%)',
    DEFAULT: 'hsl(0 72% 51%)',
    dark: 'hsl(0 65% 42%)',
    bg: 'hsl(0 70% 97%)',
    border: 'hsl(0 50% 88%)',
    text: 'hsl(0 70% 30%)',
  },
  info: {
    light: 'hsl(199 89% 48%)',
    DEFAULT: 'hsl(199 89% 48%)',
    dark: 'hsl(199 80% 55%)',
    bg: 'hsl(199 80% 96%)',
    border: 'hsl(199 60% 88%)',
    text: 'hsl(199 70% 28%)',
  },

  // Semantic aliases
  surface: {
    base: 'hsl(0 0% 100%)',
    raised: 'hsl(0 0% 100%)',
    overlay: 'hsl(0 0% 100%)',
  },
  border: {
    DEFAULT: 'hsl(210 18% 90%)',
    strong: 'hsl(210 18% 85%)',
    focus: 'hsl(210 90% 50%)',
  },
  text: {
    primary: 'hsl(210 18% 14%)',
    secondary: 'hsl(210 12% 38%)',
    muted: 'hsl(210 10% 52%)',
    inverse: 'hsl(0 0% 100%)',
  },
};

// ─── Dark mode overrides ───
export const darkColors = {
  primary: {
    50: 'hsl(210 20% 8%)',
    100: 'hsl(210 20% 10%)',
    200: 'hsl(210 18% 14%)',
    300: 'hsl(210 16% 22%)',
    400: 'hsl(210 12% 38%)',
    500: 'hsl(210 10% 52%)',
    600: 'hsl(210 10% 62%)',
    700: 'hsl(210 12% 72%)',
    800: 'hsl(210 15% 82%)',
    900: 'hsl(210 18% 90%)',
    950: 'hsl(210 20% 96%)',
  },
  surface: {
    base: 'hsl(210 18% 10%)',
    raised: 'hsl(210 18% 12%)',
    overlay: 'hsl(210 18% 8%)',
  },
  border: {
    DEFAULT: 'hsl(210 18% 22%)',
    strong: 'hsl(210 18% 28%)',
    focus: 'hsl(210 90% 55%)',
  },
  text: {
    primary: 'hsl(210 10% 94%)',
    secondary: 'hsl(210 10% 70%)',
    muted: 'hsl(210 10% 55%)',
    inverse: 'hsl(210 18% 8%)',
  },
};

// ─── Spacing Scale (4px base) ───
export const spacing = {
  0: '0',
  1: '0.25rem',   // 4px
  2: '0.5rem',    // 8px
  3: '0.75rem',   // 12px
  4: '1rem',      // 16px
  5: '1.25rem',   // 20px
  6: '1.5rem',    // 24px
  8: '2rem',      // 32px
  10: '2.5rem',   // 40px
  12: '3rem',     // 48px
  16: '4rem',     // 64px
};

// ─── Typography Scale ───
export const typography = {
  fontFamilies: {
    sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
    heading: ['"Outfit"', '"Plus Jakarta Sans"', 'sans-serif'],
    mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
  },
  fontSizes: {
    xs: ['0.75rem', { lineHeight: '1.4' }],      // 12px
    sm: ['0.875rem', { lineHeight: '1.5' }],     // 14px
    base: ['1rem', { lineHeight: '1.5' }],       // 16px
    lg: ['1.125rem', { lineHeight: '1.4' }],     // 18px
    xl: ['1.25rem', { lineHeight: '1.4' }],      // 20px
    '2xl': ['1.5rem', { lineHeight: '1.3' }],    // 24px
    '3xl': ['1.875rem', { lineHeight: '1.2' }],  // 30px
    '4xl': ['2.25rem', { lineHeight: '1.1' }],   // 36px
  },
  fontWeights: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  letterSpacing: {
    tight: '-0.02em',
    normal: '0',
    wide: '0.02em',
    wider: '0.05em',   // for uppercase labels
    widest: '0.1em',
  },
};

// ─── Border Radius ───
export const radii = {
  none: '0',
  sm: '0.375rem',   // 6px
  DEFAULT: '0.5rem', // 8px
  md: '0.625rem',   // 10px
  lg: '0.75rem',    // 12px — standard card
  xl: '1rem',       // 16px
  '2xl': '1.5rem',  // 24px
  full: '9999px',
};

// ─── Shadows ───
export const shadows = {
  none: 'none',
  xs: '0 1px 2px 0 hsl(210 18% 14% / 0.05)',
  sm: '0 1px 3px 0 hsl(210 18% 14% / 0.1), 0 1px 2px -1px hsl(210 18% 14% / 0.1)',
  DEFAULT: '0 4px 6px -1px hsl(210 18% 14% / 0.1), 0 2px 4px -2px hsl(210 18% 14% / 0.1)',
  md: '0 10px 15px -3px hsl(210 18% 14% / 0.1), 0 4px 6px -4px hsl(210 18% 14% / 0.1)',
  lg: '0 20px 25px -5px hsl(210 18% 14% / 0.1), 0 8px 10px -6px hsl(210 18% 14% / 0.1)',
  xl: '0 25px 50px -12px hsl(210 18% 14% / 0.25)',
  inner: 'inset 0 2px 4px 0 hsl(210 18% 14% / 0.05)',
  focus: '0 0 0 3px hsl(210 90% 50% / 0.2)',
};

// ─── Motion / Animation ───
export const motion = {
  durations: {
    instant: '0ms',
    fast: '100ms',
    DEFAULT: '150ms',
    slow: '250ms',
    slower: '350ms',
  },
  easings: {
    linear: 'linear',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  // Only these animations should exist
  allowed: [
    'modal-enter',      // 150ms easeOut
    'modal-exit',       // 100ms easeIn
    'toast-enter',      // 100ms easeOut
    'toast-exit',       // 150ms easeIn
    'popover-enter',    // 100ms easeOut
    'popover-exit',     // 100ms easeIn
    'sidebar-toggle',   // 150ms easeInOut
  ],
};

// ─── Z-Index Scale ───
export const zIndex = {
  hide: -1,
  base: 0,
  dropdown: 1000,
  sticky: 1100,
  modal: 1200,
  popover: 1300,
  tooltip: 1400,
  toast: 1500,
};

// ─── Breakpoints ───
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};

// ─── Container Max Widths ───
export const containers = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1400px',
  full: '100%',
};

// ─── Sidebar Widths ───
export const sidebar = {
  collapsed: '13rem',   // 52px
  expanded: '20rem',    // 80px? No, 20rem = 320px — too wide. Let's use 260px
};

// Actually: 52px collapsed, 260px expanded
export const sidebarWidth = {
  collapsed: '52px',
  expanded: '260px',
};

// ─── Top Bar Height ───
export const topBarHeight = '64px';

// ─── Focus Ring (consistent across all interactive) ───
export const focusRing = {
  width: '2px',
  offset: '2px',
  color: colors.primary[600],
  darkColor: colors.primary[400],
};

export type ColorScale = keyof typeof colors.primary;
export type Spacing = keyof typeof spacing;
export type Radius = keyof typeof radii;
export type Shadow = keyof typeof shadows;
export type FontSize = keyof typeof typography.fontSizes;
export type ZIndex = keyof typeof zIndex;