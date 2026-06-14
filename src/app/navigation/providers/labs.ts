import { type AuthAccessGroup } from '@/shared/auth-access';

import type { NavigationItemsProvider } from '../types';

function hasAdminNavigationAccess(input: { accessGroup?: readonly AuthAccessGroup[] }) {
  return input.accessGroup?.includes('ADMIN') ?? false;
}

function hasStaffNavigationAccess(input: { accessGroup?: readonly AuthAccessGroup[] }) {
  return input.accessGroup?.includes('STAFF') ?? false;
}

function hasStudentNavigationAccess(input: { accessGroup?: readonly AuthAccessGroup[] }) {
  return input.accessGroup?.includes('STUDENT') ?? false;
}

function hasStudentCourseResultsLabNavigationAccess(
  filter: Parameters<NavigationItemsProvider>[0],
) {
  return filter.accessGroup.includes('ADMIN');
}

function hasLabNavigationAccess(
  allowedAccessLevels: readonly ('admin' | 'staff' | 'student' | 'guest')[],
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

    if (accessLevel === 'student') {
      return hasStudentNavigationAccess({
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
            iconKey: 'SendOutlined',
            key: '/labs/invite-issuer',
            label: '邀请管理',
            navMode: 'rail' as const,
            path: '/labs/invite-issuer',
            primaryAccessGroup: 'ADMIN' as const,
            slotGroup: null,
          },
          {
            allowedAccessGroups: ['ADMIN'] as const,
            iconKey: 'ApiOutlined',
            key: '/labs/upstream-session-reference',
            label: 'Upstream 会话基准',
            navMode: 'rail' as const,
            path: '/labs/upstream-session-reference',
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
    ...(hasStudentCourseResultsLabNavigationAccess(filter)
      ? [
          {
            allowedAccessGroups: ['ADMIN'] as const,
            iconKey: 'FileSearchOutlined',
            key: '/labs/student-course-results-pull',
            label: '学生成绩拉取',
            navMode: 'rail' as const,
            path: '/labs/student-course-results-pull',
            primaryAccessGroup: 'ADMIN' as const,
            slotGroup: null,
          },
          {
            allowedAccessGroups: ['ADMIN'] as const,
            iconKey: 'TableOutlined',
            key: '/labs/student-course-results-view',
            label: '学生成绩查看',
            navMode: 'rail' as const,
            path: '/labs/student-course-results-view',
            primaryAccessGroup: 'ADMIN' as const,
            slotGroup: null,
          },
        ]
      : []),
    ...(hasLabNavigationAccess(['admin', 'staff'], filter)
      ? [
          {
            allowedAccessGroups: ['ADMIN', 'STAFF'] as const,
            iconKey: 'FormOutlined',
            key: '/labs/zquiz-activity-builder',
            label: 'Zquiz 组卷',
            navMode: 'rail' as const,
            path: '/labs/zquiz-activity-builder',
            primaryAccessGroup: 'ADMIN' as const,
            slotGroup: null,
          },
        ]
      : []),
    ...(hasLabNavigationAccess(['admin', 'staff'], filter)
      ? [
          {
            allowedAccessGroups: ['ADMIN', 'STAFF'] as const,
            iconKey: 'FileSearchOutlined',
            key: '/labs/zquiz-exam-teacher-gradebook',
            label: '考试成绩分析',
            navMode: 'rail' as const,
            path: '/labs/zquiz-exam-teacher-gradebook',
            primaryAccessGroup: 'ADMIN' as const,
            slotGroup: null,
          },
        ]
      : []),
    ...(hasLabNavigationAccess(['student'], filter)
      ? [
          {
            allowedAccessGroups: ['STUDENT'] as const,
            iconKey: 'FileTextOutlined',
            key: '/labs/zquiz-exam-activities',
            label: '可选考试',
            navMode: 'rail' as const,
            path: '/labs/zquiz-exam-activities',
            primaryAccessGroup: 'STUDENT' as const,
            slotGroup: null,
          },
          {
            allowedAccessGroups: ['STUDENT'] as const,
            iconKey: 'PlaySquareOutlined',
            key: '/labs/zquiz-practice-activities',
            label: '可选练习',
            navMode: 'rail' as const,
            path: '/labs/zquiz-practice-activities',
            primaryAccessGroup: 'STUDENT' as const,
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
      allowedAccessGroups: ['ADMIN', 'STAFF', 'STUDENT'] as const,
      iconKey: 'ExperimentOutlined',
      key: 'labs',
      label: 'Labs',
      navMode: 'rail',
    },
  ];
};
