import { validateRuleCatalog, type MasterRule, type MasterRuleCatalog, type EditableMasterRule } from './masterRules.ts';

export interface LocalRuleChange {
  rule: MasterRule;
  base: string | null;
}

export interface LocalRuleStore {
  version: 1;
  changes: LocalRuleChange[];
}

export function ruleSignature(rule: MasterRule): string {
  const fields: unknown[] = [rule.id, rule.title, rule.category, rule.summary, rule.body, rule.status, rule.sort_order, rule.revision];
  // Preserve signatures of legacy files and local edits with the default audience.
  if (rule.audiences && !(rule.audiences.length === 1 && rule.audiences[0] === 'master')) fields.push([...rule.audiences].sort());
  return JSON.stringify(fields);
}

export function parseLocalRuleStore(source: string | null): LocalRuleStore {
  if (!source) return { version: 1, changes: [] };
  const value = JSON.parse(source);
  if (value?.version !== 1 || !Array.isArray(value.changes) || value.changes.length > 2000) throw new Error('Не удалось прочитать локальные изменения правил.');
  const catalog = validateRuleCatalog({ version: 1, rules: value.changes.map((change: LocalRuleChange) => change?.rule) });
  const changes = value.changes.map((change: LocalRuleChange, index: number) => {
    if (change.base !== null && (typeof change.base !== 'string' || change.base.length > 1000000)) throw new Error('Не удалось прочитать исходную редакцию локальной статьи.');
    return { rule: catalog.rules[index], base: change.base };
  });
  return { version: 1, changes };
}

/** A newer published article takes precedence over an outdated local copy.
 * The copy remains in conflicts until its author reviews and restores it. */
export function mergeRuleFiles(source: MasterRuleCatalog, store: LocalRuleStore) {
  const byId = new Map(source.rules.map(rule => [rule.id, rule]));
  const localIds = new Set<string>();
  const conflicts = new Map<string, MasterRule>();
  const changes: LocalRuleChange[] = [];
  for (const change of store.changes) {
    const published = byId.get(change.rule.id);
    if (published && ruleSignature(published) === ruleSignature(change.rule)) continue;
    changes.push(change);
    if (published && change.base !== ruleSignature(published)) {
      conflicts.set(published.id, change.rule);
      continue;
    }
    if (!published && change.base !== null) {
      conflicts.set(change.rule.id, change.rule);
      continue;
    }
    byId.set(change.rule.id, change.rule);
    localIds.add(change.rule.id);
  }
  const rules = [...byId.values()].sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title, 'ru'));
  return { rules, localIds, conflicts, store: { version: 1 as const, changes } };
}

export class LocalRuleConflict extends Error {
  current: MasterRule | null;
  constructor(current: MasterRule | null) {
    super('Статья изменилась в другой вкладке или после обновления сайта.');
    this.current = current;
  }
}

export function saveLocalRule(
  source: MasterRuleCatalog, store: LocalRuleStore, id: string, expectedRevision: number | null,
  fields: EditableMasterRule, timestamp: string, expectedSignature?: string | null
) {
  const merged = mergeRuleFiles(source, store);
  const current = merged.rules.find(rule => rule.id === id) || null;
  if ((expectedRevision === null && current) || (expectedRevision !== null && (!current || current.revision !== expectedRevision))
    || (expectedSignature && current && ruleSignature(current) !== expectedSignature)) throw new LocalRuleConflict(current);
  const saved = validateRuleCatalog({ version: 1, rules: [{
    id, ...fields, revision: (current?.revision || 0) + 1,
    created_at: current?.created_at || timestamp, updated_at: timestamp
  }] }).rules[0];
  const published = source.rules.find(rule => rule.id === id);
  const next: LocalRuleStore = { version: 1, changes: [
    ...merged.store.changes.filter(change => change.rule.id !== id),
    { rule: saved, base: published ? ruleSignature(published) : null }
  ] };
  const validated = parseLocalRuleStore(JSON.stringify(next));
  validateRuleCatalog({ version: 1, rules: mergeRuleFiles(source, validated).rules });
  return { saved, store: validated };
}

/** Imports merge by ID; articles absent from a file are preserved. */
export function importRuleFile(source: MasterRuleCatalog, store: LocalRuleStore, incoming: MasterRuleCatalog, timestamp: string): LocalRuleStore {
  const merged = mergeRuleFiles(source, store);
  const changes = new Map(merged.store.changes.map(change => [change.rule.id, change]));
  for (const article of incoming.rules) {
    const current = merged.rules.find(rule => rule.id === article.id);
    if (current && ruleSignature(current) === ruleSignature(article)) continue;
    const published = source.rules.find(rule => rule.id === article.id);
    const rule = { ...article, revision: Math.max(current?.revision || 0, article.revision) + 1, created_at: current?.created_at || article.created_at, updated_at: timestamp };
    changes.set(rule.id, { rule, base: published ? ruleSignature(published) : null });
  }
  const next = { version: 1 as const, changes: [...changes.values()] };
  const validated = parseLocalRuleStore(JSON.stringify(next));
  validateRuleCatalog({ version: 1, rules: mergeRuleFiles(source, validated).rules });
  return validated;
}
