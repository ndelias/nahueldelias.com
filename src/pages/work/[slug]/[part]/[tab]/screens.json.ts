// /work/[hub]/[part]/[tab]/screens.json: a tab's phone screens shown only
// in the full-size viewer (src/lib/viewer.ts).
import type { APIRoute, GetStaticPaths } from 'astro';
import { entriesIn, partSlug, partsOf } from '../../../../../lib/entries';
import { hasViewerOnly, viewerScreens } from '../../../../../lib/viewer';

export const getStaticPaths = (() =>
  entriesIn('work').flatMap((hub) =>
    partsOf(hub).flatMap((part) =>
      (part.data.tabs ?? [])
        .slice(1)
        .filter((tab) => hasViewerOnly(tab.phones))
        .map((tab) => ({ params: { slug: hub.id, part: partSlug(part), tab: tab.id }, props: { phones: tab.phones! } })),
    ),
  )) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => viewerScreens(props.phones);
