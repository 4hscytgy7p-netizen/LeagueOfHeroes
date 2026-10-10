import type { MaterialErrata, PublishedMaterial } from '../types/material.ts';
import { isMaterialLink, materialKey } from './materialCatalog.ts';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));
}

// Shared by Astro pages and details rendered in the browser.
export function materialRuleLabel(rule: MaterialErrata): string {
  return rule.type === 'adaptation' ? 'Адаптировано для Лиги' : 'Ограничения Лиги';
}

export function renderMaterialMetadata(material: PublishedMaterial): string {
  const source = material.sourceInfo.label.replace(/ · (2014|2024)$/, '');
  const page = Number.isInteger(material.sourcePage) && material.sourcePage! > 0 ? `, стр. ${material.sourcePage}` : '';
  const edition = material.sourceInfo.edition === 'unspecified' ? 'Редакция не указана' : `Правила ${material.sourceInfo.edition}`;
  const errata = material.errata.map(rule => {
    if (!isMaterialLink(rule.href)) throw new Error('Invalid material errata link');
    const explanation = rule.type === 'adaptation' ? `Уже учтено в описании. ${rule.note || ''}` : rule.note;
    return `<span class="material-rule"><a class="material-flag material-flag-errata" data-league-rule-type="${rule.type === 'adaptation' ? 'adaptation' : 'restriction'}" href="${escapeHtml(rule.href)}">${materialRuleLabel(rule)} →</a>${explanation ? `<span class="material-rule-note">${escapeHtml(explanation)}</span>` : ''}</span>`;
  }).join('');
  let replacement = '';
  if (material.preferredHref) {
    if (!isMaterialLink(material.preferredHref)) throw new Error('Invalid material replacement link');
    replacement = `<a class="material-flag material-flag-replacement" href="${escapeHtml(material.preferredHref)}"${material.preferredName ? ` title="${escapeHtml(material.preferredName)}"` : ''}>Заменён новой версией →</a>`;
  }
  return `<div class="material-metadata" data-material-key="${escapeHtml(materialKey(material.kind, material.id))}" data-material-edition="${material.sourceInfo.edition}"><span class="material-source">Источник: ${escapeHtml(source + page)}</span><span class="material-edition">${edition}</span>${errata}${replacement}</div>`;
}
