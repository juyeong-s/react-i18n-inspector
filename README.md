# react-i18n-inspector

Hover any element in your app to see which component renders it. If your app
is localized, you get the translation key too.

<!-- Replace with a real GIF. It matters more than anything else in this file. -->

```
┌─────────────────────────────┐
│ ▸ SaveButton                │
│   ↖ ModalFooter             │
│   ↖ OrderModal              │
│ ─────────────────────────── │
│ i18n  order.confirm.save    │
│ ─────────────────────────── │
│ click to copy · esc to exit │
└─────────────────────────────┘
```

## Why

**Finding the file behind what you see.** A bug report points at a button. In a
codebase you did not write, or wrote eight months ago, locating that button
means guessing at folder names and grepping for class names. Hover it instead
and you get `SaveButton ← ModalFooter ← OrderModal` — enough to grep straight
to the file.

React DevTools does this too, but it builds and continuously syncs a snapshot
of your entire tree, which is slow on large apps and prone to desync errors.
This reads the fiber on the one element under your cursor and walks up from
there, so it opens instantly no matter how big the app is.

**Finding it when the app is localized.** Once text goes through `t()`, the
string on screen exists nowhere in your source. Searching for what you see
returns nothing, so you open the locale file, scan it for the phrase, copy the
key, and grep again.

Register your locale JSON and the picker skips that detour — it maps the
rendered string back to `order.confirm.save` and hands you the key to grep.
Nothing else does this, and it is the reason this package exists.

## Install

```bash
npm i -D react-i18n-inspector    # pnpm add -D / yarn add -D
```

Requires React 16.8+. Works with Vite, webpack, Next.js, CRA, and Parcel.

## Setup

Mount it once. That alone gives you component names on hover.

```jsx
import { ComponentPicker, registerTranslations } from 'react-i18n-inspector';
import ko from './locales/ko.json';

if (process.env.NODE_ENV === 'development') {
  registerTranslations(ko);
}

export default function App() {
  return (
    <>
      {process.env.NODE_ENV === 'development' && <ComponentPicker />}
      <YourApp />
    </>
  );
}
```

The guards are optional — the picker compiles to a no-op in production either
way — but they also drop your locale JSON from the production bundle.

`registerTranslations` is what adds the key lookup on top. Drop it and the
picker still works as a plain component inspector.

### Next.js App Router

`layout.tsx` is a server component, so registering there would build the lookup
map in Node and leave the browser with nothing. Use the `/next` entry, which is
marked `'use client'` and registers on the client for you:

```tsx
import { Inspector } from 'react-i18n-inspector/next';
import ko from '@/messages/ko.json';

<Inspector messages={ko} />
```

Inside a component that already has `'use client'`, the plain setup above works
as-is.

### Namespaced locale files

Match the shape your `t()` calls expect, so the key you copy is the key you can
grep.

```js
registerTranslations({ common, order });  // → "order.confirm.save"
registerTranslations(order);              // → "confirm.save"
```

## Usage

| | |
|---|---|
| <kbd>⌘</kbd><kbd>⇧</kbd><kbd>C</kbd> | arm the picker (<kbd>Ctrl</kbd> on Windows/Linux) |
| hover | show component chain and i18n key |
| click | copy the key, log details to console, exit |
| <kbd>Esc</kbd> | exit |

Clicking copies the i18n key when there is one, otherwise the component name.
Then:

```bash
rg "order.confirm.save" src
```

### Options

```jsx
<ComponentPicker
  hotkey="mod+shift+c"
  copy={true}
  log={true}
  onPick={({ chain, i18nKeys, element }) => { ... }}
/>
```

`chain` is innermost-first: `[{ name, props }, ...]`.

## Notes

**Multiple keys.** If `"Save"` sits under three keys you get all three. Narrow
it down with the ancestor names in the card.

**Interpolation** matches by pattern, so `"Welcome, {{name}}"` resolves from
`"Welcome, Dana"`.

**`Anonymous` components** come from `export default () => {}`. Add a
`displayName` if it matters.

**React 19** removed `_debugSource`, so file and line numbers are unavailable
there. Component names still work.

**Production** minifies component names into things like `Nn`. This is a dev
tool only.

**Bundle impact** is ~200 bytes of no-op in your entry; the implementation
lands in a chunk that is never requested. Measured in [docs/BUNDLE.md](docs/BUNDLE.md).

## License

MIT
