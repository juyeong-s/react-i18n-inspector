import { defineConfig } from 'tsup';

const shared = {
  format: ['esm', 'cjs'] as const,
  dts: true,
  external: ['react'],
  target: 'es2020' as const,
};

export default defineConfig([
  {
    ...shared,
    entry: ['src/index.tsx'],
    clean: true,
    treeshake: true,
  },
  {
    ...shared,
    entry: ['src/next.tsx'],
    clean: false,
    // Self-contained: no shared chunks, so the directive below covers
    // everything React Server Components will load through this entry.
    splitting: false,
    banner: { js: '"use client";' },
  },
]);
