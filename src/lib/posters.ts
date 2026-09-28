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
