import type { AccountRole } from './testAccount.ts';

export type RuleStatus = 'published' | 'draft';
export const ruleAudienceOptions = [
  { id: 'test_master', title: 'Тестовый мастер' },
  { id: 'master', title: 'Мастер' }
] as const;
export type RuleAudience = typeof ruleAudienceOptions[number]['id'];
export const defaultRuleAudiences: RuleAudience[] = ['master'];

export interface MasterRule {
  id: string;
  title: string;
  category: string;
  summary: string;
  body: string;
  status: RuleStatus;
  sort_order: number;
  revision: number;
  created_at: string;
  updated_at: string;
  /** Older files without audiences remain available to masters and admins. */
  audiences?: RuleAudience[];
}

export interface MasterRuleCatalog {
  version: 1;
  rules: MasterRule[];
}

export type EditableMasterRule = Pick<MasterRule, 'title' | 'category' | 'summary' | 'body' | 'status' | 'sort_order' | 'audiences'>;

export function canReadMasterRule(rule: MasterRule, role: AccountRole): boolean {
  if (role === 'admin') return true;
  if (role === 'player') return false;
  return (role !== 'test_master' || rule.status === 'published')
    && (rule.audiences ?? defaultRuleAudiences).includes(role);
}

export function canEditMasterRules(role: AccountRole): boolean {
  return role === 'admin';
}

export const ruleCategories = [
  { id: 'getting-started', title: 'Путь мастера', icon: '☆', description: 'Подготовка к тестовой игре и получение роли Мастера Лиги' },
  { id: 'rewards', title: 'Награды и пул', icon: '◇', description: 'Выдача, учёт добычи и награда мастеру' },
  { id: 'items', title: 'Магические предметы', icon: '✧', description: 'Проклятия, свойства и развитие предметов' },
  { id: 'trade', title: 'Торговля на играх', icon: '⇄', description: 'Поиск покупателей, цены и сделки' },
  { id: 'factions', title: 'Фракции', icon: '⚑', description: 'Организации, репутация и взаимодействия' },
  { id: 'conflicts', title: 'Конфликты за столом', icon: '◎', description: 'Споры игроков и конфликты персонажей' },
  { id: 'adventures', title: 'Проведение игр', icon: '⌘', description: 'Ловушки, бастионы, порталы и подготовка' },
  { id: 'other', title: 'Другие правила', icon: '…', description: 'Дополнения к справочнику мастера' }
] as const;

export function validateRuleCatalog(value: unknown): MasterRuleCatalog {
  if (!value || typeof value !== 'object') throw new Error('Ожидается файл справочника в формате JSON.');
  const catalog = value as Record<string, unknown>;
  if (catalog.version !== 1 || !Array.isArray(catalog.rules) || catalog.rules.length > 2000) {
    throw new Error('Нужен справочник версии 1 с массивом rules (до 2 000 статей).');
  }
  const ids = new Set<string>();
  const rules = catalog.rules.map((input: unknown, index: number): MasterRule => {
    if (!input || typeof input !== 'object') throw new Error(`Статья ${index + 1}: неверный формат.`);
    const rule = input as Record<string, unknown>;
    const text = (key: string, min: number, max: number) => {
      const field = rule[key];
      if (typeof field !== 'string' || field.trim().length < min || field.length > max) throw new Error(`Статья ${index + 1}: проверьте поле ${key}.`);
      return field;
    };
    const id = text('id', 1, 120);
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(id) || ids.has(id)) throw new Error(`Статья ${index + 1}: ID должен быть уникальным и содержать буквы, цифры, дефис или подчёркивание.`);
    ids.add(id);
    const category = text('category', 1, 30);
    if (!ruleCategories.some(item => item.id === category)) throw new Error(`Статья ${index + 1}: неизвестный раздел.`);
    if (rule.status !== 'published' && rule.status !== 'draft') throw new Error(`Статья ${index + 1}: неизвестный статус.`);
    if (!Number.isSafeInteger(rule.sort_order) || Number(rule.sort_order) < 0 || Number(rule.sort_order) > 100000) throw new Error(`Статья ${index + 1}: неверный порядок сортировки.`);
    if (!Number.isSafeInteger(rule.revision) || Number(rule.revision) < 1) throw new Error(`Статья ${index + 1}: неверный номер редакции.`);
    const timestamp = (key: string) => {
      const field = text(key, 1, 40);
      if (!Number.isFinite(Date.parse(field))) throw new Error(`Статья ${index + 1}: неверная дата ${key}.`);
      return field;
    };
    if (rule.audiences !== undefined && (!Array.isArray(rule.audiences)
      || rule.audiences.length === 0
      || rule.audiences.some(value => !ruleAudienceOptions.some(option => option.id === value))
      || new Set(rule.audiences).size !== rule.audiences.length)) {
      throw new Error(`Статья ${index + 1}: выберите роли, которым доступно правило.`);
    }
    return {
      id, title: text('title', 1, 180), category, summary: text('summary', 0, 500), body: text('body', 1, 100000),
      status: rule.status, sort_order: Number(rule.sort_order), revision: Number(rule.revision),
      created_at: timestamp('created_at'), updated_at: timestamp('updated_at'),
      ...(rule.audiences !== undefined ? { audiences: ruleAudienceOptions.filter(option => (rule.audiences as unknown[]).includes(option.id)).map(option => option.id) } : {})
    };
  });
  return { version: 1, rules };
}

