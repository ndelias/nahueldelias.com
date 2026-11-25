// The lab's editor: a small panel on the lab's layout pages, in development
// only. Switch layouts, drag sections into another order, change sizes with
// sliders, rewrite any text marked data-edit right on the page, and preview
// the phone width beside it. Everything applies live; Save writes it to the
// layout's settings file (src/lab/integration.mjs), which the layout renders
// from. Reads its setup from <script id="lab-edit">, written by page.astro.
import type { Editable } from '../settings';
import './editor.css';

interface Setup {
  id: string;
  variants: { id: string; name: string; href: string }[];
  editable?: Editable;
  current?: State;
}
interface State {
  order: string[];
  values: Record<string, number>;
  text: Record<string, string>;
}

const OPEN = 'lab-editor-open';
const VIEW = 'lab-editor-view';
const POS = 'lab-editor-position';
const store = {
  get: (k: string) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { sessionStorage.setItem(k, v); } catch {} },
};

const copy = (s: State): State => ({ order: [...s.order], values: { ...s.values }, text: { ...s.text } });
const same = (a: State, b: State) => JSON.stringify(a) === JSON.stringify(b);

/** Put a state on a document: this page, or the phone preview's. */
function apply(doc: Document, setup: Setup, state: State) {
  const root = doc.querySelector<HTMLElement>('[data-lab-root]');
  if (!root || !setup.editable) return;
  for (const c of setup.editable.controls) root.style.setProperty(`--${c.key}`, `${state.values[c.key]}${c.unit}`);
  state.order.forEach((k, i) => root.style.setProperty(`--order-${k}`, String(i)));
  for (const el of doc.querySelectorAll<HTMLElement>('[data-edit]')) {
    const value = state.text[el.dataset.edit!];
    if (value !== undefined && el.textContent !== value && el !== doc.activeElement) el.textContent = value;
  }
}

// Drawn, not typed: the subset fonts have no arrows (CLAUDE.md).
const svg = (d: string) => {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  el.setAttribute('viewBox', '0 0 16 16');
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<path d="${d}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  return el;
};
const UP = 'M8 13V3M3.5 7.5 8 3l4.5 4.5';
const DOWN = 'M8 3v10M3.5 8.5 8 13l4.5-4.5';
const GRIP = 'M6 4h.01M10 4h.01M6 8h.01M10 8h.01M6 12h.01M10 12h.01';
const MINUS = 'M3.5 8h9';
const SLIDERS = 'M3 4.5h5M11 4.5h2M3 11.5h2M8 11.5h5M9.5 3v3M6.5 10v3';

function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...kids: (Node | string)[]) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) k === 'class' ? (el.className = v) : el.setAttribute(k, v);
  el.append(...kids);
  return el;
}

