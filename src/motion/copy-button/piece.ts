// M11, the copy button. Copy writes the link to the clipboard; on success
// the two pages fold away (fade, shrink, a slight turn) as a check draws
// itself, and the label rolls up from Copy to Copied, its width easing to
// the new word. After 1.6s it turns back. If the clipboard refuses (no
// permission, an insecure page), it says so honestly: the link is selected
// for you and the label reads Selected. A live region tells screen readers
// either way. Reduced motion: the states swap without moving.

import { define } from '../runtime';

const BACK_MS = 1600;

define('copy-button', (stage) => {
  const root = stage.querySelector<HTMLElement>('[data-share]')!;
  const button = root.querySelector<HTMLButtonElement>('[data-copy]')!;
  const url = root.querySelector<HTMLElement>('[data-url]')!;
  const said = root.querySelector<HTMLElement>('[data-said]')!;
  const word = button.querySelector<HTMLElement>('.word')!;
  let timer = 0;

  // The label cell is as wide as the word it shows.
  const fit = () => {
    const shown = word.querySelector<HTMLElement>(button.classList.contains('copied') ? '.done' : button.classList.contains('failed') ? '.fail' : '.idle')!;
    word.style.width = `${shown.scrollWidth}px`;
  };

  const show = (state: 'copied' | 'failed') => {
    clearTimeout(timer);
    button.classList.remove('copied', 'failed');
    button.classList.add(state);
    fit();
    said.textContent = state === 'copied' ? 'Link copied' : 'Link selected, copy it with your keyboard';
    timer = window.setTimeout(() => {
      button.classList.remove('copied', 'failed');
      fit();
    }, BACK_MS);
  };

  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(`https://${url.textContent}`);
      show('copied');
    } catch {
      getSelection()?.selectAllChildren(url);
      show('failed');
    }
  });

  fit();
});
