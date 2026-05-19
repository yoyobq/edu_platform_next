import { describe, expect, it } from 'vitest';

import {
  canAccessNavigationPath,
  getNavigationItems,
  getNavigationLeafItems,
  isNavigationGroupItem,
  resolveNavMode,
} from './index';
import type { NavigationFilter } from './types';
import type { NavigationGroupItem, NavigationMetaItem } from './types';

function buildFilter(overrides?: Partial<NavigationFilter>): NavigationFilter {
  return {
    accountId: 1,
    primaryAccessGroup: 'ADMIN',
    accessGroup: ['ADMIN'],
    slotGroup: [],
    appEnv: 'dev',
    ...overrides,
  };
}

function findGroup(items: NavigationMetaItem[], key: string): NavigationGroupItem | undefined {
  const item = items.find((candidate) => candidate.key === key);

  return item && isNavigationGroupItem(item) ? item : undefined;
}

describe('navigation catalog', () => {
  it('merges domain providers into the current admin navigation tree', () => {
    const items = getNavigationItems(buildFilter());

    expect(items.map((item) => item.key)).toEqual([
      '/',
      'calendar-schedule',
      'academic-assistant',
      'academic-affairs',
      'labs',
      'system-management',
    ]);
    expect(findGroup(items, 'academic-affairs')?.children.map((item) => item.key)).toEqual([
      '/academic-affairs/academic-calendar',
      '/academic-affairs/semester-course-schedule-sync',
      '/academic-affairs/staff-semester-profiles',
      '/academic-affairs/academic-workload-report',
      '/academic-affairs/academic-workload-deduction-summary',
      '/academic-affairs/external-teacher-compensation',
    ]);
    expect(findGroup(items, 'calendar-schedule')?.children.map((item) => item.key)).toEqual([
      '/calendar-schedule/semester-calendar',
      '/calendar-schedule/weekly-timetable',
      '/calendar-schedule/semester-timetable',
    ]);
    expect(
      findGroup(items, 'calendar-schedule')?.children.find(
        (item) => item.key === '/calendar-schedule/semester-timetable',
      )?.iconKey,
    ).toBe('TableOutlined');
    expect(findGroup(items, 'academic-assistant')?.children.map((item) => item.key)).toEqual([
      '/academic-affairs/my-teaching-logs',
      '/academic-affairs/integrated-plan-corrections',
      '/academic-assistant/academic-workload',
    ]);
    expect(findGroup(items, 'labs')?.children.map((item) => item.key)).toEqual([
      '/labs/invite-issuer',
      '/labs/major-sync',
      '/labs/class-sync',
      '/labs/upstream-session-demo',
      '/sandbox/playground',
    ]);
    expect(findGroup(items, 'system-management')?.children.map((item) => item.key)).toEqual([
      '/admin/users',
      '/admin/verification-issuance',
      '/system/payload-crypto',
      '/errors/preview',
    ]);
  });

  it('preserves current special access rules after moving domain ownership', () => {
    const prodAdminItems = getNavigationItems(
      buildFilter({
        accountId: 99,
        appEnv: 'prod',
      }),
    );

    expect(findGroup(prodAdminItems, 'academic-affairs')?.children.map((item) => item.key)).toEqual(
      [
        '/academic-affairs/academic-calendar',
        '/academic-affairs/semester-course-schedule-sync',
        '/academic-affairs/staff-semester-profiles',
        '/academic-affairs/academic-workload-report',
        '/academic-affairs/academic-workload-deduction-summary',
        '/academic-affairs/external-teacher-compensation',
      ],
    );
    expect(
      findGroup(prodAdminItems, 'calendar-schedule')?.children.map((item) => item.key),
    ).toEqual([
      '/calendar-schedule/semester-calendar',
      '/calendar-schedule/weekly-timetable',
      '/calendar-schedule/semester-timetable',
    ]);
    expect(
      findGroup(prodAdminItems, 'academic-assistant')?.children.map((item) => item.key),
    ).toEqual([
      '/academic-affairs/my-teaching-logs',
      '/academic-affairs/integrated-plan-corrections',
      '/academic-assistant/academic-workload',
    ]);
    expect(findGroup(prodAdminItems, 'labs')?.children.map((item) => item.key)).toEqual([
      '/labs/invite-issuer',
      '/labs/major-sync',
      '/labs/class-sync',
      '/labs/upstream-session-demo',
    ]);
    expect(
      findGroup(prodAdminItems, 'system-management')?.children.map((item) => item.key),
    ).toEqual(['/admin/users', '/admin/verification-issuance', '/errors/preview']);
  });

  it('keeps labs hidden for regular staff', () => {
    const staffItems = getNavigationItems(
      buildFilter({
        accountId: 1001,
        primaryAccessGroup: 'STAFF',
        accessGroup: ['STAFF'],
      }),
    );

    expect(staffItems.map((item) => item.key)).toEqual([
      '/',
      'calendar-schedule',
      'academic-assistant',
    ]);
    expect(findGroup(staffItems, 'calendar-schedule')?.children.map((item) => item.key)).toEqual([
      '/calendar-schedule/semester-calendar',
      '/calendar-schedule/semester-timetable',
    ]);
    expect(findGroup(staffItems, 'academic-assistant')?.children.map((item) => item.key)).toEqual([
      '/academic-affairs/my-teaching-logs',
      '/academic-affairs/integrated-plan-corrections',
      '/academic-assistant/academic-workload',
    ]);
    expect(findGroup(staffItems, 'labs')).toBeUndefined();
  });

  it('exposes major and class sync labs to student affairs officers', () => {
    const staffItems = getNavigationItems(
      buildFilter({
        accountId: 1004,
        primaryAccessGroup: 'STAFF',
        accessGroup: ['STAFF'],
        slotGroup: ['STUDENT_AFFAIRS_OFFICER'],
      }),
    );

    expect(staffItems.map((item) => item.key)).toEqual([
      '/',
      'calendar-schedule',
      'academic-assistant',
      'labs',
    ]);
    expect(findGroup(staffItems, 'labs')?.children.map((item) => item.key)).toEqual([
      '/labs/major-sync',
      '/labs/class-sync',
    ]);
    expect(
      canAccessNavigationPath(
        '/labs/major-sync',
        buildFilter({
          accountId: 1004,
          primaryAccessGroup: 'STAFF',
          accessGroup: ['STAFF'],
          slotGroup: ['STUDENT_AFFAIRS_OFFICER'],
        }),
      ),
    ).toBe(true);
    expect(
      canAccessNavigationPath(
        '/labs/class-sync',
        buildFilter({
          accountId: 1004,
          primaryAccessGroup: 'STAFF',
          accessGroup: ['STAFF'],
          slotGroup: ['STUDENT_AFFAIRS_OFFICER'],
        }),
      ),
    ).toBe(true);
    expect(
      canAccessNavigationPath(
        '/labs/major-sync',
        buildFilter({
          accountId: 1002,
          primaryAccessGroup: 'STAFF',
          accessGroup: ['STAFF'],
          slotGroup: ['ACADEMIC_OFFICER'],
        }),
      ),
    ).toBe(false);
    expect(
      canAccessNavigationPath(
        '/labs/class-sync',
        buildFilter({
          accountId: 1002,
          primaryAccessGroup: 'STAFF',
          accessGroup: ['STAFF'],
          slotGroup: ['ACADEMIC_OFFICER'],
        }),
      ),
    ).toBe(false);
  });

  it('keeps staff semester profiles hidden from teaching group leaders', () => {
    const staffItems = getNavigationItems(
      buildFilter({
        accountId: 1003,
        primaryAccessGroup: 'STAFF',
        accessGroup: ['STAFF'],
        slotGroup: ['TEACHING_GROUP_LEADER'],
      }),
    );

    expect(findGroup(staffItems, 'academic-assistant')?.children.map((item) => item.key)).toEqual([
      '/academic-affairs/my-teaching-logs',
      '/academic-affairs/integrated-plan-corrections',
      '/academic-assistant/academic-workload',
    ]);
    expect(findGroup(staffItems, 'labs')).toBeUndefined();
    expect(findGroup(staffItems, 'calendar-schedule')?.children.map((item) => item.key)).toEqual([
      '/calendar-schedule/semester-calendar',
      '/calendar-schedule/weekly-timetable',
      '/calendar-schedule/semester-timetable',
    ]);
  });

  it('shows academic calendar but keeps course schedule sync admin-only for academic officers', () => {
    const staffItems = getNavigationItems(
      buildFilter({
        accountId: 1002,
        primaryAccessGroup: 'STAFF',
        accessGroup: ['STAFF'],
        slotGroup: ['ACADEMIC_OFFICER'],
      }),
    );

    expect(staffItems.map((item) => item.key)).toEqual([
      '/',
      'calendar-schedule',
      'academic-assistant',
      'academic-affairs',
    ]);
    expect(findGroup(staffItems, 'academic-affairs')?.children.map((item) => item.key)).toEqual([
      '/academic-affairs/academic-calendar',
      '/academic-affairs/staff-semester-profiles',
      '/academic-affairs/academic-workload-report',
      '/academic-affairs/academic-workload-deduction-summary',
      '/academic-affairs/external-teacher-compensation',
    ]);
    expect(findGroup(staffItems, 'calendar-schedule')?.children.map((item) => item.key)).toEqual([
      '/calendar-schedule/semester-calendar',
      '/calendar-schedule/weekly-timetable',
      '/calendar-schedule/semester-timetable',
    ]);
    expect(findGroup(staffItems, 'academic-assistant')?.children.map((item) => item.key)).toEqual([
      '/academic-affairs/my-teaching-logs',
      '/academic-affairs/integrated-plan-corrections',
      '/academic-assistant/academic-workload',
    ]);
    expect(findGroup(staffItems, 'labs')).toBeUndefined();
    expect(
      canAccessNavigationPath('/academic-affairs/staff-semester-profiles', {
        accountId: 1002,
        primaryAccessGroup: 'STAFF',
        accessGroup: ['STAFF'],
        slotGroup: ['ACADEMIC_OFFICER'],
        appEnv: 'dev',
      }),
    ).toBe(true);
    expect(
      canAccessNavigationPath('/academic-affairs/semester-course-schedule-sync', {
        accountId: 1002,
        primaryAccessGroup: 'STAFF',
        accessGroup: ['STAFF'],
        slotGroup: ['ACADEMIC_OFFICER'],
        appEnv: 'dev',
      }),
    ).toBe(false);
    expect(
      canAccessNavigationPath('/academic-affairs/academic-workload-report', {
        accountId: 1002,
        primaryAccessGroup: 'STAFF',
        accessGroup: ['STAFF'],
        slotGroup: ['ACADEMIC_OFFICER'],
        appEnv: 'dev',
      }),
    ).toBe(true);
    expect(
      canAccessNavigationPath('/academic-affairs/external-teacher-compensation', {
        accountId: 1002,
        primaryAccessGroup: 'STAFF',
        accessGroup: ['STAFF'],
        slotGroup: ['ACADEMIC_OFFICER'],
        appEnv: 'dev',
      }),
    ).toBe(true);
  });

  it('keeps route guard access checks aligned with filtered navigation results', () => {
    const guestFilter = buildFilter({
      primaryAccessGroup: 'GUEST',
      accessGroup: ['GUEST'],
    });
    const studentFilter = buildFilter({
      primaryAccessGroup: 'STUDENT',
      accessGroup: ['STUDENT'],
    });

    expect(canAccessNavigationPath('/', guestFilter)).toBe(true);
    expect(canAccessNavigationPath('/', studentFilter)).toBe(true);
    expect(canAccessNavigationPath('/errors/preview', guestFilter)).toBe(true);
    expect(canAccessNavigationPath('/admin/users', guestFilter)).toBe(false);
    expect(canAccessNavigationPath('/admin/verification-issuance', guestFilter)).toBe(false);
    expect(canAccessNavigationPath('/admin/verification-issuance', buildFilter())).toBe(true);
    expect(
      canAccessNavigationPath(
        '/calendar-schedule/semester-timetable',
        buildFilter({
          primaryAccessGroup: 'STAFF',
          accessGroup: ['STAFF'],
        }),
      ),
    ).toBe(true);
    expect(
      canAccessNavigationPath(
        '/academic-affairs/integrated-plan-corrections',
        buildFilter({
          primaryAccessGroup: 'STAFF',
          accessGroup: ['STAFF'],
        }),
      ),
    ).toBe(true);
    expect(
      canAccessNavigationPath('/academic-affairs/integrated-plan-corrections', studentFilter),
    ).toBe(false);
    expect(
      canAccessNavigationPath(
        '/academic-assistant/academic-workload',
        buildFilter({
          primaryAccessGroup: 'STAFF',
          accessGroup: ['STAFF'],
        }),
      ),
    ).toBe(true);
    expect(canAccessNavigationPath('/academic-assistant/academic-workload', studentFilter)).toBe(
      false,
    );
    expect(
      canAccessNavigationPath('/academic-affairs/academic-workload-report', buildFilter()),
    ).toBe(true);
    expect(
      canAccessNavigationPath('/academic-affairs/external-teacher-compensation', buildFilter()),
    ).toBe(true);
    expect(canAccessNavigationPath('/labs/academic-adjusted-workload-report', buildFilter())).toBe(
      false,
    );
    expect(
      canAccessNavigationPath(
        '/academic-affairs/academic-workload-deduction-summary',
        buildFilter(),
      ),
    ).toBe(true);
    expect(
      canAccessNavigationPath(
        '/academic-affairs/academic-workload-deduction-summary',
        buildFilter({
          primaryAccessGroup: 'STAFF',
          accessGroup: ['STAFF'],
          slotGroup: ['ACADEMIC_OFFICER'],
        }),
      ),
    ).toBe(true);
    expect(
      canAccessNavigationPath(
        '/academic-affairs/academic-workload-report',
        buildFilter({
          primaryAccessGroup: 'STAFF',
          accessGroup: ['STAFF'],
          slotGroup: ['TEACHING_GROUP_LEADER'],
        }),
      ),
    ).toBe(false);
    expect(
      canAccessNavigationPath(
        '/academic-affairs/external-teacher-compensation',
        buildFilter({
          primaryAccessGroup: 'STAFF',
          accessGroup: ['STAFF'],
          slotGroup: ['TEACHING_GROUP_LEADER'],
        }),
      ),
    ).toBe(false);
    expect(
      canAccessNavigationPath(
        '/labs/academic-adjusted-workload-report',
        buildFilter({
          primaryAccessGroup: 'STAFF',
          accessGroup: ['STAFF'],
          slotGroup: ['TEACHING_GROUP_LEADER'],
        }),
      ),
    ).toBe(false);
    expect(
      canAccessNavigationPath(
        '/academic-affairs/academic-workload-deduction-summary',
        buildFilter({
          primaryAccessGroup: 'STAFF',
          accessGroup: ['STAFF'],
          slotGroup: ['TEACHING_GROUP_LEADER'],
        }),
      ),
    ).toBe(false);
    expect(
      canAccessNavigationPath('/labs/academic-workload-deduction-summary', buildFilter()),
    ).toBe(false);
    expect(canAccessNavigationPath('/labs/academic-workload', buildFilter())).toBe(false);
    expect(
      canAccessNavigationPath(
        '/labs/academic-workload-deduction-summary',
        buildFilter({
          primaryAccessGroup: 'STAFF',
          accessGroup: ['STAFF'],
        }),
      ),
    ).toBe(false);
  });

  it('continues exposing navigation leaf items for the local entry catalog', () => {
    const leaves = getNavigationLeafItems(buildFilter());

    expect(leaves.map((item) => item.key)).toEqual([
      '/',
      '/calendar-schedule/semester-calendar',
      '/calendar-schedule/weekly-timetable',
      '/calendar-schedule/semester-timetable',
      '/academic-affairs/my-teaching-logs',
      '/academic-affairs/integrated-plan-corrections',
      '/academic-assistant/academic-workload',
      '/academic-affairs/academic-calendar',
      '/academic-affairs/semester-course-schedule-sync',
      '/academic-affairs/staff-semester-profiles',
      '/academic-affairs/academic-workload-report',
      '/academic-affairs/academic-workload-deduction-summary',
      '/academic-affairs/external-teacher-compensation',
      '/labs/invite-issuer',
      '/labs/major-sync',
      '/labs/class-sync',
      '/labs/upstream-session-demo',
      '/sandbox/playground',
      '/admin/users',
      '/admin/verification-issuance',
      '/system/payload-crypto',
      '/errors/preview',
    ]);
    expect(leaves.filter((item) => item.localEntry).map((item) => item.key)).toEqual([
      '/',
      '/sandbox/playground',
      '/errors/preview',
    ]);
  });

  it('keeps nav mode resolution unchanged for visible and empty navigation states', () => {
    expect(resolveNavMode(buildFilter())).toBe('rail');
    expect(
      resolveNavMode(
        buildFilter({
          primaryAccessGroup: 'STUDENT',
          accessGroup: ['STUDENT'],
          accountId: 2001,
        }),
      ),
    ).toBe('rail');
  });
});
