import { matchesExplorationQuery } from '../utils/exploration';

const root = document.getElementById('exploration-page');
if (root) {
  const search = root.querySelector<HTMLInputElement>('#exploration-search')!;
  const rules = [...root.querySelectorAll<HTMLDetailsElement>('.exploration-rule')];
  const topics = [...root.querySelectorAll<HTMLElement>('.exploration-topic')];
  const reset = root.querySelector<HTMLButtonElement>('#exploration-reset')!;
  const count = root.querySelector<HTMLElement>('#exploration-count')!;
  let savedOpen: Map<HTMLDetailsElement, boolean> | undefined;

  function filter(updateUrl = true) {
    const query = search.value.trim();
    if (query && !savedOpen) savedOpen = new Map(rules.map(rule => [rule, rule.open]));
    let visible = 0;
    rules.forEach(rule => {
      rule.hidden = !matchesExplorationQuery(rule.dataset.search || '', query);
      if (!rule.hidden) visible++;
      if (query) rule.open = !rule.hidden;
      else if (savedOpen) rule.open = savedOpen.get(rule) || false;
    });
    if (!query) savedOpen = undefined;
    topics.forEach(topic => {
      topic.hidden = !topic.querySelector('.exploration-rule:not([hidden])');
      const link = root!.querySelector<HTMLElement>(`[data-topic-link="${topic.id}"]`);
      if (link) link.hidden = topic.hidden;
    });
    count.textContent = `Правил: ${visible} из ${rules.length}`;
    reset.hidden = !query;
    root!.querySelector<HTMLElement>('#exploration-empty')!.hidden = visible !== 0;
    if (updateUrl) {
      const url = new URL(location.href);
      if (query) { url.searchParams.set('q', query); url.hash = ''; }
      else url.searchParams.delete('q');
      history.replaceState(null, '', url);
    }
  }

  function revealHash() {
    let id: string;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    if (!id) return;
    const target = document.getElementById(id);
    if (!target || !root!.contains(target)) return;
    if (target.closest('[hidden]')) { search.value = ''; filter(); }
    const parent = target.closest<HTMLDetailsElement>('details');
    if (parent) parent.open = true;
    target.scrollIntoView({ block: 'start' });
  }

  search.addEventListener('input', () => filter());
  const clear = () => { search.value = ''; filter(); search.focus(); };
  reset.addEventListener('click', clear);
  root.querySelector('#exploration-empty-reset')!.addEventListener('click', clear);
  for (const [id, open] of [['exploration-expand', true], ['exploration-collapse', false]] as const) {
    root.querySelector(`#${id}`)!.addEventListener('click', () => {
      rules.filter(rule => !rule.hidden).forEach(rule => { rule.open = open; });
    });
  }
  window.addEventListener('hashchange', revealHash);
  window.addEventListener('popstate', () => { search.value = new URL(location.href).searchParams.get('q') || ''; filter(false); revealHash(); });
  root.querySelector<HTMLElement>('#exploration-controls')!.hidden = false;
  root.querySelector<HTMLElement>('#exploration-toolbar')!.hidden = false;
  search.value = new URL(location.href).searchParams.get('q') || '';
  filter(false);
  if (location.hash) requestAnimationFrame(revealHash);
}
