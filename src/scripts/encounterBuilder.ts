import { calculateEncounter, encounterStorageKey, positiveInteger, restoreEncounter, serializeEncounter, validateCR, validateMonster, xpForCR } from '../utils/encounterBuilder';
import type { Encounter } from '../utils/encounterBuilder';

const root = document.getElementById('encounter-builder');
if (root) {
  const element = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>(`#${id}`)!;
  const input = (id: string) => element<HTMLInputElement>(id);
  const format = (value: number | null) => value === null ? '—' : value.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
  let encounter: Encounter = { characters: [], monsters: [] };
  let damagedSave = false;
  const status = (text: string) => { element('encounter-save-status').textContent = text; };
  function save() {
    if (damagedSave) return;
    try {
      localStorage.setItem(encounterStorageKey, serializeEncounter(encounter));
      status('Столкновение сохранено в этом браузере и восстановится при следующем открытии.');
    } catch {
      status('Браузер не разрешил сохранить столкновение. Текущие изменения доступны до закрытия страницы.');
    }
  }
  function renderList(id: string, items: string[], kind: 'characters' | 'monsters') {
    const list = element(id);
    list.replaceChildren();
    if (!items.length) {
      const empty = document.createElement('p');
      empty.textContent = kind === 'characters' ? 'Персонажи пока не добавлены.' : 'Противники пока не добавлены.';
      list.append(empty);
    }
    items.forEach((text, index) => {
      const row = document.createElement('div'); row.className = 'list-item';
      const label = document.createElement('span'); label.textContent = text;
      const remove = document.createElement('button');
      remove.type = 'button'; remove.className = 'remove-btn'; remove.textContent = '×';
      remove.setAttribute('aria-label', `Удалить: ${text}`);
      remove.addEventListener('click', () => {
        encounter[kind].splice(index, 1); render(); save();
        const buttons = list.querySelectorAll<HTMLButtonElement>('button');
        (buttons[Math.min(index, buttons.length - 1)] || element<HTMLButtonElement>(kind === 'characters' ? 'add-character' : 'add-monster')).focus();
      });
      row.append(label, remove); list.append(row);
    });
  }
  function render() {
    const result = calculateEncounter(encounter);
    element('party-count').textContent = format(result.characterCount);
    element('avg-level').textContent = format(result.averageLevel);
    for (const key of ['low', 'moderate', 'high'] as const) {
      element(`${key}-threshold`).textContent = result.characterCount ? format(result.budgets[key]) : '—';
      element(`${key}-per-character`).textContent = result.characterCount ? `${format(result.budgets[key] / result.characterCount)} на персонажа` : '—';
    }
    element('total-difficulty').textContent = result.difficulty;
    element('difficulty-multiplier').textContent = result.highRatio !== null && result.highRatio > 1 ? ` (${format(result.highRatio)}× высокого бюджета)` : '';
    element('total-xp').textContent = format(result.totalXP);
    element('xp-per-character').textContent = format(result.xpPerCharacter);
    const warnings = element('encounter-warnings'); warnings.replaceChildren();
    warnings.hidden = !result.warnings.length;
    for (const text of result.warnings) { const item = document.createElement('li'); item.textContent = text; warnings.append(item); }
    renderList('character-list', encounter.characters.map(character => `${character.count} × персонаж ${character.level} уровня`), 'characters');
    renderList('monster-list', encounter.monsters.map(monster => `${monster.count} × ${monster.name} (CR ${monster.cr}; ${format(xpForCR(monster.cr, monster.zeroXP))} опыта за существо)`), 'monsters');
  }
  function error(id: string, value?: unknown) {
    const target = element(id); target.hidden = !value;
    target.textContent = value instanceof Error ? value.message : value ? 'Не удалось обработать ввод.' : '';
  }
  element('character-form').addEventListener('submit', event => {
    event.preventDefault(); error('character-error');
    try {
      const character = { count: positiveInteger(input('char-count').value, 'Количество персонажей'), level: positiveInteger(input('char-level').value, 'Уровень', 20) };
      const next = { ...encounter, characters: [...encounter.characters, character] };
      calculateEncounter(next); encounter = next;
      element<HTMLFormElement>('character-form').reset(); render(); save(); input('char-count').focus();
    } catch (value) { error('character-error', value); }
  });
  input('monster-cr').addEventListener('input', () => { element('zero-xp-control').hidden = input('monster-cr').value.trim() !== '0'; });
  element('monster-form').addEventListener('submit', event => {
    event.preventDefault(); error('monster-error');
    try {
      const cr = validateCR(input('monster-cr').value);
      const monster = validateMonster({ name: input('monster-name').value, cr,
        count: positiveInteger(input('monster-count').value, 'Количество противников'),
        zeroXP: cr === '0' && element<HTMLSelectElement>('zero-xp').value === '0' });
      const next = { ...encounter, monsters: [...encounter.monsters, monster] };
      calculateEncounter(next); encounter = next;
      element<HTMLFormElement>('monster-form').reset(); element('zero-xp-control').hidden = true;
      render(); save(); input('monster-name').focus();
    } catch (value) { error('monster-error', value); }
  });
  element('clear-encounter').addEventListener('click', () => {
    if ((damagedSave || encounter.characters.length || encounter.monsters.length) && !window.confirm('Удалить сохранённое столкновение и очистить группу и противников?')) return;
    encounter = { characters: [], monsters: [] }; damagedSave = false;
    for (const id of ['character-form', 'monster-form']) element<HTMLFormElement>(id).reset();
    element('zero-xp-control').hidden = true;
    error('character-error'); error('monster-error'); render(); save(); input('char-count').focus();
  });
  try {
    const raw = localStorage.getItem(encounterStorageKey);
    if (raw !== null) {
      try { encounter = restoreEncounter(raw); status('Сохранённое столкновение восстановлено из этого браузера.'); }
      catch { damagedSave = true; status('Сохранённое столкновение повреждено или имеет неизвестный формат. Оно не перезаписано. Для нового сохранения нажмите «Очистить столкновение».'); }
    }
  } catch { status('Браузер не разрешил прочитать сохранение. Расчёт доступен; изменения могут не сохраниться.'); }
  render();
}
