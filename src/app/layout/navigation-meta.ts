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
  primaryAccessGroup: AuthAccessGroup;
  accessGroup: readonly AuthAccessGroup[];
  slotGroup: readonly string[];
  appEnv: 'dev' | 'test' | 'prod';
};

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
];

export function getNavigationItems(filter: NavigationFilter): NavigationMetaItem[] {
  return registry.filter((item) => {
    if (item.primaryAccessGroup !== filter.primaryAccessGroup) {
      if (!filter.accessGroup.includes(item.primaryAccessGroup)) {
        return false;
      }
    }

    if (item.slotGroup !== null && !filter.slotGroup.includes(item.slotGroup)) {
      return false;
    }

    return true;
  });
}

export function resolveNavMode(primaryAccessGroup: AuthAccessGroup): NavMode {
  switch (primaryAccessGroup) {
    case 'ADMIN':
      return 'rail';
    default:
      return 'none';
  }
}
