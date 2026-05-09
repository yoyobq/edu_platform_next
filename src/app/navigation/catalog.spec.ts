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
    ]);
    expect(findGroup(items, 'calendar-schedule')?.children.map((item) => item.key)).toEqual([
      '/calendar-schedule/semester-calendar',
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
    ]);
    expect(findGroup(items, 'labs')?.children.map((item) => item.key)).toEqual([
      '/labs/change-login-email',
      '/labs/invite-issuer',
      '/labs/upstream-session-demo',
      '/labs/academic-timetable',
      '/labs/academic-workload',
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
      ],
    );
    expect(
      findGroup(prodAdminItems, 'calendar-schedule')?.children.map((item) => item.key),
    ).toEqual(['/calendar-schedule/semester-calendar', '/calendar-schedule/semester-timetable']);
    expect(
      findGroup(prodAdminItems, 'academic-assistant')?.children.map((item) => item.key),
    ).toEqual([
      '/academic-affairs/my-teaching-logs',
      '/academic-affairs/integrated-plan-corrections',
    ]);
    expect(findGroup(prodAdminItems, 'labs')?.children.map((item) => item.key)).toEqual([
      '/labs/change-login-email',
      '/labs/invite-issuer',
      '/labs/upstream-session-demo',
      '/labs/academic-timetable',
      '/labs/academic-workload',
    ]);
    expect(
      findGroup(prodAdminItems, 'system-management')?.children.map((item) => item.key),
    ).toEqual(['/admin/users', '/admin/verification-issuance', '/errors/preview']);
  });

  it('shows the shared staff labs while keeping admin-only labs hidden', () => {
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
      'labs',
    ]);
    expect(findGroup(staffItems, 'calendar-schedule')?.children.map((item) => item.key)).toEqual([
      '/calendar-schedule/semester-calendar',
      '/calendar-schedule/semester-timetable',
    ]);
    expect(findGroup(staffItems, 'academic-assistant')?.children.map((item) => item.key)).toEqual([
      '/academic-affairs/my-teaching-logs',
      '/academic-affairs/integrated-plan-corrections',
    ]);
    expect(findGroup(staffItems, 'labs')?.children.map((item) => item.key)).toEqual([
      '/labs/academic-timetable',
      '/labs/academic-workload',
    ]);
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

    expect(findGroup(staffItems, 'labs')?.children.map((item) => item.key)).toEqual([
      '/labs/academic-timetable',
      '/labs/academic-workload',
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
      'labs',
    ]);
    expect(findGroup(staffItems, 'academic-affairs')?.children.map((item) => item.key)).toEqual([
      '/academic-affairs/academic-calendar',
      '/academic-affairs/staff-semester-profiles',
    ]);
    expect(findGroup(staffItems, 'calendar-schedule')?.children.map((item) => item.key)).toEqual([
      '/calendar-schedule/semester-calendar',
      '/calendar-schedule/semester-timetable',
    ]);
    expect(findGroup(staffItems, 'academic-assistant')?.children.map((item) => item.key)).toEqual([
      '/academic-affairs/my-teaching-logs',
      '/academic-affairs/integrated-plan-corrections',
    ]);
    expect(findGroup(staffItems, 'labs')?.children.map((item) => item.key)).toEqual([
      '/labs/academic-timetable',
      '/labs/academic-workload',
    ]);
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
  });

  it('continues exposing navigation leaf items for the local entry catalog', () => {
    const leaves = getNavigationLeafItems(buildFilter());

    expect(leaves.map((item) => item.key)).toEqual([
      '/',
      '/calendar-schedule/semester-calendar',
      '/calendar-schedule/semester-timetable',
      '/academic-affairs/my-teaching-logs',
      '/academic-affairs/integrated-plan-corrections',
      '/academic-affairs/academic-calendar',
      '/academic-affairs/semester-course-schedule-sync',
      '/academic-affairs/staff-semester-profiles',
      '/labs/change-login-email',
      '/labs/invite-issuer',
      '/labs/upstream-session-demo',
      '/labs/academic-timetable',
      '/labs/academic-workload',
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
