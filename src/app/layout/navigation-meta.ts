// src/app/layout/navigation-meta.ts

import type { NavMode } from '@/app/providers';

import type { AuthAccessGroup } from '@/features/auth';

export type NavigationMetaItem = {
  key: string;
  label: string;
  iconKey: string;
  path: string;
  primaryAccessGroup: AuthAccessGroup;
  slotGroup: string | null;
  navMode: NavMode;
  children?: NavigationMetaItem[];
};

type NavigationFilter = {
  accountId?: number;
  primaryAccessGroup: AuthAccessGroup;
  accessGroup: readonly AuthAccessGroup[];
  slotGroup: readonly string[];
  appEnv: 'dev' | 'test' | 'prod';
};

export function hasPayloadCryptoNavigationAccess(input: {
  accountId?: number;
  accessGroup?: readonly AuthAccessGroup[];
}) {
  const isSpecificAdmin = input.accountId === 1 || input.accountId === 2;
  const hasAdminAccess = input.accessGroup?.includes('ADMIN') ?? false;

  return isSpecificAdmin && hasAdminAccess;
}

const registry: NavigationMetaItem[] = [
  {
    iconKey: 'HomeOutlined',
    key: '/',
    label: '首页',
    navMode: 'rail',
    path: '/',
    primaryAccessGroup: 'ADMIN',
    slotGroup: null,
  },
  {
    children: [
      {
        iconKey: 'LockOutlined',
        key: '/labs/payload-crypto',
        label: '载荷加解密',
        navMode: 'rail',
        path: '/labs/payload-crypto',
        primaryAccessGroup: 'ADMIN',
        slotGroup: null,
      },
      {
        iconKey: 'SendOutlined',
        key: '/labs/invite-issuer',
        label: '邀请管理',
        navMode: 'rail',
        path: '/labs/invite-issuer',
        primaryAccessGroup: 'ADMIN',
        slotGroup: null,
      },
      {
        iconKey: 'CodeOutlined',
        key: '/sandbox/playground',
        label: '沙盒演练场',
        navMode: 'rail',
        path: '/sandbox/playground',
        primaryAccessGroup: 'ADMIN',
        slotGroup: null,
      },
    ],
    iconKey: 'ExperimentOutlined',
    key: 'labs',
    label: 'Labs',
    navMode: 'rail',
    path: '/labs',
    primaryAccessGroup: 'ADMIN',
    slotGroup: null,
  },
];

export function getNavigationItems(filter: NavigationFilter): NavigationMetaItem[] {
  return registry
    .map((item) => filterItem(item, filter))
    .filter((item): item is NavigationMetaItem => item !== null);
}

function filterItem(item: NavigationMetaItem, filter: NavigationFilter): NavigationMetaItem | null {
  // payload-crypto: hard-coded access check
  if (
    item.key === '/labs/payload-crypto' &&
    !hasPayloadCryptoNavigationAccess({
      accountId: filter.accountId,
      accessGroup: filter.accessGroup,
    })
  ) {
    return null;
  }

  // sandbox: dev/test only
  if (item.key === '/sandbox/playground') {
    if (filter.appEnv !== 'dev' && filter.appEnv !== 'test') {
      return null;
    }
  }

  if (item.primaryAccessGroup !== filter.primaryAccessGroup) {
    if (!filter.accessGroup.includes(item.primaryAccessGroup)) {
      return null;
    }
  }

  if (item.slotGroup !== null && !filter.slotGroup.includes(item.slotGroup)) {
    return null;
  }

  // Recursively filter children
  if (item.children) {
    const filteredChildren = item.children
      .map((child) => filterItem(child, filter))
      .filter((child): child is NavigationMetaItem => child !== null);

    // Drop group if all children were filtered out
    if (filteredChildren.length === 0) {
      return null;
    }

    return { ...item, children: filteredChildren };
  }

  return item;
}

export function resolveNavMode(primaryAccessGroup: AuthAccessGroup): NavMode {
  switch (primaryAccessGroup) {
    case 'ADMIN':
      return 'rail';
    default:
      return 'none';
  }
}