export function serializeCatalogForPage(catalog: MasterRuleCatalog): string {
  return JSON.stringify(catalog).replace(/[<>&\u2028\u2029]/g, character => ({
    '<': '\\u003c', '>': '\\u003e', '&': '\\u0026', '\u2028': '\\u2028', '\u2029': '\\u2029'
  })[character]!);
}

export const settlements = [
  ['Деревушка', 40], ['Деревня', 100], ['Большая деревня', 200],
  ['Малый город', 800], ['Средний город', 3000], ['Крупный город', 15000],
  ['Баронство', 40000], ['Княжество', 100000], ['Герцогство', 250000],
  ['Королевство', 500000], ['Империя', 1500000]
] as const;

// Значения из существующей TreasureAwardsRules.astro, а не цены покупки.
export const magicItemPoolPrices = [
  ['Обычный', 50], ['Необычный', 450], ['Редкий', 15000],
  ['Очень редкий', 37500], ['Легендарный', 225000]
] as const;

export const dragonStages = ['Спящий', 'Пробуждающийся', 'Пробуждённый', 'Восходящий'] as const;
export const dragonQuirks = [
  'Лежа на земле, предмет указывает направление к последней сокровищнице, где он побывал.',
  'Носитель предмета понимает Драконий язык и может разговаривать на нём.',
  'Предмет мягко светится, если в пределах 60 футов находится дракон или другой предмет сокровищницы.',
  'Носитель предмета получает скорость плавания, равную скорости ходьбы.',
  'Носитель предмета получает Преимущество на проверки Интеллекта (История).',
  'Носитель предмета получает Преимущество на проверки Харизмы (Запугивание) против не-драконов.',
  'Предмет даёт сопротивление типу урона дыхания дракона, в последней сокровищнице которого он побывал.',
  'Носителю предмета снится дракон, в последней сокровищнице которого он побывал.'
] as const;

export function escapeRuleText(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]!);
}

function safeHref(value: string): string | null {
  if (/[\u0000-\u0020\\]/.test(value)) return null;
  if (/^\/(?!\/)/.test(value) || /^#[\w-]+$/.test(value)) return value;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

function inlineMarkdown(value: string): string {
  const pattern = /`([^`\n]+)`|\*\*([^*\n]+)\*\*|\[([^\]\[\n]+)\]\(([^)\s]+)\)/g;
  let result = '';
  let cursor = 0;
  for (const match of value.matchAll(pattern)) {
    result += escapeRuleText(value.slice(cursor, match.index));
    if (match[1]) result += `<code>${escapeRuleText(match[1])}</code>`;
    else if (match[2]) result += `<strong>${escapeRuleText(match[2])}</strong>`;
    else {
      const href = safeHref(match[4]);
      const external = href?.startsWith('http');
      result += href
        ? `<a href="${escapeRuleText(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${escapeRuleText(match[3])}</a>`
        : escapeRuleText(match[3]);
    }
    cursor = match.index! + match[0].length;
  }
  return result + escapeRuleText(value.slice(cursor));
}

/** Limited Markdown: headings, tables, lists, quotes and inline formatting.
 * Raw HTML is always escaped, including in editor previews. */
