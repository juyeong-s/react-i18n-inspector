/**
 * i18n reverse lookup.
 *
 * The problem this solves: once text goes through `t('some.key')`, the string
 * in the DOM no longer appears anywhere in your source, so grepping the visible
 * text finds nothing. We keep a value -> key map so the picker can hand you the
 * key to grep for instead.
 */

let reverseMap = new Map<string, string[]>();

function flatten(
  obj: Record<string, unknown>,
  prefix: string,
  out: Map<string, string[]>
): void {
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') {
      const existing = out.get(v);
      if (existing) existing.push(path);
      else out.set(v, [path]);
    } else if (v && typeof v === 'object') {
      flatten(v as Record<string, unknown>, path, out);
    }
  }
}

/**
 * Register your locale resources. Pass the language you actually read while
 * developing — usually your source language.
 *
 *   registerTranslations(ko)
 *   registerTranslations({ common, order })  // namespaced files
 */
export function registerTranslations(resources: Record<string, unknown>): void {
  const map = new Map<string, string[]>();
  flatten(resources, '', map);
  reverseMap = map;
}

export function translationCount(): number {
  return reverseMap.size;
}

/** Strip interpolation so "Hello {{name}}" still matches "Hello Jun". */
function toPattern(template: string): RegExp | null {
  if (!/\{\{.+?\}\}|\{.+?\}|%s/.test(template)) return null;
  const escaped = template.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const withHoles = escaped
    .replace(/\\\{\\\{.+?\\\}\\\}/g, '.+?')
    .replace(/\\\{.+?\\\}/g, '.+?')
    .replace(/%s/g, '.+?');
  return new RegExp(`^${withHoles}$`);
}

/**
 * Find translation keys for the text rendered inside an element.
 * Exact matches first, then interpolated templates.
 */
export function findKeys(element: Element): string[] {
  if (reverseMap.size === 0) return [];

  const texts = new Set<string>();
  const direct = (element.textContent ?? '').trim();
  if (direct) texts.add(direct);

  // Attribute text is easy to miss and very common for i18n
  for (const attr of ['placeholder', 'title', 'aria-label', 'alt', 'value']) {
    const v = element.getAttribute?.(attr)?.trim();
    if (v) texts.add(v);
  }

  // Immediate text children, so a wrapper with several labels resolves each
  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const v = node.textContent?.trim();
      if (v) texts.add(v);
    }
  }

  const found = new Set<string>();

  for (const text of texts) {
    const exact = reverseMap.get(text);
    if (exact) exact.forEach((k) => found.add(k));
  }

  if (found.size === 0) {
    for (const [template, keys] of reverseMap) {
      const pattern = toPattern(template);
      if (!pattern) continue;
      for (const text of texts) {
        if (pattern.test(text)) keys.forEach((k) => found.add(k));
      }
    }
  }

  return Array.from(found);
}
