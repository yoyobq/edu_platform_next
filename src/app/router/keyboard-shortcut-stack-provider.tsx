import { type ReactNode, useEffect, useMemo, useRef } from 'react';

import {
  KeyboardShortcutStackContext,
  type KeyboardShortcutStackContextValue,
  type ShortcutPriority,
  type ShortcutRegistration,
} from './keyboard-shortcut-stack';

type ShortcutDefinition = ShortcutRegistration & {
  id: string;
  order: number;
};

const PRIORITY_ORDER: Record<ShortcutPriority, number> = {
  page: 0,
  sidecar: 1,
  'local-layer': 2,
  modal: 3,
};

function matchesShortcut(event: KeyboardEvent, shortcut: ShortcutDefinition): boolean {
  return (
    event.key === shortcut.key &&
    Boolean(shortcut.ctrlKey) === event.ctrlKey &&
    Boolean(shortcut.metaKey) === event.metaKey &&
    Boolean(shortcut.shiftKey) === event.shiftKey &&
    Boolean(shortcut.altKey) === event.altKey
  );
}

export function KeyboardShortcutStackProvider({ children }: { children: ReactNode }) {
  const shortcutRegistryRef = useRef<ShortcutDefinition[]>([]);
  const registrationOrderRef = useRef(0);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const activeShortcuts = [...shortcutRegistryRef.current].sort((left, right) => {
        const priorityDelta = PRIORITY_ORDER[right.priority] - PRIORITY_ORDER[left.priority];

        if (priorityDelta !== 0) {
          return priorityDelta;
        }

        return right.order - left.order;
      });

      for (const shortcut of activeShortcuts) {
        if (!matchesShortcut(event, shortcut)) {
          continue;
        }

        event.preventDefault();
        shortcut.handler(event);
        return;
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const value = useMemo<KeyboardShortcutStackContextValue>(
    () => ({
      registerShortcut: (shortcut) => {
        const id =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        registrationOrderRef.current += 1;

        shortcutRegistryRef.current = [
          ...shortcutRegistryRef.current,
          { ...shortcut, id, order: registrationOrderRef.current },
        ];

        return () => {
          shortcutRegistryRef.current = shortcutRegistryRef.current.filter(
            (item) => item.id !== id,
          );
        };
      },
    }),
    [],
  );

  return (
    <KeyboardShortcutStackContext.Provider value={value}>
      {children}
    </KeyboardShortcutStackContext.Provider>
  );
}
