import {
  hasAcademicTeachingLogAccess,
  hasAdminOrAcademicOfficerAccess,
} from '@/shared/auth-access';

import type { NavigationItemsProvider } from '../types';
import type { NavigationLeafItem } from '../types';

function hasAcademicAffairsNavigationAccess(filter: Parameters<NavigationItemsProvider>[0]) {
  return hasAdminOrAcademicOfficerAccess({
    accessGroup: filter.accessGroup,
    slotGroup: filter.slotGroup,
  });
}

export const getAcademicAffairsNavigationItems: NavigationItemsProvider = (filter) => {
  const children: NavigationLeafItem[] = [
    ...(hasAcademicAffairsNavigationAccess(filter)
      ? [
          {
            allowedAccessGroups: ['ADMIN', 'STAFF'] as const,
            iconKey: 'CalendarOutlined',
            key: '/academic-affairs/academic-calendar',
            label: '学期与校历事件',
            navMode: 'rail' as const,
            path: '/academic-affairs/academic-calendar',
            primaryAccessGroup: 'ADMIN' as const,
            slotGroup: null,
          },
          {
            allowedAccessGroups: ['ADMIN', 'STAFF'] as const,
            iconKey: 'CalendarOutlined',
            key: '/academic-affairs/semester-calendar',
            label: '学期校历',
            navMode: 'rail' as const,
            path: '/academic-affairs/semester-calendar',
            primaryAccessGroup: 'ADMIN' as const,
            slotGroup: null,
          },
          {
            allowedAccessGroups: ['ADMIN', 'STAFF'] as const,
            iconKey: 'SyncOutlined',
            key: '/academic-affairs/semester-course-schedule-sync',
            label: '学期课表同步',
            navMode: 'rail' as const,
            path: '/academic-affairs/semester-course-schedule-sync',
            primaryAccessGroup: 'ADMIN' as const,
            slotGroup: null,
          },
        ]
      : []),
    ...(hasAcademicTeachingLogAccess({
      accessGroup: filter.accessGroup,
    })
      ? [
          {
            allowedAccessGroups: ['ADMIN', 'STAFF'] as const,
            iconKey: 'FormOutlined',
            key: '/academic-affairs/my-teaching-logs',
            label: 'My 教学日志',
            navMode: 'rail' as const,
            path: '/academic-affairs/my-teaching-logs',
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
      allowedAccessGroups: ['ADMIN', 'STAFF'] as const,
      children,
      iconKey: 'ReadOutlined',
      key: 'academic-affairs',
      label: '教务管理',
      navMode: 'rail',
    },
  ];
};
