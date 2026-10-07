// /work/[hub]/[part]/screens.json: the screens a part shows only in its
// full-size viewer (src/lib/viewer.ts). A part told in tabs opens on its
// first tab, so it's that tab's phone screens.
import type { APIRoute, GetStaticPaths } from 'astro';
import { entriesIn, partSlug, partsOf, type Entry } from '../../../../lib/entries';
import { hasViewerOnly, viewerScreens } from '../../../../lib/viewer';

const items = (part: Entry) => (part.data.tabs ? part.data.tabs[0].phones : part.data.gallery);

export const getStaticPaths = (() =>
  entriesIn('work').flatMap((hub) =>
    partsOf(hub)
      .filter((part) => hasViewerOnly(items(part)))
      .map((part) => ({ params: { slug: hub.id, part: partSlug(part) }, props: { part } })),
  )) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => viewerScreens(items(props.part as Entry) ?? []);
