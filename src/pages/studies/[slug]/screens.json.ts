// /studies/[slug]/screens.json: the screens a study shows only in its
// full-size viewer (src/lib/viewer.ts): its phone screens' (a study told in
// tabs opens on its first tab, so that tab's), else its gallery's.
import type { APIRoute, GetStaticPaths } from 'astro';
import { entriesIn, type Entry } from '../../../lib/entries';
import { hasViewerOnly, viewerScreens } from '../../../lib/viewer';

const items = (entry: Entry) => {
  const phones = entry.data.tabs ? entry.data.tabs[0].phones : entry.data.phones;
  return hasViewerOnly(phones) ? phones : entry.data.gallery;
};

export const getStaticPaths = (() =>
  entriesIn('studies')
    .filter((entry) => hasViewerOnly(items(entry)))
    .map((entry) => ({ params: { slug: entry.id }, props: { entry } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => viewerScreens(items(props.entry as Entry) ?? []);
