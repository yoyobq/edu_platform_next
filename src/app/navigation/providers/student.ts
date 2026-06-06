// src/app/navigation/providers/student.ts

import type { NavigationItemsProvider } from '../types';

const STUDENT_ALLOWED_ACCESS_GROUPS = ['STUDENT'] as const;

function hasStandaloneStudentAccess(filter: Parameters<NavigationItemsProvider>[0]) {
  return (
    filter.accessGroup.includes('STUDENT') &&
    !filter.accessGroup.includes('ADMIN') &&
    !filter.accessGroup.includes('STAFF')
  );
}

export const getStudentNavigationItems: NavigationItemsProvider = (filter) => {
  if (!hasStandaloneStudentAccess(filter)) {
    return [];
  }

  return [
    {
      allowedAccessGroups: STUDENT_ALLOWED_ACCESS_GROUPS,
      iconKey: 'CalendarOutlined',
      key: '/calendar-schedule/semester-calendar',
      label: '学期校历',
      navMode: 'rail',
      path: '/calendar-schedule/semester-calendar',
      primaryAccessGroup: 'STUDENT',
      slotGroup: null,
    },
  ];
};
