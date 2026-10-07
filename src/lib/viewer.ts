// The screens a gallery shows only in its full-size viewer (items with
// `more`), for the screens.json next to a page: fetched when the viewer
// opens, so their details aren't in the page's HTML (the HTML budget).
import type { ImageMetadata } from 'astro';
import { getImage } from 'astro:assets';

export interface ViewerItem {
  src: ImageMetadata;
  alt: string;
  caption?: string;
  more?: boolean;
}

export const hasViewerOnly = (items?: ViewerItem[]) => items?.some((g) => g.more) ?? false;

export async function viewerScreens(items: ViewerItem[]): Promise<Response> {
  const meta = (src: ImageMetadata) => (src as ImageMetadata & { clone?: ImageMetadata }).clone ?? src;
  const extra = await Promise.all(
    items.flatMap((item, index) => {
      if (!item.more) return [];
      const { width, height, format } = meta(item.src);
      return (async () => ({
        index,
        // The same full-size file the gallery would link (getImage is cached).
        full: format === 'svg' ? item.src.src : (await getImage({ src: item.src, format: 'webp', width })).src,
        width,
        height,
        alt: item.alt,
        caption: item.caption ?? '',
      }))();
    }),
  );
  return new Response(JSON.stringify(extra), { headers: { 'content-type': 'application/json' } });
}
