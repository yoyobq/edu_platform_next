import { type AuthAccessGroup, hasAdminOrAcademicOfficerAccess } from '@/shared/auth-access';

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
  const hasAdjustedWorkloadReportAccess = hasAdminOrAcademicOfficerAccess({
    accessGroup: filter.accessGroup,
    slotGroup: filter.slotGroup,
  });
  const children = [
    ...(hasAdjustedWorkloadReportAccess
      ? [
          {
            allowedAccessGroups: ['ADMIN', 'STAFF'] as const,
            iconKey: 'FileTextOutlined',
            key: '/labs/academic-adjusted-workload-report',
            label: '外聘兼课金',
            navMode: 'rail' as const,
            path: '/labs/academic-adjusted-workload-report',
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
    ...(hasLabNavigationAccess(['admin'], filter)
      ? [
          {
            allowedAccessGroups: ['ADMIN'] as const,
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
    },
  ];
};
