import type { SearchEntry } from '../types/search.ts';

export function plainSearchText(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ').replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code: string) => { const number = code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code); return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : ' '; })
    .replace(/&(nbsp|amp|lt|gt|quot|apos|mdash|ndash|hellip);/g, (_, name: string) => ({ nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", mdash: '—', ndash: '–', hellip: '…' })[name]!)
    .replace(/\s+/g, ' ').trim();
}
export function searchFeatureAnchor(name: string, level: number, subclass = false, index = 0): string {
  const slug = String(name || `feature-${index + 1}`).toLowerCase().trim().replace(/[\s/\\]+/g, '-').replace(/[^a-zа-я0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return `feature-${slug}-${level || index + 1}${subclass ? '-subclass' : ''}`;
}
function attribute(tag: string, name: string): string { return tag.match(new RegExp(`\\s${name}=["']([^"']*)["']`, 'i'))?.[1] || ''; }
// Input is rendered HTML from an explicit allowlist of public pages, never source files.
export function publicRuleEntries(html: string, url: string, pageTitle: string, ignoredIds: string[] = []): SearchEntry[] {
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main\s*>/i)?.[1] || html;
  const visible = main.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ');
  const entries: SearchEntry[] = [];
  const stack: { tag: string; id: string; hidden: boolean }[] = [];
  let heading: { tag: string; text: string; anchor: string } | null = null;
  let current: { title: string; anchor: string; body: string } = { title: pageTitle, anchor: '', body: '' };
  const flush = () => {
    const text = plainSearchText(current.body);
    if (text.length < 20) return;
    entries.push({ id: `rule:${url}:${entries.length}`, kind: 'rule', title: current.title, url: url + (current.anchor ? `#${encodeURIComponent(current.anchor)}` : ''), source: 'Лига Героев', text });
  };
  for (const token of visible.match(/<[^>]+>|[^<]+/g) || []) {
    if (!token.startsWith('<')) { if (!stack.some(node => node.hidden)) { if (heading) heading.text += token; else current.body += ' ' + token; } continue; }
    const closing = token.match(/^<\/([a-z0-9]+)/i);
    if (closing) {
      if (heading && closing[1].toLowerCase() === heading.tag) { flush(); current = { title: plainSearchText(heading.text) || pageTitle, anchor: heading.anchor, body: '' }; heading = null; }
      const at = stack.map(node => node.tag).lastIndexOf(closing[1].toLowerCase());
      if (at >= 0) stack.splice(at);
      continue;
    }
    const tag = token.match(/^<([a-z0-9]+)/i)?.[1].toLowerCase();
    if (!tag) continue;
    const hidden = ignoredIds.includes(attribute(token, 'id')) || /\shidden(?:\s|=|\/?>)/i.test(token) || attribute(token, 'aria-hidden') === 'true' || /display\s*:\s*none/i.test(attribute(token, 'style'));
    if (!['br', 'hr', 'img', 'input', 'meta', 'link', 'source', 'wbr'].includes(tag)) stack.push({ tag, id: attribute(token, 'id'), hidden });
    if (!stack.some(node => node.hidden) && /^(h[1-6]|summary)$/.test(tag)) heading = { tag, text: '', anchor: [...stack].reverse().find(node => node.id)?.id || '' };
  }
  flush();
  return entries;
}
