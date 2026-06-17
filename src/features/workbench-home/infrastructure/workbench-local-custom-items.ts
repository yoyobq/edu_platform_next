// src/features/workbench-home/infrastructure/workbench-local-custom-items.ts

export type WorkbenchLocalCustomItem = {
  backgroundColor?: string;
  id: string;
  title: string;
};

export function isWorkbenchLocalCustomItem(value: unknown): value is WorkbenchLocalCustomItem {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const item = value as Partial<WorkbenchLocalCustomItem>;

  return (
    (item.backgroundColor === undefined || typeof item.backgroundColor === 'string') &&
    typeof item.id === 'string' &&
    typeof item.title === 'string'
  );
}

export function readWorkbenchLocalCustomItems(
  storageKey: string,
  options?: {
    fallbackItems?: readonly WorkbenchLocalCustomItem[];
  },
): WorkbenchLocalCustomItem[];

export function readWorkbenchLocalCustomItems<TItem extends WorkbenchLocalCustomItem>(
  storageKey: string,
  options: {
    fallbackItems?: readonly TItem[];
    isItem: (value: unknown) => value is TItem;
  },
): TItem[];

export function readWorkbenchLocalCustomItems<TItem extends WorkbenchLocalCustomItem>(
  storageKey: string,
  options?: {
    fallbackItems?: readonly TItem[];
    isItem?: (value: unknown) => value is TItem;
  },
): Array<TItem | WorkbenchLocalCustomItem> {
  const fallbackItems = options?.fallbackItems ? [...options.fallbackItems] : [];

  if (typeof window === 'undefined') {
    return fallbackItems;
  }

  try {
    const rawValue = window.localStorage.getItem(storageKey);

    if (!rawValue) {
      return fallbackItems;
    }

    const parsedValue = JSON.parse(rawValue);
    const isItem =
      options?.isItem ?? ((value): value is TItem => isWorkbenchLocalCustomItem(value));

    return Array.isArray(parsedValue) ? parsedValue.filter(isItem) : [];
  } catch {
    return fallbackItems;
  }
}

export function writeWorkbenchLocalCustomItems<TItem extends WorkbenchLocalCustomItem>(
  storageKey: string,
  items: readonly TItem[],
) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(items));
}

export function createWorkbenchLocalCustomItemId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
