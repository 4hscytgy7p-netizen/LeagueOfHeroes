import { emptyFaithFilters, matchesFaithEntry } from '../utils/deitySearch';
import type { FaithFilters, FaithSearchEntry } from '../utils/deitySearch';

const form = document.querySelector<HTMLFormElement>('#deities-filters');
const count = document.querySelector<HTMLElement>('#deities-count');
const empty = document.querySelector<HTMLElement>('#deities-empty');

if (form && count && empty) {
  const cards = [...document.querySelectorAll<HTMLDetailsElement>('[data-faith-entry]')].map(element => ({ element, entry: JSON.parse(element.dataset.faithEntry!) as FaithSearchEntry }));
  const fields = Object.keys(emptyFaithFilters) as (keyof FaithFilters)[];
  const field = (name: keyof FaithFilters) => form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement;
  const read = (): FaithFilters => Object.fromEntries(fields.map(name => [name, field(name).value])) as unknown as FaithFilters;
  const apply = (updateUrl: boolean) => {
    const filters = read();
    let visible = 0;
    cards.forEach(({ element, entry }) => {
      element.hidden = !matchesFaithEntry(entry, filters);
      if (!element.hidden) visible++;
    });
    count.textContent = `Найдено: ${visible} из ${cards.length}`;
    empty.hidden = visible !== 0;
    if (updateUrl) {
      const url = new URL(location.href);
      fields.forEach(name => filters[name].trim() ? url.searchParams.set(name, filters[name].trim()) : url.searchParams.delete(name));
      history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    }
  };
  const restore = () => {
    const params = new URLSearchParams(location.search);
    fields.forEach(name => { field(name).value = params.get(name) || ''; });
    // An unrecognized select value must not silently exclude every card.
    fields.forEach(name => { if (!field(name).value) field(name).value = ''; });
    apply(false);
  };
  const revealHash = () => {
    let id = '';
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const card = cards.find(({ element }) => element.id === id)?.element;
    if (!card) return;
    if (card.hidden) form.reset();
    card.open = true;
    card.scrollIntoView({ block: 'start' });
  };
  form.addEventListener('input', () => apply(true));
  form.addEventListener('change', () => apply(true));
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('reset', event => {
    event.preventDefault();
    fields.forEach(name => { field(name).value = ''; });
    apply(true);
  });
  window.addEventListener('popstate', () => { restore(); revealHash(); });
  window.addEventListener('hashchange', revealHash);
  form.hidden = false;
  restore();
  revealHash();
}
