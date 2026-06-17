import {
  hasAcademicCalendarManagementAccess,
  hasAcademicCalendarReadAccess,
  hasAcademicCurriculumPlanHomepageAccess,
  hasAcademicIntegratedPlanCorrectionsAccess,
  hasAcademicTeachingLogAccess,
  hasAcademicTimetableAccess,
  hasAcademicTimetableManagerAccess,
  hasAcademicWorkloadAccess,
  hasClassAffairsCourseResultsAccess,
  hasStaffSemesterProfilesAccess,
  hasStudentRosterMembershipReconciliationAccess,
} from '@/entities/auth-access';

import type { NavigationItemsProvider } from '../types';
import type { NavigationLeafItem } from '../types';

function hasAcademicAffairsNavigationAccess(filter: Parameters<NavigationItemsProvider>[0]) {
  return hasAcademicCalendarManagementAccess({
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
        ]
      : []),
    ...(hasStaffSemesterProfilesAccess({
      accessGroup: filter.accessGroup,
      slotGroup: filter.slotGroup,
    })
      ? [
          {
            allowedAccessGroups: ['ADMIN', 'STAFF'] as const,
            iconKey: 'SolutionOutlined',
            key: '/academic-affairs/staff-semester-profiles',
            label: '教师学期归属',
            navMode: 'rail' as const,
            path: '/academic-affairs/staff-semester-profiles',
            primaryAccessGroup: 'STAFF' as const,
            slotGroup: null,
          },
        ]
      : []),
    ...(hasAcademicAffairsNavigationAccess(filter)
      ? [
          {
            allowedAccessGroups: ['ADMIN', 'STAFF'] as const,
            iconKey: 'FileTextOutlined',
            key: '/academic-affairs/academic-workload-report',
            label: '工作量预报',
            navMode: 'rail' as const,
            path: '/academic-affairs/academic-workload-report',
            primaryAccessGroup: 'ADMIN' as const,
            slotGroup: null,
          },
          {
            allowedAccessGroups: ['ADMIN', 'STAFF'] as const,
            iconKey: 'ScheduleOutlined',
            key: '/academic-affairs/academic-workload-deduction-summary',
            label: '节假日扣课',
            navMode: 'rail' as const,
            path: '/academic-affairs/academic-workload-deduction-summary',
            primaryAccessGroup: 'ADMIN' as const,
            slotGroup: null,
          },
          {
            allowedAccessGroups: ['ADMIN', 'STAFF'] as const,
            iconKey: 'FileTextOutlined',
            key: '/academic-affairs/external-teacher-compensation',
            label: '外聘兼课金',
            navMode: 'rail' as const,
            path: '/academic-affairs/external-teacher-compensation',
            primaryAccessGroup: 'ADMIN' as const,
            slotGroup: null,
          },
        ]
      : []),
  ];

  const calendarScheduleChildren: NavigationLeafItem[] = [
    ...(hasAcademicCalendarReadAccess({
      accessGroup: filter.accessGroup,
    })
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
          ...(hasAcademicTimetableManagerAccess({
            accessGroup: filter.accessGroup,
            slotGroup: filter.slotGroup,
          })
            ? [
                {
                  allowedAccessGroups: ['ADMIN', 'STAFF'] as const,
                  iconKey: 'TableOutlined',
                  key: '/calendar-schedule/weekly-timetable',
                  label: '每周课表',
                  navMode: 'rail' as const,
                  path: '/calendar-schedule/weekly-timetable',
                  primaryAccessGroup: 'STAFF' as const,
                  slotGroup: null,
                },
              ]
            : []),
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
            iconKey: 'BookOutlined',
            key: '/academic-affairs/my-teaching-logs',
            label: 'My 教学日志',
            navMode: 'rail' as const,
            path: '/academic-affairs/my-teaching-logs',
            primaryAccessGroup: 'STAFF' as const,
            slotGroup: null,
          },
        ]
      : []),
    ...(hasAcademicCurriculumPlanHomepageAccess({
      accessGroup: filter.accessGroup,
    })
      ? [
          {
            allowedAccessGroups: ['ADMIN', 'STAFF'] as const,
            badgeLabel: '试运行',
            iconKey: 'BookOutlined',
            key: '/academic-affairs/my-curriculum-plan-homepage',
            label: 'My 计划首页',
            navMode: 'rail' as const,
            path: '/academic-affairs/my-curriculum-plan-homepage',
            primaryAccessGroup: 'STAFF' as const,
            slotGroup: null,
          },
        ]
      : []),
    ...(hasAcademicIntegratedPlanCorrectionsAccess({
      accessGroup: filter.accessGroup,
    })
      ? [
          {
            allowedAccessGroups: ['ADMIN', 'STAFF'] as const,
            iconKey: 'FileSearchOutlined',
            key: '/academic-affairs/integrated-plan-corrections',
            label: '一体化对齐',
            navMode: 'rail' as const,
            path: '/academic-affairs/integrated-plan-corrections',
            primaryAccessGroup: 'STAFF' as const,
            slotGroup: null,
          },
        ]
      : []),
    ...(hasAcademicWorkloadAccess({
      accessGroup: filter.accessGroup,
    })
      ? [
          {
            allowedAccessGroups: ['ADMIN', 'STAFF'] as const,
            iconKey: 'CarryOutOutlined',
            key: '/academic-assistant/academic-workload',
            label: '工作量明细',
            navMode: 'rail' as const,
            path: '/academic-assistant/academic-workload',
            primaryAccessGroup: 'STAFF' as const,
            slotGroup: null,
          },
        ]
      : []),
  ];
  const classAffairsChildren: NavigationLeafItem[] = [
    ...(hasStudentRosterMembershipReconciliationAccess({
      accessGroup: filter.accessGroup,
    })
      ? [
          {
            allowedAccessGroups: ['STAFF'] as const,
            iconKey: 'ReconciliationOutlined',
            key: '/academic-affairs/student-roster-membership-reconciliation',
            label: '本地建班',
            navMode: 'rail' as const,
            path: '/academic-affairs/student-roster-membership-reconciliation',
            primaryAccessGroup: 'STAFF' as const,
            slotGroup: null,
          },
        ]
      : []),
    ...(hasClassAffairsCourseResultsAccess({
      accessGroup: filter.accessGroup,
      slotGroup: filter.slotGroup,
    })
      ? [
          {
            allowedAccessGroups: ['STAFF'] as const,
            iconKey: 'TableOutlined',
            key: '/class-affairs/course-results-summary',
            label: '成绩汇总',
            navMode: 'rail' as const,
            path: '/class-affairs/course-results-summary',
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
    ...(classAffairsChildren.length > 0
      ? [
          {
            allowedAccessGroups: ['STAFF'] as const,
            children: classAffairsChildren,
            iconKey: 'TeamOutlined',
            key: 'class-affairs',
            label: '班务管理',
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
