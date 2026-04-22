import type { NavMode } from '@/app/providers';

import type { AuthAccessGroup } from '@/features/auth';

type NavigationLocalEntryMeta = {
  description: string;
  keywords: readonly string[];
};

type NavigationBaseItem = {
  key: string;
  label: string;
  iconKey: string;
  navMode: NavMode;
};

export type NavigationLeafItem = NavigationBaseItem & {
  path: string;
  primaryAccessGroup: AuthAccessGroup;
  allowedAccessGroups?: readonly AuthAccessGroup[];
  slotGroup: string | null;
  localEntry?: NavigationLocalEntryMeta;
};

export type NavigationGroupItem = NavigationBaseItem & {
  allowedAccessGroups: readonly AuthAccessGroup[];
  children: NavigationLeafItem[];
};

export type NavigationMetaItem = NavigationGroupItem | NavigationLeafItem;

export function isNavigationGroupItem(item: NavigationMetaItem): item is NavigationGroupItem {
  return 'children' in item;
}

export function isNavigationLeafItem(item: NavigationMetaItem): item is NavigationLeafItem {
  return 'path' in item;
}

export type NavigationFilter = {
  accountId?: number;
  primaryAccessGroup: AuthAccessGroup;
  accessGroup: readonly AuthAccessGroup[];
  slotGroup: readonly string[];
  appEnv: 'dev' | 'test' | 'prod';
};

export type NavigationItemsProvider = (filter: NavigationFilter) => readonly NavigationMetaItem[];
