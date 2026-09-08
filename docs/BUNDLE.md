# Bundle impact

Measured with esbuild, minified, ESM, code splitting on, `NODE_ENV=production`,
React external — i.e. how Vite and webpack actually build a production app.

Test app:

```jsx
import { ComponentPicker } from 'react-i18n-inspector';
export default function App() {
  return <div><ComponentPicker /><h1>hi</h1></div>;
}
```

## Result

| File | Size | Fetched in production? |
|---|---|---|
| `app.js` (entry) | 486 B | yes |
| `picker-*.js` | 6.4 KB | **no** |
| `chunk-*.js` | 757 B | yes |

The entry keeps only the no-op wrapper:

```js
var l = typeof process < "u" && !0;      // → true in production
function c(u = {}) {
  ...
  return s(() => {
    if (l) return;                        // early return, import never runs
    import("./picker-….js").then(...)
  }, [...]), null
}
```

The implementation chunk is emitted to disk but never requested over the
network, because the dynamic `import()` is unreachable behind the guard.

## Reproducing

```bash
npm run build
npx esbuild test/app.jsx --bundle --minify --format=esm --splitting \
  --define:process.env.NODE_ENV='"production"' \
  --external:react --jsx=automatic \
  --alias:react-i18n-inspector=./dist/index.js \
  --outdir=/tmp/out
```

## Why not zero

Eliminating the emitted chunk entirely would require dropping the
`typeof process !== 'undefined'` guard so bundlers could constant-fold the
condition and DCE the import. That guard is what keeps the package from
throwing in environments that do not define `process`, so it stays.

If you want a truly zero-byte production path, gate the component yourself with
`import.meta.env.DEV` and the import disappears at build time.
