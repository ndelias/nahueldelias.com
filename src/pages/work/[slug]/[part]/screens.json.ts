// /work/[hub]/[part]/screens.json: the screens a part shows only in its
// full-size viewer (gallery items with `more`), fetched when the viewer
// opens, so their details aren't in the page's HTML (the HTML budget).
import type { APIRoute, GetStaticPaths } from 'astro';
import type { ImageMetadata } from 'astro';
import { getImage } from 'astro:assets';
import { entriesIn, partSlug, partsOf } from '../../../../lib/entries';

export const getStaticPaths = (() =>
  entriesIn('work').flatMap((hub) =>
    partsOf(hub)
      .filter((part) => part.data.gallery?.some((g) => g.more))
      .map((part) => ({ params: { slug: hub.id, part: partSlug(part) }, props: { part } })),
  )) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const gallery = props.part.data.gallery as { src: ImageMetadata; alt: string; caption?: string; more: boolean }[];
  const meta = (src: ImageMetadata) => (src as ImageMetadata & { clone?: ImageMetadata }).clone ?? src;
  const extra = await Promise.all(
    gallery.flatMap((item, index) => {
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
};
