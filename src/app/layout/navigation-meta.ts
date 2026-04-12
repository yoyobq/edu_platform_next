// src/app/layout/navigation-meta.ts

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

export function hasAdminNavigationAccess(input: { accessGroup?: readonly AuthAccessGroup[] }) {
  return input.accessGroup?.includes('ADMIN') ?? false;
}

export function hasPayloadCryptoNavigationAccess(input: {
  accountId?: number;
  accessGroup?: readonly AuthAccessGroup[];
}) {
  const isSpecificAdmin = input.accountId === 1 || input.accountId === 2;
  const hasAdminAccess = hasAdminNavigationAccess({
    accessGroup: input.accessGroup,
  });

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
    allowedAccessGroups: ['ADMIN', 'GUEST'],
    slotGroup: null,
    localEntry: {
      description: '返回当前默认工作台首页，查看状态概览、主动作入口与最近上下文。',
      keywords: ['home', 'index', '默认工作台', '状态概览', '首页'],
    },
  },
  {
    iconKey: 'TeamOutlined',
    key: '/admin/users',
    label: '用户管理',
    navMode: 'rail',
    path: '/admin/users',
    primaryAccessGroup: 'ADMIN',
    slotGroup: null,
  },
  {
    iconKey: 'WarningOutlined',
    key: '/admin/error-preview',
    label: '异常页',
    navMode: 'rail',
    path: '/admin/error-preview',
    primaryAccessGroup: 'ADMIN',
    allowedAccessGroups: ['ADMIN', 'GUEST'],
    slotGroup: null,
    localEntry: {
      description: '预览系统内各类异常状态页面，检查 403 / 404 / 500 与路由崩溃的展示效果。',
      keywords: ['error', '异常', '异常页', '403', '404', '500', 'crash', '预览'],
    },
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
        localEntry: {
          description: '进入自由原型试验区，适合快速试错和页面试玩。',
          keywords: ['sandbox', '演练场', '原型', '试玩', '试验区', '沙盒'],
        },
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

export function getNavigationLeafItems(filter: NavigationFilter): NavigationMetaItem[] {
  return flattenNavigationItems(getNavigationItems(filter));
}

export function canAccessNavigationPath(path: string, filter: NavigationFilter) {
  return findNavigationItemByPath(registry, path, filter) !== null;
}

function filterItem(item: NavigationMetaItem, filter: NavigationFilter): NavigationMetaItem | null {
  if (item.children) {
    const filteredChildren = item.children
      .map((child) => filterItem(child, filter))
      .filter((child): child is NavigationMetaItem => child !== null);

    if (filteredChildren.length === 0) {
      return null;
    }

    if (item.slotGroup !== null && !filter.slotGroup.includes(item.slotGroup)) {
      return null;
    }

    return { ...item, children: filteredChildren };
  }

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

  const allowedAccessGroups = item.allowedAccessGroups ?? [item.primaryAccessGroup];

  if (!allowedAccessGroups.some((accessGroup) => filter.accessGroup.includes(accessGroup))) {
    return null;
  }

  if (item.slotGroup !== null && !filter.slotGroup.includes(item.slotGroup)) {
    return null;
  }

  return item;
}

export function resolveNavMode(filter: NavigationFilter): NavMode {
  return getNavigationItems(filter).some((item) => item.navMode !== 'none') ? 'rail' : 'none';
}

function flattenNavigationItems(items: readonly NavigationMetaItem[]): NavigationMetaItem[] {
  return items.flatMap((item) => (item.children ? flattenNavigationItems(item.children) : [item]));
}

function findNavigationItemByPath(
  items: readonly NavigationMetaItem[],
  path: string,
  filter: NavigationFilter,
): NavigationMetaItem | null {
  for (const item of items) {
    if (item.children) {
      const matchedChild = findNavigationItemByPath(item.children, path, filter);

      if (matchedChild) {
        return matchedChild;
      }

      continue;
    }

    if (item.path === path) {
      return filterItem(item, filter);
    }
  }

  return null;
}
