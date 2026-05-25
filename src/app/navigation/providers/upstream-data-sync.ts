// src/app/navigation/providers/upstream-data-sync.ts

import type { AuthAccessGroup } from '@/shared/auth-access';

import type { NavigationItemsProvider } from '../types';

function hasUpstreamDataSyncNavigationAccess(input: { accessGroup?: readonly AuthAccessGroup[] }) {
  return input.accessGroup?.includes('ADMIN') ?? false;
}

export const getUpstreamDataSyncNavigationItems: NavigationItemsProvider = (filter) => {
  if (
    !hasUpstreamDataSyncNavigationAccess({
      accessGroup: filter.accessGroup,
    })
  ) {
    return [];
  }

  return [
    {
      allowedAccessGroups: ['ADMIN'] as const,
      children: [
        {
          allowedAccessGroups: ['ADMIN'] as const,
          iconKey: 'SyncOutlined',
          key: '/upstream-data-sync/semester-course-schedule-sync',
          label: '学期课表同步',
          navMode: 'rail' as const,
          path: '/upstream-data-sync/semester-course-schedule-sync',
          primaryAccessGroup: 'ADMIN' as const,
          slotGroup: null,
        },
      ],
      iconKey: 'SyncOutlined',
      key: 'upstream-data-sync',
      label: '上游数据同步',
      navMode: 'rail',
    },
  ];
};