function editor(setup: Setup) {
  const saved = setup.current ? copy(setup.current) : undefined;
  let state = saved ? copy(saved) : undefined;
  let phone: HTMLIFrameElement | null = null;

  /* ---------- The panel ----------
     Open, it's the full panel; minimized, it's one small round button that
     floats over the page and can be dragged anywhere (where it was is kept
     for the session). Click it, or the panel's minimize, or press Escape,
     to switch. The panel opens beside the button, toward the middle of the
     screen; the phone preview hides with it. */
  const status = h('span', { class: 'lab-ed-status mono', role: 'status' });
  const dot = h('span', { class: 'lab-ed-dot', hidden: '' });
  const fab = h('button', { class: 'lab-ed-fab', type: 'button', 'aria-expanded': 'false', 'aria-label': 'Design lab editor', title: 'Design lab editor (drag to move)' }, svg(SLIDERS), dot);
  const minimize = h('button', { class: 'lab-ed-min', type: 'button', 'aria-label': 'Minimize the editor', title: 'Minimize (Esc)' }, svg(MINUS));
  const panel = h('div', { class: 'lab-ed-panel', role: 'region', 'aria-label': 'Design lab editor', hidden: '' });
  const wrap = h('div', { class: 'lab-ed' }, panel, fab);
  document.body.append(wrap);

  const FAB = 44;
  const place = (x: number, y: number) => {
    x = Math.min(Math.max(8, x), innerWidth - FAB - 8);
    y = Math.min(Math.max(8, y), innerHeight - FAB - 8);
    wrap.style.left = `${x}px`;
    wrap.style.top = `${y}px`;
    // Open toward the middle of the screen.
    const left = x + FAB / 2 < innerWidth / 2;
    const up = y + FAB / 2 > innerHeight / 2;
    wrap.classList.toggle('opens-right', left);
    wrap.classList.toggle('opens-up', up);
    panel.style.maxHeight = `${Math.min(760, (up ? y : innerHeight - y - FAB) - 24)}px`;
    sidePhone(x, left);
    return { x, y };
  };
  // The phone preview sits just past the panel's far edge, wherever it opens.
  const PANEL = 300, GAP = 16;
  const sidePhone = (x: number, left: boolean) => {
    if (!phone) return;
    if (left) {
      phone.style.left = `${x + PANEL + GAP}px`;
      phone.style.right = 'auto';
    } else {
      phone.style.right = `${innerWidth - (x + FAB - PANEL) + GAP}px`;
      phone.style.left = 'auto';
    }
  };
  let pos = (() => {
    try { return JSON.parse(store.get(POS) ?? '') as { x: number; y: number }; } catch { return { x: innerWidth - FAB - 16, y: innerHeight - FAB - 16 }; }
  })();
  pos = place(pos.x, pos.y);
  addEventListener('resize', () => (pos = place(pos.x, pos.y)));

  const open = (on: boolean) => {
    panel.hidden = !on;
    fab.setAttribute('aria-expanded', String(on));
    wrap.classList.toggle('is-open', on);
    document.documentElement.classList.toggle('lab-ed-min-on', !on);
    store.set(OPEN, on ? '1' : '');
  };

  // Drag the button; a press that doesn't move is a click.
  let drag: { dx: number; dy: number; moved: boolean } | null = null;
  fab.addEventListener('pointerdown', (e) => {
    drag = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, moved: false };
    fab.setPointerCapture(e.pointerId);
  });
  fab.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const x = e.clientX - drag.dx, y = e.clientY - drag.dy;
    if (!drag.moved && Math.hypot(x - pos.x, y - pos.y) < 4) return;
    drag.moved = true;
    wrap.classList.add('dragging');
    pos = place(x, y);
  });
  fab.addEventListener('pointerup', () => {
    if (drag?.moved) store.set(POS, JSON.stringify(pos));
    wrap.classList.remove('dragging');
  });
  fab.addEventListener('click', (e) => {
    if (drag?.moved) e.preventDefault();
    else open(panel.hidden === true);
    drag = null;
  });
  minimize.addEventListener('click', () => {
    open(false);
    fab.focus();
  });
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || panel.hidden) return;
    const el = document.activeElement as HTMLElement | null;
    if (el?.isContentEditable) return el.blur();
    open(false);
    fab.focus();
  });

  const group = (title: string, ...kids: Node[]) => h('section', { class: 'lab-ed-group' }, h('h2', { class: 'mono' }, title), ...kids);

  // Layout: jump to another one.
  const select = h('select', { 'aria-label': 'Layout' }) as HTMLSelectElement;
  for (const v of setup.variants) {
    const o = h('option', { value: v.href }, v.name) as HTMLOptionElement;
    o.selected = v.id === setup.id;
    select.append(o);
  }
  select.addEventListener('change', () => (location.href = select.value));
  panel.append(h('header', { class: 'lab-ed-head' }, h('p', { class: 'mono' }, 'Design lab'), status, minimize), group('Layout', select));

  // View: the phone width in a frame beside the page.
  const views = h('div', { class: 'lab-ed-seg', role: 'group', 'aria-label': 'View' });
  for (const v of ['Desktop', 'Phone']) {
    const b = h('button', { type: 'button', 'aria-pressed': 'false', 'data-view': v.toLowerCase() }, v);
    b.addEventListener('click', () => view(v.toLowerCase()));
    views.append(b);
  }
  panel.append(group('View', views));

  const view = (v: string) => {
    store.set(VIEW, v);
    for (const b of views.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.view === v));
    if (v === 'phone' && !phone) {
      phone = h('iframe', { class: 'lab-ed-phone', src: location.pathname, title: 'Phone preview', width: '390', height: '844' }) as HTMLIFrameElement;
      phone.addEventListener('load', () => {
        const doc = phone!.contentDocument!;
        const style = doc.createElement('style');
        style.textContent = 'astro-dev-toolbar{display:none!important}';
        doc.head.append(style);
        if (state) apply(doc, setup, state);
      });
      document.body.append(phone);
      document.documentElement.classList.add('lab-ed-phone-on');
      place(pos.x, pos.y);
    } else if (v === 'desktop' && phone) {
      phone.remove();
      phone = null;
      document.documentElement.classList.remove('lab-ed-phone-on');
    }
  };

  if (!setup.editable || !state || !saved) {
    panel.append(h('p', { class: 'lab-ed-note' }, 'This layout has no settings yet. Pick one marked with a round to edit it.'));
  } else {
    const editable = setup.editable;
    const changed = () => {
      apply(document, setup, state!);
      if (phone?.contentDocument) apply(phone.contentDocument, setup, state!);
      const dirty = !same(state!, saved);
      status.textContent = dirty ? 'Unsaved changes' : '';
      dot.hidden = !dirty;
      save.disabled = reset.disabled = !dirty;
    };

    // Sections: drag, or the arrows, to reorder.
    const list = h('ol', { class: 'lab-ed-sections' });
    const label = (k: string) => editable.sections.find((s) => s.key === k)?.label ?? k;
    let dragging: string | null = null;
    const move = (k: string, to: number) => {
      const from = state!.order.indexOf(k);
      if (from < 0 || to < 0 || to >= state!.order.length || from === to) return;
      state!.order.splice(from, 1);
      state!.order.splice(to, 0, k);
      draw();
      changed();
    };
    const draw = () => {
      list.replaceChildren(
        ...state!.order.map((k, i) => {
          const up = h('button', { type: 'button', 'aria-label': `Move ${label(k)} up` }, svg(UP));
          const down = h('button', { type: 'button', 'aria-label': `Move ${label(k)} down` }, svg(DOWN));
          up.addEventListener('click', () => move(k, i - 1));
          down.addEventListener('click', () => move(k, i + 1));
          (up as HTMLButtonElement).disabled = i === 0;
          (down as HTMLButtonElement).disabled = i === state!.order.length - 1;
          const li = h('li', { draggable: 'true' }, h('span', { class: 'grip', 'aria-hidden': 'true' }, svg(GRIP)), h('span', {}, label(k)), up, down);
          li.addEventListener('dragstart', (e) => {
            dragging = k;
            e.dataTransfer?.setData('text/plain', k);
            li.classList.add('dragging');
          });
          li.addEventListener('dragend', () => li.classList.remove('dragging'));
          li.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (dragging && dragging !== k) move(dragging, i);
          });
          return li;
        }),
      );
    };
    draw();
    panel.append(group('Sections', list));

    // Sizes: a slider per control.
    const sliders = h('div', { class: 'lab-ed-sliders' });
    for (const c of editable.controls) {
      const out = h('output', { class: 'mono' }, `${state.values[c.key]}${c.unit}`);
      const input = h('input', { type: 'range', min: String(c.min), max: String(c.max), step: String(c.step), value: String(state.values[c.key]), 'aria-label': c.label }) as HTMLInputElement;
      input.addEventListener('input', () => {
        state!.values[c.key] = Number(input.value);
        out.textContent = `${input.value}${c.unit}`;
        changed();
      });
      sliders.append(h('label', {}, h('span', {}, c.label), out, input));
    }
    panel.append(group('Sizes', sliders));

    // Text: write straight on the page.
    const edit = h('button', { type: 'button', class: 'lab-ed-wide', 'aria-pressed': 'false' }, 'Edit text on the page');
    let editing = false;
    edit.addEventListener('click', () => {
      editing = !editing;
      edit.setAttribute('aria-pressed', String(editing));
      edit.textContent = editing ? 'Done editing text' : 'Edit text on the page';
      document.documentElement.classList.toggle('lab-ed-editing', editing);
      for (const el of document.querySelectorAll<HTMLElement>('[data-edit]')) {
        if (editing) el.setAttribute('contenteditable', 'plaintext-only');
        else el.removeAttribute('contenteditable');
      }
    });
    for (const el of document.querySelectorAll<HTMLElement>('[data-edit]')) {
      el.title = editable.text[el.dataset.edit!]?.label ?? '';
      el.addEventListener('input', () => {
        state!.text[el.dataset.edit!] = el.textContent ?? '';
        changed();
      });
      el.addEventListener('keydown', (e) => e.key === 'Enter' && (e.preventDefault(), el.blur()));
    }
    panel.append(group('Text', edit, h('p', { class: 'lab-ed-note' }, 'Outlined text can be rewritten. Enter finishes.')));

    // Reset and Save.
    const reset = h('button', { type: 'button' }, 'Reset') as HTMLButtonElement;
    const save = h('button', { type: 'button', class: 'primary' }, 'Save') as HTMLButtonElement;
    reset.addEventListener('click', () => {
      state = copy(saved);
      for (const el of document.querySelectorAll<HTMLElement>('[data-edit]')) el.textContent = state.text[el.dataset.edit!] ?? el.textContent;
      for (const input of sliders.querySelectorAll('input')) {
        const c = editable.controls.find((x) => x.label === input.getAttribute('aria-label'))!;
        input.value = String(state.values[c.key]);
        input.previousElementSibling!.textContent = `${input.value}${c.unit}`;
      }
      draw();
      changed();
    });
    // The dev server reloads the page as soon as the file is written: no
    // "leave the page?" for a save on its way.
    let saving = false;
    save.addEventListener('click', async () => {
      saving = true;
      save.disabled = true;
      status.textContent = 'Saving…';
      try {
        const res = await fetch('/__lab/save', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: setup.id, ...state }) });
        if (!res.ok) throw new Error((await res.json()).error);
        Object.assign(saved, copy(state!));
        status.textContent = 'Saved to the code';
        dot.hidden = true;
      } catch (error) {
        status.textContent = `Not saved: ${error instanceof Error ? error.message : error}`;
        save.disabled = false;
        saving = false;
      }
    });
    panel.append(h('footer', { class: 'lab-ed-foot' }, reset, save));
    addEventListener('beforeunload', (e) => !saving && !same(state!, saved) && e.preventDefault());
    changed();
  }

  open(store.get(OPEN) === '1');
  view(store.get(VIEW) === 'phone' ? 'phone' : 'desktop');
}

const data = document.getElementById('lab-edit');
// Not inside a frame: the phone preview and the compare page's frames are
// driven from outside.
if (data && window.top === window) editor(JSON.parse(data.textContent!) as Setup);
