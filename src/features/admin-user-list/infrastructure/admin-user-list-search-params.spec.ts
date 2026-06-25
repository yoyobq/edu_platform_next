// src/features/admin-user-list/infrastructure/admin-user-list-search-params.spec.ts

import { describe, expect, it } from 'vitest';

import {
  buildAdminUserListSearchParams,
  normalizeAdminUserHasStaffFilterValue,
  parseAdminUserListSearchParams,
} from './admin-user-list-search-params';

describe('admin user list search params', () => {
  it('parses URL search params into a normalized admin user query', () => {
    const query = parseAdminUserListSearchParams(
      new URLSearchParams(
        'query=%20alice%20&status=ACTIVE&accessGroup=ADMIN&accessGroup=UNKNOWN&hasStaff=false&limit=250&page=2&sortBy=loginName&sortOrder=ASC',
      ),
    );

    expect(query).toEqual({
      accessGroups: ['ADMIN'],
      hasStaff: false,
      limit: 100,
      page: 2,
      query: 'alice',
      sortBy: 'loginName',
      sortOrder: 'ASC',
      status: 'ACTIVE',
    });
  });

  it('builds URL search params from a normalized admin user query', () => {
    const searchParams = buildAdminUserListSearchParams({
      accessGroups: ['ADMIN', 'ADMIN', 'STAFF'],
      hasStaff: false,
      limit: 0,
      page: 3,
      query: ' alice ',
      sortBy: 'createdAt',
      sortOrder: 'ASC',
      status: 'SUSPENDED',
    });

    expect(searchParams.get('query')).toBe('alice');
    expect(searchParams.get('status')).toBe('SUSPENDED');
    expect(searchParams.getAll('accessGroup')).toEqual(['ADMIN', 'STAFF']);
    expect(searchParams.get('hasStaff')).toBe('false');
    expect(searchParams.get('limit')).toBe('1');
    expect(searchParams.get('page')).toBe('3');
    expect(searchParams.get('sortBy')).toBe('createdAt');
    expect(searchParams.get('sortOrder')).toBe('ASC');
  });

  it('maps UI has-staff filter values to query booleans', () => {
    expect(normalizeAdminUserHasStaffFilterValue('true')).toBe(true);
    expect(normalizeAdminUserHasStaffFilterValue('false')).toBe(false);
  });
});
