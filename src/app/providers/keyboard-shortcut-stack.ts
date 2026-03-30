// src/app/providers/keyboard-shortcut-stack.ts

import { createContext, useContext, useEffect } from 'react';

export type ShortcutPriority = 'page' | 'sidecar' | 'local-layer' | 'modal';

export type ShortcutRegistration = {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  priority: ShortcutPriority;
  handler: (event: KeyboardEvent) => void;
};

export type KeyboardShortcutStackContextValue = {
  registerShortcut: (shortcut: ShortcutRegistration) => () => void;
};

export const KeyboardShortcutStackContext = createContext<KeyboardShortcutStackContextValue | null>(
  null,
);

export function useKeyboardShortcutStack() {
  const contextValue = useContext(KeyboardShortcutStackContext);

  if (!contextValue) {
    throw new Error('useKeyboardShortcutStack must be used within KeyboardShortcutStackProvider.');
  }

  return contextValue;
}

export function useRegisterKeyboardShortcut(shortcut: ShortcutRegistration, enabled = true) {
  const { registerShortcut } = useKeyboardShortcutStack();
  const { altKey, ctrlKey, handler, key, metaKey, priority, shiftKey } = shortcut;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    return registerShortcut({
      altKey,
      ctrlKey,
      handler,
      key,
      metaKey,
      priority,
      shiftKey,
    });
  }, [altKey, ctrlKey, enabled, handler, key, metaKey, priority, registerShortcut, shiftKey]);
}
