'use client';

import { useState } from 'react';
import { ComponentPicker } from './index';
import { registerTranslations } from './i18n';
import type { PickerOptions } from './picker';

export interface InspectorProps extends PickerOptions {
  /**
   * Your locale resources. Registered on the client, which is where the
   * picker actually runs — registering in a server component would build the
   * lookup map in the Node process and leave the browser with nothing.
   */
  messages?: Record<string, unknown>;
}

/**
 * App Router entry point. Marked 'use client', so it can be dropped straight
 * into a server-component layout.
 *
 *   import { Inspector } from 'react-i18n-inspector/next';
 *   import ko from '@/messages/ko.json';
 *
 *   <Inspector messages={ko} />
 */
export function Inspector({ messages, ...options }: InspectorProps): JSX.Element {
  // Register once, before first paint, rather than in an effect — the picker
  // may be armed before effects have flushed on a slow page.
  useState(() => {
    if (messages) registerTranslations(messages);
    return null;
  });

  return <ComponentPicker {...options} />;
}

export { registerTranslations, findKeys, translationCount } from './i18n';
export type { PickerOptions, PickResult, ComponentInfo } from './index';