export function renderRuleMarkdown(source: string, prefix = 'rule'): {
  html: string; headings: { id: string; title: string; level: number }[];
} {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const html: string[] = [];
  const headings: { id: string; title: string; level: number }[] = [];
  const cells = (line: string) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());
  const isDivider = (line: string) => line.includes('|') && cells(line).every(cell => /^:?-{3,}:?$/.test(cell));
  const isSpecial = (index: number) => !lines[index]?.trim()
    || /^(#{1,4}\s|[-*]\s|\d+\.\s|>\s?)/.test(lines[index])
    || (lines[index].includes('|') && isDivider(lines[index + 1] || ''));
  for (let i = 0; i < lines.length;) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      const level = Math.min(heading[1].length + 1, 5);
      const id = `${prefix}-heading-${headings.length + 1}`;
      headings.push({ id, title: heading[2].replace(/\*\*/g, ''), level });
      html.push(`<h${level} id="${escapeRuleText(id)}">${inlineMarkdown(heading[2])}</h${level}>`);
      i++; continue;
    }
    if (line.includes('|') && isDivider(lines[i + 1] || '')) {
      const header = cells(line);
      i += 2;
      const rows: string[] = [];
      while (i < lines.length && lines[i].trim().includes('|')) {
        const row = cells(lines[i++]);
        rows.push(`<tr>${row.slice(0, header.length).map(cell => `<td>${inlineMarkdown(cell)}</td>`).join('')}</tr>`);
      }
      html.push(`<div class="rule-table-scroll" tabindex="0" role="region" aria-label="Таблица правил"><table><thead><tr>${header.map(cell => `<th scope="col">${inlineMarkdown(cell)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`);
      continue;
    }
    const list = line.match(/^([-*]|\d+\.)\s+(.+)$/);
    if (list) {
      const ordered = /^\d/.test(list[1]);
      const pattern = ordered ? /^\d+\.\s+(.+)$/ : /^[-*]\s+(.+)$/;
      const items: string[] = [];
      while (i < lines.length) {
        const item = lines[i].trim().match(pattern);
        if (!item) break;
        items.push(`<li>${inlineMarkdown(item[1])}</li>`);
        i++;
      }
      const tag = ordered ? 'ol' : 'ul';
      html.push(`<${tag}>${items.join('')}</${tag}>`); continue;
    }
    if (line.startsWith('>')) {
      const quotes: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) quotes.push(lines[i++].trim().replace(/^>\s?/, ''));
      html.push(`<blockquote>${inlineMarkdown(quotes.join(' '))}</blockquote>`); continue;
    }
    const paragraph = [line];
    i++;
    while (i < lines.length && !isSpecial(i)) paragraph.push(lines[i++].trim());
    html.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
  }
  return { html: html.join('\n'), headings };
}

function nonnegative(value: number): number {
  if (!Number.isFinite(value) || value < 0) throw new Error('Введите конечное неотрицательное число.');
  return value;
}

export function calculateRewardBudget(pool: number, settlementCap: number, allocated: number) {
  [pool, settlementCap, allocated].forEach(nonnegative);
  return { cashLimit: Math.min(pool * .2, settlementCap), remaining: pool - allocated };
}

export function calculateTrade(basePrice: number, quantity: number, investigation: number, persuasion: number) {
  [basePrice, quantity, investigation, persuasion].forEach(nonnegative);
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error('Количество должно быть целым и не меньше 1.');
  const found = investigation >= 11;
  const multiplier = persuasion >= 21 ? 1.5 : persuasion >= 11 ? 1 : .5;
  const poolValue = basePrice * quantity * .5;
  const saleValue = found ? basePrice * quantity * multiplier : 0;
  return { found, advantage: investigation >= 21, poolValue, saleValue, extra: found ? saleValue - poolValue : 0 };
}

export function calculateDragonStage(current: number, ageCap: number, mode: string, days: number) {
  if (![current, ageCap].every(value => Number.isInteger(value) && value >= 0 && value <= 3)) throw new Error('Неизвестная стадия предмета.');
  nonnegative(days);
  if (mode === 'year') return Math.max(current, ageCap);
  if (mode === 'slain') return Math.max(current, Math.min(current + 1, ageCap));
  if (mode === 'decay') return Math.max(0, current - Math.floor(days / 30));
  if (mode === 'none') return current;
  throw new Error('Неизвестный способ развития.');
}
