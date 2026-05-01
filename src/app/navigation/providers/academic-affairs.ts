import {
  hasAcademicTeachingLogAccess,
  hasAcademicTimetableAccess,
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
  const academicAffairsChildren: NavigationLeafItem[] = [
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
  ];

  const calendarScheduleChildren: NavigationLeafItem[] = [
    ...(hasAcademicAffairsNavigationAccess(filter)
      ? [
          {
            allowedAccessGroups: ['ADMIN', 'STAFF'] as const,
            iconKey: 'ScheduleOutlined',
            key: '/calendar-schedule/semester-calendar',
            label: '学期校历',
            navMode: 'rail' as const,
            path: '/calendar-schedule/semester-calendar',
            primaryAccessGroup: 'ADMIN' as const,
            slotGroup: null,
          },
        ]
      : []),
    ...(hasAcademicTimetableAccess({
      accessGroup: filter.accessGroup,
    })
      ? [
          {
            allowedAccessGroups: ['ADMIN', 'STAFF'] as const,
            iconKey: 'TableOutlined',
            key: '/calendar-schedule/semester-timetable',
            label: '学期课表',
            navMode: 'rail' as const,
            path: '/calendar-schedule/semester-timetable',
            primaryAccessGroup: 'STAFF' as const,
            slotGroup: null,
          },
        ]
      : []),
  ];

  const academicAssistantChildren: NavigationLeafItem[] = [
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

  return [
    ...(calendarScheduleChildren.length > 0
      ? [
          {
            allowedAccessGroups: ['ADMIN', 'STAFF'] as const,
            children: calendarScheduleChildren,
            iconKey: 'CalendarOutlined',
            key: 'calendar-schedule',
            label: '校历课表',
            navMode: 'rail' as const,
          },
        ]
      : []),
    ...(academicAssistantChildren.length > 0
      ? [
          {
            allowedAccessGroups: ['ADMIN', 'STAFF'] as const,
            children: academicAssistantChildren,
            iconKey: 'FormOutlined',
            key: 'academic-assistant',
            label: '教务助手',
            navMode: 'rail' as const,
          },
        ]
      : []),
    ...(academicAffairsChildren.length > 0
      ? [
          {
            allowedAccessGroups: ['ADMIN', 'STAFF'] as const,
            children: academicAffairsChildren,
            iconKey: 'ReadOutlined',
            key: 'academic-affairs',
            label: '教务管理',
            navMode: 'rail' as const,
          },
        ]
      : []),
  ];
};
