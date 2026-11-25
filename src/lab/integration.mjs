// The design lab's route, added only when the dev server runs (`astro dev`):
// a production build never sees src/lab/page.astro, so none of its pages,
// scripts or images reach dist/.
/** @returns {import('astro').AstroIntegration} */
export default function lab() {
  return {
    name: 'design-lab',
    hooks: {
      'astro:config:setup': ({ command, injectRoute }) => {
        if (command === 'dev') injectRoute({ pattern: '/_lab/[...path]', entrypoint: './src/lab/page.astro' });
      },
    },
  };
}
