import { useEffect } from 'react';
import type { Picker, PickerOptions } from './picker';

export { registerTranslations, translationCount, findKeys } from './i18n';
export type { ComponentInfo, PickResult } from './core';
export type { Picker, PickerOptions } from './picker';

declare const process: { env: { NODE_ENV?: string } } | undefined;

const isProd =
  typeof process !== 'undefined' && process.env.NODE_ENV === 'production';

/**
 * Drop-in inspector. Renders nothing; installs a hotkey listener.
 *
 *   <ComponentPicker />
 *
 * The implementation sits behind a dynamic import guarded by NODE_ENV, so a
 * production build drops it entirely instead of shipping dead code. That means
 * you can leave this mounted unconditionally.
 */
export function ComponentPicker(props: PickerOptions = {}): null {
  const { hotkey, copy, log, onPick } = props;

  useEffect(() => {
    if (isProd) return;

    let picker: Picker | undefined;
    let cancelled = false;

    void import('./picker').then(({ Picker: Impl }) => {
      if (cancelled) return;
      picker = new Impl({ hotkey, copy, log, onPick });
    });

    return () => {
      cancelled = true;
      picker?.dispose();
    };
  }, [hotkey, copy, log, onPick]);

  return null;
}

/**
 * Framework-free setup, for apps that would rather not mount a component.
 * Resolves to null in production.
 */
export async function createPicker(
  options: PickerOptions = {}
): Promise<Picker | null> {
  if (isProd) return null;
  const { Picker: Impl } = await import('./picker');
  return new Impl(options);
}
