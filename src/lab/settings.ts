// What the lab's editor can change on a layout, and what's been saved.
//
// A layout that can be edited describes itself as an Editable: its sections
// (which can be reordered), its controls (sliders, each one a CSS custom
// property on the layout's root) and its text (each piece marked data-edit
// on the page). The editor (src/lab/editor/) changes all three live; Save
// writes them to src/lab/home/settings/<layout>.json, through the dev
// server (src/lab/integration.mjs), and the layout renders from that file.
// What's on screen and what's in the code stay the same thing.

export interface Control {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  /** Appended to the value in CSS: '12px', or a bare number for counts. */
  unit: 'px' | '';
  value: number;
}

export interface Editable {
  sections: { key: string; label: string }[];
  controls: Control[];
  text: Record<string, { label: string; value: string }>;
}

export interface Saved {
  order?: string[];
  values?: Record<string, number>;
  text?: Record<string, string>;
}

const saved = import.meta.glob<Saved>('./home/settings/*.json', { eager: true, import: 'default' });

/** The layout's settings: what's saved for it over its defaults. */
export function settingsFor(id: string, editable: Editable) {
  const file = saved[`./home/settings/${id}.json`] ?? {};
  const keys = editable.sections.map((s) => s.key);
  // A saved order keeps only sections that still exist, and appends new ones.
  const order = [...(file.order ?? []).filter((k) => keys.includes(k)), ...keys.filter((k) => !file.order?.includes(k))];
  const values = Object.fromEntries(editable.controls.map((c) => [c.key, file.values?.[c.key] ?? c.value]));
  const text = Object.fromEntries(Object.entries(editable.text).map(([k, t]) => [k, file.text?.[k] ?? t.value]));
  // The controls and the section order as the root's style.
  const style = [
    ...editable.controls.map((c) => `--${c.key}: ${values[c.key]}${c.unit}`),
    ...order.map((k, i) => `--order-${k}: ${i}`),
  ].join('; ');
  return { order, values, text, style, saved: Object.keys(file).length > 0 };
}
