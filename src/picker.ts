import { inspect, hasReact, type PickResult } from './core';
import { findKeys } from './i18n';
import { Overlay } from './overlay';

export interface PickerOptions {
  /** Keyboard shortcut. Default: mod+shift+c (cmd on mac, ctrl elsewhere). */
  hotkey?: string;
  /** Called on pick, after the default copy-to-clipboard. */
  onPick?: (result: PickResult) => void;
  /**
   * Copy on pick: the first i18n key when one is found, otherwise the
   * component name. Default true.
   */
  copy?: boolean;
  /** Log the full result to the console on pick. Default true. */
  log?: boolean;
}

interface ParsedHotkey {
  mod: boolean;
  shift: boolean;
  alt: boolean;
  code: string;
}

function parseHotkey(hotkey: string): ParsedHotkey {
  const parts = hotkey.toLowerCase().split('+').map((p) => p.trim());
  const key = parts[parts.length - 1] ?? 'c';
  return {
    mod: parts.includes('mod') || parts.includes('ctrl') || parts.includes('cmd'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt') || parts.includes('option'),
    code: key.length === 1 ? `Key${key.toUpperCase()}` : key,
  };
}

const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * The overlay lives in a shadow root, so `event.target` is retargeted to the
 * host. `composedPath` still sees through it, which is what lets us tell a
 * click on the pinned card from a click outside it.
 */
function isOverlayEvent(e: Event): boolean {
  return e
    .composedPath()
    .some((n) => n instanceof Element && n.hasAttribute('data-rcp'));
}

export class Picker {
  private overlay = new Overlay();
  private opts: Required<Omit<PickerOptions, 'onPick'>> & Pick<PickerOptions, 'onPick'>;
  private hotkey: ParsedHotkey;
  private active = false;
  private pinned = false;
  private disposed = false;

  constructor(options: PickerOptions = {}) {
    this.opts = {
      hotkey: options.hotkey ?? 'mod+shift+c',
      copy: options.copy ?? true,
      log: options.log ?? true,
      onPick: options.onPick,
    };
    this.hotkey = parseHotkey(this.opts.hotkey);
    window.addEventListener('keydown', this.onKeyDown, true);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.active && e.key === 'Escape') {
      e.preventDefault();
      this.stop();
      return;
    }
    const h = this.hotkey;
    const modPressed = isMac ? e.metaKey : e.ctrlKey;
    if (
      e.code === h.code &&
      modPressed === h.mod &&
      e.shiftKey === h.shift &&
      e.altKey === h.alt
    ) {
      e.preventDefault();
      e.stopPropagation();
      this.toggle();
    }
  };

  toggle(): void {
    this.active ? this.stop() : this.start();
  }

  start(): void {
    if (this.active || this.disposed) return;
    this.active = true;
    this.pinned = false;

    if (!hasReact()) {
      console.warn(
        '[component-picker] No React fiber found on this page. ' +
          'Component names will be unavailable.'
      );
    }

    this.overlay.mount();
    document.addEventListener('mousemove', this.onMove, true);
    document.addEventListener('click', this.onClick, true);
    document.addEventListener('scroll', this.onScroll, true);
    document.documentElement.style.cursor = 'crosshair';
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    this.pinned = false;
    document.removeEventListener('mousemove', this.onMove, true);
    document.removeEventListener('click', this.onClick, true);
    document.removeEventListener('scroll', this.onScroll, true);
    document.documentElement.style.cursor = '';
    this.overlay.hide();
    this.overlay.unmount();
  }

  dispose(): void {
    this.stop();
    this.disposed = true;
    window.removeEventListener('keydown', this.onKeyDown, true);
  }

  private targetAt(x: number, y: number): Element | null {
    // elementFromPoint rather than event.target: the overlay host sits above
    // the page, and this keeps us reading the real element underneath.
    const el = document.elementFromPoint(x, y);
    if (!el || el.closest('[data-rcp]')) return null;
    return el;
  }

  private onScroll = (): void => {
    if (this.pinned) {
      this.overlay.follow();
      return;
    }
    this.overlay.hide();
  };

  private onMove = (e: MouseEvent): void => {
    const el = this.targetAt(e.clientX, e.clientY);
    if (!el) {
      this.overlay.hide();
      return;
    }
    this.overlay.render(el, inspect(el), findKeys(el), {
      x: e.clientX,
      y: e.clientY,
    });
  };

  private onClick = (e: MouseEvent): void => {
    e.preventDefault();
    e.stopPropagation();

    // Once pinned the card is interactive, so a click that reaches it is the
    // user reading or selecting its text. Anything else dismisses the pick.
    if (this.pinned) {
      if (!isOverlayEvent(e)) this.stop();
      return;
    }

    const el = this.targetAt(e.clientX, e.clientY);
    if (!el) return;

    const result: PickResult = {
      element: el,
      chain: inspect(el),
      i18nKeys: findKeys(el),
    };

    const name = result.chain[0]?.name.replace(/ \(.+\)$/, '');
    const grepTarget = result.i18nKeys[0] ?? name;

    if (this.opts.copy && grepTarget) {
      void navigator.clipboard?.writeText(grepTarget).then(
        () => this.overlay.toast(`copied: ${grepTarget}`),
        () => this.overlay.toast('clipboard blocked')
      );
    }

    if (this.opts.log) {
      /* eslint-disable no-console */
      console.groupCollapsed(
        `%c[picker]%c ${name ?? el.tagName.toLowerCase()}`,
        'color:#58a6ff;font-weight:bold',
        'color:inherit'
      );
      console.log('chain  ', result.chain.map((c) => c.name).join('  ←  '));
      if (result.i18nKeys.length) console.log('i18n   ', result.i18nKeys);
      console.log('props  ', result.chain[0]?.props);
      console.log('element', el);
      console.groupEnd();
      /* eslint-enable no-console */
    }

    this.opts.onPick?.(result);
    this.pin(el, result, { x: e.clientX, y: e.clientY });
  };

  /**
   * Freeze the card where it is so it can be read and its text selected.
   * Hover tracking stops; Escape or a click outside the card ends the pick.
   */
  private pin(
    el: Element,
    result: PickResult,
    mouse: { x: number; y: number }
  ): void {
    this.pinned = true;
    document.removeEventListener('mousemove', this.onMove, true);
    document.documentElement.style.cursor = '';
    this.overlay.render(el, result.chain, result.i18nKeys, mouse, true);
  }
}
