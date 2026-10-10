import { matchesMaterial } from '../utils/materialCatalog';
import type { MaterialEdition, MaterialKind, MaterialStatus } from '../types/material';

const form = document.querySelector<HTMLFormElement>('#material-filters');
if (form) {
  const search = document.querySelector<HTMLInputElement>('#material-search')!;
  const edition = document.querySelector<HTMLSelectElement>('#material-edition')!;
  const kind = document.querySelector<HTMLSelectElement>('#material-kind')!;
  const status = document.querySelector<HTMLSelectElement>('#material-status')!;
  const reset = document.querySelector<HTMLButtonElement>('#material-reset')!;
  const count = document.querySelector<HTMLElement>('#material-result-count')!;
  const empty = document.querySelector<HTMLElement>('#material-empty')!;
  const groups = [...document.querySelectorAll<HTMLDetailsElement>('.material-source')].map(element => ({
    element, count: element.querySelector<HTMLElement>('[data-source-count]')!,
    entries: [...element.querySelectorAll<HTMLElement>('.material-entry')].map(row => ({
      row, data: { searchText: row.dataset.search || '', kind: row.dataset.kind as MaterialKind, status: row.dataset.status as MaterialStatus, errata: row.dataset.hasErrata === 'true' ? [{ href: '/' }] : [], sourceInfo: { id: '', code: '', label: '', edition: row.dataset.edition as MaterialEdition } },
    })),
  }));
  const total = groups.reduce((sum, group) => sum + group.entries.length, 0);
  function render(updateUrl = true) {
    const active = Boolean(search.value.trim() || edition.value || kind.value || status.value);
    let visible = 0;
    let sources = 0;
    for (const group of groups) {
      let matched = 0;
      for (const { row, data } of group.entries) {
        row.hidden = !matchesMaterial(data, search.value, edition.value, kind.value, status.value);
        if (!row.hidden) matched++;
      }
      group.element.hidden = matched === 0;
      group.element.open = active && matched > 0;
      group.count.textContent = active ? `${matched} / ${group.entries.length}` : String(matched);
      visible += matched;
      if (matched) sources++;
    }
    count.textContent = `Материалов: ${visible} из ${total} · источников: ${sources}`;
    empty.hidden = visible > 0;
    reset.disabled = !active;
    if (updateUrl) {
      const url = new URL(location.href);
      for (const [key, value] of [['q', search.value.trim()], ['edition', edition.value], ['kind', kind.value], ['status', status.value]]) {
        if (value) url.searchParams.set(key, value); else url.searchParams.delete(key);
      }
      history.replaceState(null, '', url);
    }
  }
  function restoreUrl() {
    const params = new URLSearchParams(location.search);
    search.value = params.get('q') || '';
    for (const [key, select] of [['edition', edition], ['kind', kind], ['status', status]] as const) {
      const value = params.get(key) || '';
      select.value = [...select.options].some(option => option.value === value) ? value : '';
    }
    render(false);
  }
  form.hidden = false;
  form.addEventListener('submit', event => event.preventDefault());
  search.addEventListener('input', () => render());
  for (const select of [edition, kind, status]) select.addEventListener('change', () => render());
  form.addEventListener('reset', event => {
    event.preventDefault();
    search.value = ''; edition.value = ''; kind.value = ''; status.value = '';
    render(); search.focus();
  });
  document.querySelector('#material-empty-reset')?.addEventListener('click', () => form.reset());
  window.addEventListener('popstate', restoreUrl);
  restoreUrl();
}
