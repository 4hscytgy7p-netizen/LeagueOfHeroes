const cardSelector = '[data-creature-card]';

function loadImages(panel: HTMLElement) {
  panel.querySelectorAll<HTMLImageElement>('img[data-src]').forEach(img => {
    img.src = img.dataset.src!;
    delete img.dataset.src;
  });
}

function activate(card: HTMLElement, id: string, focus = false) {
  const tabs = [...card.querySelectorAll<HTMLButtonElement>('[data-creature-tab]')];
  const selected = tabs.find(tab => tab.dataset.creatureTab === id);
  if (!selected) return;
  tabs.forEach(tab => {
    const active = tab === selected;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  card.querySelectorAll<HTMLElement>('[data-creature-panel]').forEach(panel => {
    panel.hidden = panel.dataset.creaturePanel !== id;
    if (!panel.hidden) loadImages(panel);
  });
  if (focus) selected.focus();
}

function initialize(card: HTMLElement) {
  if (card.dataset.creatureReady) return;
  card.dataset.creatureReady = 'true';
  const tabs = card.querySelector<HTMLElement>('[data-creature-tabs]');
  if (!tabs) return;
  tabs.hidden = false;
  tabs.setAttribute('role', 'tablist');
  card.querySelectorAll<HTMLButtonElement>('[data-creature-tab]').forEach(tab => tab.setAttribute('role', 'tab'));
  card.querySelectorAll<HTMLElement>('[data-creature-panel]').forEach(panel => {
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', `${card.id}-tab-${panel.dataset.creaturePanel}`);
    panel.tabIndex = 0;
  });
  activate(card, 'stats');
  card.querySelectorAll<HTMLImageElement>('[data-creature-image]').forEach(img => {
    const fail = () => {
      img.hidden = true;
      const message = img.closest('[data-creature-image-wrapper]')?.querySelector<HTMLElement>('[data-creature-image-error]');
      if (message) message.hidden = false;
    };
    img.addEventListener('error', fail);
    if (img.getAttribute('src') && img.complete && img.naturalWidth === 0) fail();
  });
}

let instance = 0;
function mountSlot(slot: HTMLElement) {
  if (slot.dataset.creatureMounted) return;
  slot.dataset.creatureMounted = 'true';
  const ids: string[] = JSON.parse(slot.dataset.creatureIds || '[]');
  for (const id of ids) {
    const template = [...document.querySelectorAll<HTMLTemplateElement>('template[data-creature-template]')].find(t => t.dataset.creatureTemplate === id);
    if (!template) continue;
    const fragment = template.content.cloneNode(true) as DocumentFragment;
    const card = fragment.querySelector<HTMLElement>(cardSelector)!;
    const oldId = card.id;
    const newId = `${oldId}-instance-${++instance}`;
    fragment.querySelectorAll<HTMLElement>('[id]').forEach(node => node.id = node.id.replace(oldId, newId));
    fragment.querySelectorAll<HTMLElement>('[aria-labelledby], [aria-controls]').forEach(node => {
      for (const attribute of ['aria-labelledby', 'aria-controls']) {
        const value = node.getAttribute(attribute);
        if (value) node.setAttribute(attribute, value.replaceAll(oldId, newId));
      }
    });
    slot.appendChild(fragment);
    initialize(card);
  }
}
function initializeTree(root: ParentNode) {
  if (root instanceof HTMLElement && root.matches('[data-creature-ids]')) mountSlot(root);
  root.querySelectorAll<HTMLElement>('[data-creature-ids]').forEach(mountSlot);
  if (root instanceof HTMLElement && root.matches(cardSelector)) initialize(root);
  root.querySelectorAll<HTMLElement>(cardSelector).forEach(initialize);
}
initializeTree(document);
// Class features are rebuilt on subclass changes. Initialize only newly inserted cards.
new MutationObserver(mutations => {
  for (const mutation of mutations) for (const node of mutation.addedNodes) {
    if (!(node instanceof HTMLElement)) continue;
    initializeTree(node);
  }
}).observe(document.body, { childList: true, subtree: true });

document.addEventListener('click', event => {
  if (!(event.target instanceof Element)) return;
  const tab = event.target.closest<HTMLButtonElement>('[data-creature-tab]');
  const card = tab?.closest<HTMLElement>(cardSelector);
  if (tab && card) activate(card, tab.dataset.creatureTab!);
});

document.addEventListener('keydown', event => {
  if (!(event.target instanceof Element)) return;
  const tab = event.target.closest<HTMLButtonElement>('[data-creature-tab]');
  const card = tab?.closest<HTMLElement>(cardSelector);
  if (!tab || !card || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const tabs = [...card.querySelectorAll<HTMLButtonElement>('[data-creature-tab]')];
  let index = tabs.indexOf(tab);
  if (event.key === 'Home') index = 0;
  else if (event.key === 'End') index = tabs.length - 1;
  else index = (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  event.preventDefault();
  activate(card, tabs[index].dataset.creatureTab!, true);
});
