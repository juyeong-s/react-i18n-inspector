/**
 * Overlay UI. Lives in a shadow root so the host app's CSS (resets, global
 * selectors, Tailwind preflight) can never affect it, and so our styles never
 * leak into the app.
 */

import type { ComponentInfo } from './core';

const HOST_ID = 'rcp-overlay-host';

const STYLE = `
:host { all: initial; }
.box {
  position: fixed;
  pointer-events: none;
  background: rgba(88,166,255,.18);
  border: 1px solid #58a6ff;
  border-radius: 2px;
  transition: all .06s ease-out;
  z-index: 1;
}
.card {
  position: fixed;
  pointer-events: none;
  max-width: 420px;
  padding: 8px 10px;
  background: #0d1117;
  color: #e6edf3;
  border: 1px solid #30363d;
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0,0,0,.4);
  font: 12px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace;
  z-index: 2;
}
/* Pinned: take pointer events back so the text can be selected and copied. */
.card.pinned {
  pointer-events: auto;
  user-select: text;
  -webkit-user-select: text;
  border-color: #58a6ff;
}
.name { color: #7ee787; font-weight: 600; }
.anc  { color: #8b949e; }
.anc::before { content: '↖ '; }
.keys {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid #30363d;
  color: #ffa657;
}
.keys .label { color: #8b949e; }
.hint {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid #30363d;
  color: #6e7681;
  font-size: 11px;
}
.toast {
  position: fixed;
  left: 50%;
  bottom: 32px;
  transform: translateX(-50%);
  padding: 10px 16px;
  background: #0d1117;
  color: #7ee787;
  border: 1px solid #30363d;
  border-radius: 6px;
  font: 12px/1 ui-monospace, monospace;
  z-index: 3;
}
`;

export class Overlay {
  private host: HTMLDivElement;
  private root: ShadowRoot;
  private box: HTMLDivElement;
  private card: HTMLDivElement;
  private pinTarget: Element | null = null;
  private pinRect: DOMRect | null = null;
  private pinCard = { left: 0, top: 0 };

  constructor() {
    this.host = document.createElement('div');
    this.host.id = HOST_ID;
    this.host.setAttribute('data-rcp', '');
    Object.assign(this.host.style, {
      position: 'fixed',
      inset: '0',
      pointerEvents: 'none',
      zIndex: '2147483647',
    });

    this.root = this.host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = STYLE;
    this.root.appendChild(style);

    this.box = document.createElement('div');
    this.box.className = 'box';
    this.card = document.createElement('div');
    this.card.className = 'card';
    this.root.append(this.box, this.card);

    this.hide();
  }

  mount(): void {
    if (!this.host.isConnected) document.body.appendChild(this.host);
  }

  unmount(): void {
    this.host.remove();
  }

  hide(): void {
    this.box.style.display = 'none';
    this.card.style.display = 'none';
    this.card.classList.remove('pinned');
    this.pinTarget = null;
    this.pinRect = null;
  }

  render(
    target: Element,
    chain: ComponentInfo[],
    keys: string[],
    mouse: { x: number; y: number },
    pinned = false
  ): void {
    const rect = target.getBoundingClientRect();

    this.box.style.display = 'block';
    Object.assign(this.box.style, {
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });

    const [self, ...ancestors] = chain;
    const lines: string[] = [];

    if (self) {
      lines.push(`<div class="name">${esc(self.name)}</div>`);
      for (const a of ancestors.slice(0, 3)) {
        lines.push(`<div class="anc">${esc(a.name)}</div>`);
      }
    } else {
      lines.push(`<div class="anc">&lt;${target.tagName.toLowerCase()}&gt;</div>`);
    }

    if (keys.length) {
      const shown = keys.slice(0, 4).map(esc).join('<br>');
      lines.push(`<div class="keys"><span class="label">i18n</span> ${shown}</div>`);
    }

    lines.push(
      pinned
        ? '<div class="hint">esc or click outside to close</div>'
        : '<div class="hint">click to copy &middot; esc to exit</div>'
    );

    this.card.innerHTML = lines.join('');
    this.card.classList.toggle('pinned', pinned);
    this.card.style.display = 'block';

    // Flip near viewport edges so the card never runs off screen
    const cw = this.card.offsetWidth;
    const ch = this.card.offsetHeight;
    const left = mouse.x + 16 + cw > window.innerWidth ? mouse.x - cw - 16 : mouse.x + 16;
    const top = mouse.y + 16 + ch > window.innerHeight ? mouse.y - ch - 16 : mouse.y + 16;
    const cardLeft = Math.max(8, left);
    const cardTop = Math.max(8, top);
    this.card.style.left = `${cardLeft}px`;
    this.card.style.top = `${cardTop}px`;

    this.pinTarget = pinned ? target : null;
    this.pinRect = pinned ? rect : null;
    this.pinCard = { left: cardLeft, top: cardTop };
  }

  /**
   * Re-place a pinned card and its highlight after the page scrolls, so the
   * pair keeps tracking the element it was pinned to instead of drifting.
   */
  follow(): void {
    const target = this.pinTarget;
    const base = this.pinRect;
    if (!target || !base) return;

    const rect = target.getBoundingClientRect();
    Object.assign(this.box.style, {
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
    this.card.style.left = `${this.pinCard.left + (rect.left - base.left)}px`;
    this.card.style.top = `${this.pinCard.top + (rect.top - base.top)}px`;
  }

  toast(message: string): void {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    this.root.appendChild(el);
    setTimeout(() => el.remove(), 1600);
  }
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string
  );
}
