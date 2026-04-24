import type { AuthAccessGroup } from '@/features/auth';

import type { NavigationItemsProvider } from '../types';

function hasAdminNavigationAccess(input: { accessGroup?: readonly AuthAccessGroup[] }) {
  return input.accessGroup?.includes('ADMIN') ?? false;
}

function hasStaffNavigationAccess(input: { accessGroup?: readonly AuthAccessGroup[] }) {
  return input.accessGroup?.includes('STAFF') ?? false;
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

function hasLabNavigationAccess(
  allowedAccessLevels: readonly ('admin' | 'staff' | 'guest')[],
  filter: Parameters<NavigationItemsProvider>[0],
) {
  return allowedAccessLevels.some((accessLevel) => {
    if (accessLevel === 'admin') {
      return hasAdminNavigationAccess({
        accessGroup: filter.accessGroup,
      });
    }

    if (accessLevel === 'staff') {
      return hasStaffNavigationAccess({
        accessGroup: filter.accessGroup,
      });
    }

    return false;
  });
}

export const getLabsNavigationItems: NavigationItemsProvider = (filter) => {
  const children = [
    ...(hasPayloadCryptoNavigationAccess({
      accountId: filter.accountId,
      accessGroup: filter.accessGroup,
    })
      ? [
          {
            iconKey: 'LockOutlined',
            key: '/labs/payload-crypto',
            label: '载荷加解密',
            navMode: 'rail' as const,
            path: '/labs/payload-crypto',
            primaryAccessGroup: 'ADMIN' as const,
            slotGroup: null,
          },
        ]
      : []),
    ...(hasLabNavigationAccess(['admin'], filter)
      ? [
          {
            iconKey: 'MailOutlined',
            key: '/labs/change-login-email',
            label: '登录邮箱变更',
            navMode: 'rail' as const,
            path: '/labs/change-login-email',
            primaryAccessGroup: 'ADMIN' as const,
            slotGroup: null,
          },
        ]
      : []),
    ...(hasLabNavigationAccess(['admin'], filter)
      ? [
          {
            iconKey: 'SendOutlined',
            key: '/labs/invite-issuer',
            label: '邀请管理',
            navMode: 'rail' as const,
            path: '/labs/invite-issuer',
            primaryAccessGroup: 'ADMIN' as const,
            slotGroup: null,
          },
        ]
      : []),
    ...(hasLabNavigationAccess(['admin', 'staff'], filter)
      ? [
          {
            allowedAccessGroups: ['ADMIN', 'STAFF'] as const,
            iconKey: 'ApiOutlined',
            key: '/labs/upstream-session-demo',
            label: 'Upstream 会话示例',
            navMode: 'rail' as const,
            path: '/labs/upstream-session-demo',
            primaryAccessGroup: 'ADMIN' as const,
            slotGroup: null,
          },
        ]
      : []),
    ...(hasLabNavigationAccess(['admin', 'staff'], filter)
      ? [
          {
            allowedAccessGroups: ['ADMIN', 'STAFF'] as const,
            iconKey: 'CalendarOutlined',
            key: '/labs/semester-calendar',
            label: '学期校历',
            navMode: 'rail' as const,
            path: '/labs/semester-calendar',
            primaryAccessGroup: 'STAFF' as const,
            slotGroup: null,
          },
        ]
      : []),
    ...(hasLabNavigationAccess(['admin', 'staff'], filter)
      ? [
          {
            allowedAccessGroups: ['ADMIN', 'STAFF'] as const,
            iconKey: 'CalendarOutlined',
            key: '/labs/academic-timetable',
            label: '课表视图',
            navMode: 'rail' as const,
            path: '/labs/academic-timetable',
            primaryAccessGroup: 'STAFF' as const,
            slotGroup: null,
          },
        ]
      : []),
    ...(hasLabNavigationAccess(['admin', 'staff'], filter)
      ? [
          {
            allowedAccessGroups: ['ADMIN', 'STAFF'] as const,
            iconKey: 'BarChartOutlined',
            key: '/labs/academic-workload',
            label: '教师工作量',
            navMode: 'rail' as const,
            path: '/labs/academic-workload',
            primaryAccessGroup: 'STAFF' as const,
            slotGroup: null,
          },
        ]
      : []),
  ];

  if (children.length === 0) {
    return [];
  }

  return [
    {
      children,
      allowedAccessGroups: ['ADMIN', 'STAFF'] as const,
      iconKey: 'ExperimentOutlined',
      key: 'labs',
      label: 'Labs',
      navMode: 'rail',
      path: '/labs',
      primaryAccessGroup: 'ADMIN',
      slotGroup: null,
    },
  ];
};
