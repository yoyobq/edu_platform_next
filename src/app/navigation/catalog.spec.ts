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
      '/admin/users',
      'academic-affairs',
      '/errors/preview',
      'labs',
    ]);
    expect(findGroup(items, 'academic-affairs')?.children.map((item) => item.key)).toEqual([
      '/academic-affairs/academic-calendar',
      '/academic-affairs/semester-calendar',
      '/academic-affairs/semester-course-schedule-sync',
    ]);
    expect(findGroup(items, 'labs')?.children.map((item) => item.key)).toEqual([
      '/labs/payload-crypto',
      '/labs/change-login-email',
      '/labs/invite-issuer',
      '/labs/upstream-session-demo',
      '/labs/semester-calendar',
      '/labs/academic-timetable',
      '/sandbox/playground',
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
        '/academic-affairs/semester-calendar',
        '/academic-affairs/semester-course-schedule-sync',
      ],
    );
    expect(findGroup(prodAdminItems, 'labs')?.children.map((item) => item.key)).toEqual([
      '/labs/change-login-email',
      '/labs/invite-issuer',
      '/labs/upstream-session-demo',
      '/labs/semester-calendar',
      '/labs/academic-timetable',
    ]);
  });

  it('shows the shared staff labs while keeping admin-only labs hidden', () => {
    const staffItems = getNavigationItems(
      buildFilter({
        accountId: 1001,
        primaryAccessGroup: 'STAFF',
        accessGroup: ['STAFF'],
      }),
    );

    expect(staffItems.map((item) => item.key)).toEqual(['labs']);
    expect(findGroup(staffItems, 'labs')?.children.map((item) => item.key)).toEqual([
      '/labs/upstream-session-demo',
      '/labs/semester-calendar',
      '/labs/academic-timetable',
    ]);
  });

  it('shows the academic calendar page to academic officers via slotGroup-aware filtering', () => {
    const staffItems = getNavigationItems(
      buildFilter({
        accountId: 1002,
        primaryAccessGroup: 'STAFF',
        accessGroup: ['STAFF'],
        slotGroup: ['ACADEMIC_OFFICER'],
      }),
    );

    expect(staffItems.map((item) => item.key)).toEqual(['academic-affairs', 'labs']);
    expect(findGroup(staffItems, 'academic-affairs')?.children.map((item) => item.key)).toEqual([
      '/academic-affairs/academic-calendar',
      '/academic-affairs/semester-calendar',
      '/academic-affairs/semester-course-schedule-sync',
    ]);
    expect(findGroup(staffItems, 'labs')?.children.map((item) => item.key)).toEqual([
      '/labs/upstream-session-demo',
      '/labs/semester-calendar',
      '/labs/academic-timetable',
    ]);
  });

  it('keeps route guard access checks aligned with filtered navigation results', () => {
    const guestFilter = buildFilter({
      primaryAccessGroup: 'GUEST',
      accessGroup: ['GUEST'],
    });

    expect(canAccessNavigationPath('/errors/preview', guestFilter)).toBe(true);
    expect(canAccessNavigationPath('/admin/users', guestFilter)).toBe(false);
  });

  it('continues exposing navigation leaf items for the local entry catalog', () => {
    const leaves = getNavigationLeafItems(buildFilter());

    expect(leaves.map((item) => item.key)).toEqual([
      '/',
      '/admin/users',
      '/academic-affairs/academic-calendar',
      '/academic-affairs/semester-calendar',
      '/academic-affairs/semester-course-schedule-sync',
      '/errors/preview',
      '/labs/payload-crypto',
      '/labs/change-login-email',
      '/labs/invite-issuer',
      '/labs/upstream-session-demo',
      '/labs/semester-calendar',
      '/labs/academic-timetable',
      '/sandbox/playground',
    ]);
    expect(leaves.filter((item) => item.localEntry).map((item) => item.key)).toEqual([
      '/',
      '/errors/preview',
      '/sandbox/playground',
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
    ).toBe('none');
  });
});
