import { type AuthAccessGroup } from '@/entities/auth-access';

import type { NavigationItemsProvider } from '../types';

// Stable navigation cannot import labs; these helpers only project menu exposure.
function hasAdminLabExposure(input: { accessGroup?: readonly AuthAccessGroup[] }) {
  return input.accessGroup?.includes('ADMIN') ?? false;
}

function hasStaffLabExposure(input: { accessGroup?: readonly AuthAccessGroup[] }) {
  return input.accessGroup?.includes('STAFF') ?? false;
}

function hasStudentLabExposure(input: { accessGroup?: readonly AuthAccessGroup[] }) {
  return input.accessGroup?.includes('STUDENT') ?? false;
}

function hasAllowedLabExposure(
  allowedAccessLevels: readonly ('admin' | 'staff' | 'student' | 'guest')[],
  filter: Parameters<NavigationItemsProvider>[0],
) {
  return allowedAccessLevels.some((accessLevel) => {
    if (accessLevel === 'admin') {
      return hasAdminLabExposure({
        accessGroup: filter.accessGroup,
      });
    }

    if (accessLevel === 'staff') {
      return hasStaffLabExposure({
        accessGroup: filter.accessGroup,
      });
    }

    if (accessLevel === 'student') {
      return hasStudentLabExposure({
        accessGroup: filter.accessGroup,
      });
    }

    return false;
  });
}

export const getLabsNavigationItems: NavigationItemsProvider = (filter) => {
  const children = [
    ...(hasAllowedLabExposure(['admin'], filter)
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
    ...(hasAllowedLabExposure(['admin'], filter)
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
    ...(hasAllowedLabExposure(['admin'], filter)
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
          {
            allowedAccessGroups: ['ADMIN'] as const,
            iconKey: 'FileSearchOutlined',
            key: '/labs/student-private-profile',
            label: '学生敏感资料',
            navMode: 'rail' as const,
            path: '/labs/student-private-profile',
            primaryAccessGroup: 'ADMIN' as const,
            slotGroup: null,
          },
        ]
      : []),
    ...(hasAllowedLabExposure(['admin', 'staff'], filter)
      ? [
          {
            allowedAccessGroups: ['ADMIN', 'STAFF'] as const,
            iconKey: 'CarryOutOutlined',
            key: '/labs/student-conduct-grade-governance',
            label: '操行治理',
            navMode: 'rail' as const,
            path: '/labs/student-conduct-grade-governance',
            primaryAccessGroup: 'STAFF' as const,
            slotGroup: null,
          },
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
    ...(hasAllowedLabExposure(['admin', 'staff'], filter)
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
    ...(hasAllowedLabExposure(['student'], filter)
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
