import { initOracle } from './oracle.mjs';
import { initBook } from './book.mjs';
import { createSoundController } from './audio.mjs';

const tabs = [...document.querySelectorAll('.mode-switch [role="tab"]')];
const switcher = document.querySelector('.mode-switch');
const panels = {
  oracle: document.querySelector('#oracle-panel'),
  book: document.querySelector('#book-panel')
};
const defaultMode = document.documentElement.dataset.initialMode === 'book' ? 'book' : 'oracle';
function modeFromUrl() {
  const hash = window.location.hash;
  return hash === '#book' ? 'book' : hash === '#oracle' ? 'oracle' : defaultMode;
}
let currentMode = modeFromUrl();
const sounds = createSoundController(document.querySelector('#sound'), document.querySelector('#sound-label'), currentMode);
const dialog = document.querySelector('#instructions');
const about = document.querySelector('#about');

function setMode(mode, { writeHistory = false, focus = false } = {}) {
  if (!(mode in panels)) return;
  const previous = currentMode;
  currentMode = mode;
  sounds.setMode(mode);
  // Both panels already exist. Switching never waits for a draw or network work.
  for (const tab of tabs) {
    const selected = tab.dataset.mode === mode;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
  for (const [name, panel] of Object.entries(panels)) panel.hidden = name !== mode;
  switcher.dataset.active = mode;
  about.textContent = mode === 'book' ? '閱書須知' : '求籤須知';
  document.querySelector('#dialog-title').textContent = about.textContent;
  document.querySelector('#dialog-seal').textContent = mode === 'book' ? '書' : '問';
  document.querySelector('#oracle-help').hidden = mode !== 'oracle';
  document.querySelector('#book-help').hidden = mode !== 'book';
  document.querySelector('#understood').textContent = mode === 'book' ? '翻開心中一問' : '心中有問，便問';
  document.title = mode === 'book' ? '答案之書 · 一問' : '黃大仙靈籤 · 一問';
  const selectedTab = tabs.find((tab) => tab.dataset.mode === mode);
  if (focus || (previous !== mode && panels[previous]?.contains(document.activeElement))) selectedTab.focus({ preventScroll: true });
  if (writeHistory && window.location.hash !== `#${mode}`) history.pushState({ mode }, '', `#${mode}`);
}

for (const tab of tabs) {
  tab.addEventListener('click', () => setMode(tab.dataset.mode, { writeHistory: true }));
  tab.addEventListener('keydown', (event) => {
    const index = tabs.indexOf(tab);
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    setMode(tabs[next].dataset.mode, { writeHistory: true, focus: true });
  });
}
window.addEventListener('hashchange', () => setMode(modeFromUrl()));
window.addEventListener('popstate', () => setMode(modeFromUrl()));

about.addEventListener('click', () => dialog.showModal());
document.querySelector('#close-dialog').addEventListener('click', () => dialog.close());
document.querySelector('#understood').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
});

setMode(currentMode);
initOracle(panels.oracle, sounds);
initBook(panels.book, sounds);
