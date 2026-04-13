import type { NavMode } from '@/app/providers';

import type { AuthAccessGroup } from '@/features/auth';

type NavigationLocalEntryMeta = {
  description: string;
  keywords: readonly string[];
};

export type NavigationMetaItem = {
  key: string;
  label: string;
  iconKey: string;
  path: string;
  primaryAccessGroup: AuthAccessGroup;
  allowedAccessGroups?: readonly AuthAccessGroup[];
  slotGroup: string | null;
  navMode: NavMode;
  localEntry?: NavigationLocalEntryMeta;
  children?: NavigationMetaItem[];
};

export type NavigationFilter = {
  accountId?: number;
  primaryAccessGroup: AuthAccessGroup;
  accessGroup: readonly AuthAccessGroup[];
  slotGroup: readonly string[];
  appEnv: 'dev' | 'test' | 'prod';
};

export type NavigationItemsProvider = (filter: NavigationFilter) => readonly NavigationMetaItem[];
