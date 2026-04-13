import { describe, expect, it } from 'vitest';

import {
  canAccessNavigationPath,
  getNavigationItems,
  getNavigationLeafItems,
  resolveNavMode,
} from './index';
import type { NavigationFilter } from './types';

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

describe('navigation catalog', () => {
  it('merges domain providers into the current admin navigation tree', () => {
    const items = getNavigationItems(buildFilter());

    expect(items.map((item) => item.key)).toEqual(['/', '/admin/users', '/errors/preview', 'labs']);
    expect(items.at(-1)?.children?.map((item) => item.key)).toEqual([
      '/labs/payload-crypto',
      '/labs/invite-issuer',
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

    expect(prodAdminItems.at(-1)?.children?.map((item) => item.key)).toEqual([
      '/labs/invite-issuer',
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
      '/errors/preview',
      '/labs/payload-crypto',
      '/labs/invite-issuer',
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
