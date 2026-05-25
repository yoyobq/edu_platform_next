// src/app/navigation/providers/upstream-data-sync.ts

import { hasUpstreamDataSyncAccess } from '@/shared/auth-access';

import type { NavigationItemsProvider } from '../types';

export const getUpstreamDataSyncNavigationItems: NavigationItemsProvider = (filter) => {
  if (
    !hasUpstreamDataSyncAccess({
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
          key: '/upstream-data-sync/major-sync',
          label: '专业同步',
          navMode: 'rail' as const,
          path: '/upstream-data-sync/major-sync',
          primaryAccessGroup: 'ADMIN' as const,
          slotGroup: null,
        },
        {
          allowedAccessGroups: ['ADMIN'] as const,
          iconKey: 'TableOutlined',
          key: '/upstream-data-sync/class-sync',
          label: '班级同步',
          navMode: 'rail' as const,
          path: '/upstream-data-sync/class-sync',
          primaryAccessGroup: 'ADMIN' as const,
          slotGroup: null,
        },
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
