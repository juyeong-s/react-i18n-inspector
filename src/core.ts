/**
 * Fiber traversal. Deliberately lazy: we only ever walk UP from a single
 * clicked node, never across the whole tree. This is why the picker stays
 * instant on large apps where a full-tree snapshot would stall.
 */

export interface ComponentInfo {
  name: string;
  props: Record<string, unknown>;
  source?: { fileName: string; lineNumber: number };
}

export interface PickResult {
  element: Element;
  chain: ComponentInfo[];
  i18nKeys: string[];
}

type Fiber = {
  type: unknown;
  return: Fiber | null;
  memoizedProps: Record<string, unknown> | null;
  _debugSource?: { fileName: string; lineNumber: number };
  _debugOwner?: Fiber | null;
};

const FIBER_PREFIXES = ['__reactFiber$', '__reactInternalInstance$'];

export function getFiber(dom: Element): Fiber | null {
  for (const key of Object.keys(dom)) {
    for (const prefix of FIBER_PREFIXES) {
      if (key.startsWith(prefix)) {
        return (dom as unknown as Record<string, Fiber>)[key] ?? null;
      }
    }
  }
  return null;
}

/** Detect whether React is present at all, for a friendly warning. */
export function hasReact(): boolean {
  const root = document.body?.firstElementChild;
  if (root && getFiber(root)) return true;
  return Boolean(
    (window as unknown as Record<string, unknown>).__REACT_DEVTOOLS_GLOBAL_HOOK__
  );
}

/**
 * Resolve a fiber's `type` into a readable component name.
 * Handles memo / forwardRef / lazy wrappers, which otherwise show as objects.
 */
function resolveName(type: unknown): string | null {
  if (typeof type === 'function') {
    const fn = type as { displayName?: string; name?: string };
    return fn.displayName || fn.name || null;
  }

  if (typeof type === 'object' && type !== null) {
    const obj = type as {
      displayName?: string;
      render?: unknown;
      type?: unknown;
      $$typeof?: symbol;
    };
    if (obj.displayName) return obj.displayName;
    // forwardRef stores the fn on .render, memo on .type
    const inner = obj.render ?? obj.type;
    if (inner) {
      const name = resolveName(inner);
      if (name) {
        const tag = obj.render ? 'forwardRef' : 'memo';
        return `${name} (${tag})`;
      }
    }
  }

  return null;
}

/**
 * Walk up from a DOM node collecting composite components.
 * Host elements (div, span) are skipped — they are never what you grep for.
 */
export function inspect(element: Element, maxDepth = 8): ComponentInfo[] {
  let fiber = getFiber(element);
  const chain: ComponentInfo[] = [];
  const seen = new Set<unknown>();

  while (fiber && chain.length < maxDepth) {
    const name = resolveName(fiber.type);
    if (name && !seen.has(fiber.type)) {
      seen.add(fiber.type);
      chain.push({
        name,
        props: fiber.memoizedProps ?? {},
        // Present only when a JSX source babel plugin ran. Gone in React 19.
        source: fiber._debugSource,
      });
    }
    fiber = fiber.return;
  }

  return chain;
}
