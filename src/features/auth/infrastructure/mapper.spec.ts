// src/features/auth/infrastructure/mapper.spec.ts

import { describe, expect, it } from 'vitest';

import { mapSessionResultToSessionSnapshot } from './mapper';

describe('auth session mapper', () => {
  it('keeps account and user profile email fields from me session payload', () => {
    const snapshot = mapSessionResultToSessionSnapshot(
      {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      },
      {
        account: {
          id: 1001,
          identityHint: 'STAFF',
          loginEmail: 'login@example.com',
          loginName: 'staff-login',
          status: 'ACTIVE',
        },
        accountId: 1001,
        identity: {
          __typename: 'StaffType',
          departmentId: 'ORG001',
          id: 'S1001',
          name: '教师甲',
          slotGroup: ['CLASS_ADVISER'],
        },
        needsProfileCompletion: false,
        userInfo: {
          accessGroup: ['STAFF'],
          avatarUrl: 'https://example.com/avatar.png',
          email: 'profile@example.com',
          nickname: 'staff',
          signature: 'hello',
          tags: ['alpha', ' alpha ', ''],
        },
      },
    );

    expect(snapshot.account.loginEmail).toBe('login@example.com');
    expect(snapshot.account.loginName).toBe('staff-login');
    expect(snapshot.account.status).toBe('ACTIVE');
    expect(snapshot.userInfo.avatarUrl).toBe('https://example.com/avatar.png');
    expect(snapshot.userInfo.email).toBe('profile@example.com');
    expect(snapshot.userInfo.signature).toBe('hello');
    expect(snapshot.userInfo.tags).toEqual(['alpha']);
  });
});
