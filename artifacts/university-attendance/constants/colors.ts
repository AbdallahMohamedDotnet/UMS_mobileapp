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
    text: '#f6fbff',
    tint: '#5fe0c0',
    background: '#071827',
    foreground: '#f6fbff',
    card: '#10293a',
    cardForeground: '#f6fbff',
    primary: '#5fe0c0',
    primaryForeground: '#071827',
    secondary: '#18394e',
    secondaryForeground: '#dcecf3',
    muted: '#123043',
    mutedForeground: '#91acb9',
    accent: '#1c4152',
    accentForeground: '#b6f7e6',
    destructive: '#f47d82',
    destructiveForeground: '#071827',
    border: '#234758',
    input: '#234758',
    success: '#5fe0c0',
    warning: '#ffc878',
    overlay: '#06131f',
  },

  radius: 22,
};

export default colors;
