import { hasAdminOrAcademicOfficerAccess } from '@/shared/auth-access';

import type { NavigationItemsProvider } from '../types';

function hasAcademicAffairsNavigationAccess(filter: Parameters<NavigationItemsProvider>[0]) {
  return hasAdminOrAcademicOfficerAccess({
    accessGroup: filter.accessGroup,
    slotGroup: filter.slotGroup,
  });
}

export const getAcademicAffairsNavigationItems: NavigationItemsProvider = (filter) => {
  if (!hasAcademicAffairsNavigationAccess(filter)) {
    return [];
  }

  return [
    {
      allowedAccessGroups: ['ADMIN', 'STAFF'] as const,
      children: [
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
      ],
      iconKey: 'ReadOutlined',
      key: 'academic-affairs',
      label: '教务管理',
      navMode: 'rail',
    },
  ];
};
