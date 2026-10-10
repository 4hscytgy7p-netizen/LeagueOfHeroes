export interface SearchableRule {
    id: string;
    name: string;
    nameEn?: string;
    category: string;
    text: string;
}

// Replacing ё preserves character offsets used to highlight the original text.
export function normalizeGlossaryText(value: string): string {
    return value.toLocaleLowerCase("ru").replace(/ё/g, "е");
}

export function findGlossaryRules<T extends SearchableRule>(rules: T[], query: string, categories: string[]): T[] {
    const needle = normalizeGlossaryText(query.trim());
    return rules
        .map((rule) => {
            const name = normalizeGlossaryText(rule.name);
            const english = normalizeGlossaryText(rule.nameEn || "");
            const rank = !needle || name.startsWith(needle) ? 0
                : name.includes(needle) ? 1
                : english.includes(needle) ? 2
                : normalizeGlossaryText(rule.text).includes(needle) ? 3 : -1;
            return { rule, rank };
        })
        .filter(({ rule, rank }) => rank !== -1 && (!categories.length || categories.includes(rule.category)))
        .sort((a, b) => a.rank - b.rank || a.rule.name.localeCompare(b.rule.name, "ru"))
        .map(({ rule }) => rule);
}

export function glossaryExcerpt(text: string, query: string): string {
    const needle = normalizeGlossaryText(query.trim());
    const position = needle ? normalizeGlossaryText(text).indexOf(needle) : -1;
    if (position < 0) return "";
    const start = Math.max(0, position - 45);
    const end = Math.min(text.length, position + needle.length + 85);
    return `${start ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}
