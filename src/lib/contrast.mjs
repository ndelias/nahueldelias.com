// WCAG contrast for the color tokens in src/styles/tokens.css. Plain JS so the
// node test runner (tests/contrast.test.mjs) and the /_tokens page share it.

/** @typedef {'light' | 'dark'} Theme */
/** @typedef {{ fg: string, bg: string, min: number, use: string }} Pair */

/**
 * Every foreground/background combination the design uses. Text needs 4.5:1
 * (AA; all metadata is 11–12px, so nothing qualifies as large text). The
 * accent is also the focus ring, a UI component, so 3:1 against every ground
 * it can sit on is covered by its 4.5:1 text check. `line` is left out: it
 * draws dividers and the Archived badge's border, which are decorative, and
 * never text.
 * @type {Pair[]}
 */
export const PAIRS = [
  { fg: 'ink', bg: 'bg', min: 4.5, use: 'Body text, titles' },
  { fg: 'ink', bg: 'surface', min: 4.5, use: 'Text on surfaces' },
  { fg: 'muted', bg: 'bg', min: 4.5, use: 'Metadata, captions' },
  { fg: 'muted', bg: 'surface', min: 4.5, use: 'Metadata on surfaces' },
  { fg: 'accent', bg: 'bg', min: 4.5, use: 'Links, Concept badge, focus ring' },
  { fg: 'accent', bg: 'surface', min: 4.5, use: 'Links and focus ring on surfaces' },
  { fg: 'money', bg: 'bg', min: 4.5, use: 'Diagram: done, money landed' },
  { fg: 'money', bg: 'surface', min: 4.5, use: 'Diagram: done, on panels' },
  { fg: 'warn', bg: 'bg', min: 4.5, use: 'Diagram: failed, refused' },
  { fg: 'warn', bg: 'surface', min: 4.5, use: 'Diagram: failed, on panels' },
];

const HEX = '#[0-9a-fA-F]{6}';
const DECL = new RegExp(`--([\\w-]+)\\s*:\\s*light-dark\\(\\s*(${HEX})\\s*,\\s*(${HEX})\\s*\\)`, 'g');

/**
 * Color tokens declared as `--name: light-dark(#light, #dark)`.
 * @param {string} css
 * @returns {Map<string, Record<Theme, string>>}
 */
export function parseColorTokens(css) {
  const tokens = new Map();
  for (const [, name, light, dark] of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(DECL)) {
    if (tokens.has(name)) throw new Error(`--${name} is declared twice in tokens.css`);
    tokens.set(name, { light: light.toUpperCase(), dark: dark.toUpperCase() });
  }
  return tokens;
}

/** @param {string} hex */
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * WCAG 2 contrast ratio, 1–21.
 * @param {string} a
 * @param {string} b
 */
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Every pair in both themes, with its ratio.
 * @param {Map<string, Record<Theme, string>>} tokens
 */
export function checkPairs(tokens) {
  return PAIRS.flatMap((pair) =>
    /** @type {Theme[]} */ (['light', 'dark']).map((theme) => {
      const fg = tokens.get(pair.fg)?.[theme];
      const bg = tokens.get(pair.bg)?.[theme];
      if (!fg || !bg) throw new Error(`Missing color token for ${pair.fg} on ${pair.bg}`);
      const ratio = contrast(fg, bg);
      return { ...pair, theme, fgHex: fg, bgHex: bg, ratio, pass: ratio >= pair.min };
    }),
  );
}
