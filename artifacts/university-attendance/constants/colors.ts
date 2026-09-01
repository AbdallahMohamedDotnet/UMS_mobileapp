/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    text: '#2c201b',
    tint: '#c84d2f',
    background: '#f1ead8',
    foreground: '#2c201b',
    card: '#fbf7ec',
    cardForeground: '#2c201b',
    primary: '#c84d2f',
    primaryForeground: '#fff8eb',
    secondary: '#e9dfca',
    secondaryForeground: '#493a31',
    muted: '#e4d8c0',
    mutedForeground: '#88786a',
    accent: '#5f6a3c',
    // Pale tint of `accent`, for surfaces that sit *behind* accentForeground
    // text/icons. Using `accent` itself there renders olive-on-olive.
    accentSoft: '#e3e4cf',
    accentForeground: '#5f6a3c',
    destructive: '#a83d2c',
    destructiveForeground: '#fff8eb',
    border: '#d9cbb2',
    input: '#d2c1a6',
    success: '#5f6a3c',
    warning: '#b47738',
    overlay: '#1b110d',
    cameraText: '#fff8eb',
    cameraTextMuted: 'rgba(255,248,235,0.74)',
    cameraSurface: 'rgba(27,17,13,0.68)',
    terracotta: '#c84d2f',
    ink: '#2c201b',
    paper: '#fbf7ec',
    olive: '#5f6a3c',
    lavender: '#ded7e7',
    sky: '#d7e4e3',
  },

  radius: 22,
};

export default colors;
