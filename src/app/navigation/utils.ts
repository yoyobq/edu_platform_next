import type {
  NavigationFilter,
  NavigationGroupItem,
  NavigationLeafItem,
  NavigationMetaItem,
} from './types';
import { isNavigationGroupItem } from './types';

function cloneNavigationLeafItem(item: NavigationLeafItem): NavigationLeafItem {
  return { ...item };
}

function cloneNavigationGroupItem(item: NavigationGroupItem): NavigationGroupItem {
  return { ...item, children: item.children.map(cloneNavigationLeafItem) };
}

function cloneNavigationItem(item: NavigationMetaItem): NavigationMetaItem {
  return isNavigationGroupItem(item)
    ? cloneNavigationGroupItem(item)
    : cloneNavigationLeafItem(item);
}

function canAccessByGroup(item: NavigationMetaItem, filter: NavigationFilter) {
  const allowedAccessGroups = isNavigationGroupItem(item)
    ? item.allowedAccessGroups
    : (item.allowedAccessGroups ?? [item.primaryAccessGroup]);

  return allowedAccessGroups.some((accessGroup) => filter.accessGroup.includes(accessGroup));
}

export function filterNavigationItems(
  items: readonly NavigationMetaItem[],
  filter: NavigationFilter,
): NavigationMetaItem[] {
  return items
    .map((item) => filterNavigationItem(item, filter))
    .filter((item): item is NavigationMetaItem => item !== null);
}

export function filterNavigationItem(
  item: NavigationMetaItem,
  filter: NavigationFilter,
): NavigationMetaItem | null {
  if (isNavigationGroupItem(item)) {
    const filteredChildren = filterNavigationItems(item.children, filter) as NavigationLeafItem[];

    if (filteredChildren.length === 0) {
      return null;
    }

    if (!canAccessByGroup(item, filter)) {
      return null;
    }

    return { ...item, children: filteredChildren };
  }

  if (!canAccessByGroup(item, filter)) {
    return null;
  }

  if (item.slotGroup !== null && !filter.slotGroup.includes(item.slotGroup)) {
    return null;
  }

  return item;
}

export function mergeNavigationItems(items: readonly NavigationMetaItem[]): NavigationMetaItem[] {
  const mergedItems: NavigationMetaItem[] = [];
  const indexByKey = new Map<string, number>();

  for (const item of items) {
    const existingIndex = indexByKey.get(item.key);

    if (existingIndex === undefined) {
      mergedItems.push(cloneNavigationItem(item));
      indexByKey.set(item.key, mergedItems.length - 1);
      continue;
    }

    mergedItems[existingIndex] = mergeNavigationItem(mergedItems[existingIndex], item);
  }

  return mergedItems;
}

function mergeNavigationItem(
  current: NavigationMetaItem,
  next: NavigationMetaItem,
): NavigationMetaItem {
  if (!isNavigationGroupItem(current) && !isNavigationGroupItem(next)) {
    return {
      ...current,
      allowedAccessGroups: current.allowedAccessGroups ?? next.allowedAccessGroups,
      localEntry: current.localEntry ?? next.localEntry,
    };
  }

  if (isNavigationGroupItem(current) && isNavigationGroupItem(next)) {
    return {
      ...current,
      allowedAccessGroups: current.allowedAccessGroups,
      children: mergeNavigationItems([
        ...current.children,
        ...next.children,
      ]) as NavigationLeafItem[],
    };
  }

  return cloneNavigationItem(current);
}

export function flattenNavigationItems(items: readonly NavigationMetaItem[]): NavigationLeafItem[] {
  return items.flatMap((item) =>
    isNavigationGroupItem(item) ? flattenNavigationItems(item.children) : [item],
  );
}

export function findNavigationItemByPath(
  items: readonly NavigationMetaItem[],
  path: string,
): NavigationLeafItem | null {
  for (const item of items) {
    if (isNavigationGroupItem(item)) {
      const matchedChild = findNavigationItemByPath(item.children, path);

      if (matchedChild) {
        return matchedChild;
      }

      continue;
    }

    if (item.path === path) {
      return item;
    }
  }

  return null;
}
