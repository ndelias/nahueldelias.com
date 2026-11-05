// A stage's CSS, scoped to its piece by prefixing every selector, and
// squeezed. /motion inlines each stage's styles beside its markup (see
// MotionPiece.astro) instead of using Astro's scoped <style>, which would
// put every stage's CSS on every page. Handles rules, comma lists, @media
// and @supports (prefixed inside), and @keyframes (left alone). Keep
// selectors simple: a comma inside :is() or :where() would be split.
export function scopeCss(css: string, scope: string): string {
  const stack: ('rule' | 'group' | 'keyframes')[] = [];
  let out = '';
  let buf = '';
  for (const c of css.replace(/\/\*[\s\S]*?\*\//g, '')) {
    if (c === '{') {
      const prelude = buf.trim();
      buf = '';
      if (prelude.startsWith('@')) {
        stack.push(/^@(-\w+-)?keyframes/.test(prelude) ? 'keyframes' : 'group');
        out += `${prelude}{`;
      } else {
        const inKeyframes = stack.at(-1) === 'keyframes';
        stack.push('rule');
        out += `${inKeyframes ? prelude : prelude.split(',').map((s) => `${scope} ${s.trim()}`).join(',')}{`;
      }
    } else if (c === '}') {
      out += `${buf.trim()}}`;
      buf = '';
      stack.pop();
    } else buf += c;
  }
  return out
    .replace(/\s+/g, ' ')
    .replace(/\s*([{};,])\s*/g, '$1')
    .replace(/;}/g, '}');
}
