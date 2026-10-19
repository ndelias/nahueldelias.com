// /studies/[slug]/[tab]/screens.json: a tab's phone screens shown only in
// the full-size viewer (src/lib/viewer.ts).
import type { APIRoute, GetStaticPaths } from 'astro';
import { entriesIn } from '../../../../lib/entries';
import { hasViewerOnly, viewerScreens } from '../../../../lib/viewer';

export const getStaticPaths = (() =>
  entriesIn('studies').flatMap((entry) =>
    (entry.data.tabs ?? [])
      .slice(1)
      .filter((tab) => hasViewerOnly(tab.phones))
      .map((tab) => ({ params: { slug: entry.id, tab: tab.id }, props: { phones: tab.phones! } })),
  )) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => viewerScreens(props.phones);
