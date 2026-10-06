import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';
import type { Entry } from './entries';

// Homepage strip stills (§7.5): AVIF with a WebP fallback, at 1x and 2x of
// the focused frame. The poster falls back to the cover; the dark variant is
// optional. getImage caches, so the page head (the LCP preload) and the strip
// ask for the same files.

export const POSTER = { width: 520, height: 325 } as const;

export interface Srcsets {
  /** Absent for an SVG, which is served as is. */
  avif?: string;
  webp?: string;
  /** The 1x WebP (or the SVG), for the <img> src. */
  src: string;
}

async function srcsets(src: ImageMetadata): Promise<Srcsets> {
  // A vector cover standing in for a poster needs no raster sizes. The
  // format is read from a clone: reading any field of the import itself
  // tells Astro the original is used, and it ships it to dist/.
  const { format } = (src as ImageMetadata & { clone?: ImageMetadata }).clone ?? src;
  if (format === 'svg') return { src: src.src };
  const sized = (format: 'avif' | 'webp', density: number) =>
    getImage({ src, format, width: POSTER.width * density, height: POSTER.height * density, fit: 'cover' });
  const [avif1, avif2, webp1, webp2] = await Promise.all([sized('avif', 1), sized('avif', 2), sized('webp', 1), sized('webp', 2)]);
  return {
    avif: `${avif1.src} 1x, ${avif2.src} 2x`,
    webp: `${webp1.src} 1x, ${webp2.src} 2x`,
    src: webp1.src,
  };
}

export async function posterOf(entry: Entry): Promise<{ light: Srcsets; dark?: Srcsets }> {
  const { poster, cover } = entry.data;
  return {
    light: await srcsets(poster?.src ?? cover.src),
    dark: poster?.dark && (await srcsets(poster.dark)),
  };
}

// Case study heroes (§6: eager for the LCP element). Full width: 1344px at
// 1440, 358px on a 390 phone. AVIF with a WebP fallback at 672, 1344 and
// 2688 wide, so a 2x or 3x phone takes the 1344 and a 2x desktop the 2688.
// Never wider than the source. scripts/check-posters.mjs holds them to 60KB
// up to 1344 wide (1x) and 120KB at 2688 (2x).
export const HERO_WIDTHS = [672, 1344, 2688] as const;
export const HERO_SIZES = '(min-width: 640px) calc(100vw - 96px), calc(100vw - 32px)';
/** A part page's walkthrough, centered on eight columns (3 / span 8). */
export const HERO_INSET_SIZES = '(min-width: 640px) 62vw, calc(100vw - 32px)';

export interface HeroSources {
  avif: string;
  webp: string;
  /** The 1344 WebP (or the widest there is), for the <img> src. */
  src: string;
}

async function heroSrcsets(src: ImageMetadata): Promise<HeroSources> {
  const { width } = (src as ImageMetadata & { clone?: ImageMetadata }).clone ?? src;
  const widths: number[] = HERO_WIDTHS.filter((w) => w <= width);
  if (!widths.length) widths.push(width);
  const sized = (format: 'avif' | 'webp', w: number) => getImage({ src, format, width: w });
  const set = async (format: 'avif' | 'webp') =>
    (await Promise.all(widths.map((w) => sized(format, w)))).map((img, i) => ({ url: img.src, w: widths[i] }));
  const [avif, webp] = await Promise.all([set('avif'), set('webp')]);
  const join = (list: { url: string; w: number }[]) => list.map((c) => `${c.url} ${c.w}w`).join(', ');
  return { avif: join(avif), webp: join(webp), src: (webp.find((c) => c.w === 1344) ?? webp[webp.length - 1]).url };
}

/** Raster hero sources for both themes, or undefined for an SVG (served as is). */
export async function heroSources(src: ImageMetadata, dark?: ImageMetadata): Promise<{ light: HeroSources; dark?: HeroSources } | undefined> {
  const { format } = (src as ImageMetadata & { clone?: ImageMetadata }).clone ?? src;
  if (format === 'svg') return undefined;
  return { light: await heroSrcsets(src), dark: dark && (await heroSrcsets(dark)) };
}
