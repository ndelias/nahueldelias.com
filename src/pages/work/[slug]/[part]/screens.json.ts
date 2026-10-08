// /work/[hub]/[part]/screens.json: the screens a part shows only in its
// full-size viewer (src/lib/viewer.ts): its phone screens' (a part told in
// tabs opens on its first tab, so that tab's), else its gallery's.
import type { APIRoute, GetStaticPaths } from 'astro';
import { entriesIn, partSlug, partsOf, type Entry } from '../../../../lib/entries';
import { hasViewerOnly, viewerScreens } from '../../../../lib/viewer';

// The page's viewer-only screens: its phones' if it has any, else its gallery's.
const items = (part: Entry) => {
  const phones = part.data.tabs ? part.data.tabs[0].phones : part.data.phones;
  return hasViewerOnly(phones) ? phones : part.data.gallery;
};

export const getStaticPaths = (() =>
  entriesIn('work').flatMap((hub) =>
    partsOf(hub)
      .filter((part) => hasViewerOnly(items(part)))
      .map((part) => ({ params: { slug: hub.id, part: partSlug(part) }, props: { part } })),
  )) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => viewerScreens(items(props.part as Entry) ?? []);
