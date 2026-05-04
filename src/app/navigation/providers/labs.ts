import type { AuthAccessGroup } from '@/features/auth';

import { hasStaffSemesterProfilesAccess } from '@/shared/auth-access';

import type { NavigationItemsProvider } from '../types';

function hasAdminNavigationAccess(input: { accessGroup?: readonly AuthAccessGroup[] }) {
  return input.accessGroup?.includes('ADMIN') ?? false;
}

function hasStaffNavigationAccess(input: { accessGroup?: readonly AuthAccessGroup[] }) {
  return input.accessGroup?.includes('STAFF') ?? false;
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
    ...(hasStaffSemesterProfilesAccess({
      accessGroup: filter.accessGroup,
      slotGroup: filter.slotGroup,
    })
      ? [
          {
            allowedAccessGroups: ['ADMIN', 'STAFF'] as const,
            iconKey: 'TeamOutlined',
            key: '/labs/staff-semester-profiles',
            label: '教师学期归属',
            navMode: 'rail' as const,
            path: '/labs/staff-semester-profiles',
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
