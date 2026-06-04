// src/shared/account-switch/api.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { executeGraphQLMock, isGraphQLIngressErrorMock } = vi.hoisted(() => ({
  executeGraphQLMock: vi.fn(),
  isGraphQLIngressErrorMock: vi.fn(),
}));

vi.mock('@/shared/graphql', () => ({
  executeGraphQL: executeGraphQLMock,
  isGraphQLIngressError: isGraphQLIngressErrorMock,
}));

import {
  type AccountSwitchLabSession,
  createAccountSwitchLabSession,
  isAccountSwitchLabAccountMismatchError,
  restoreAccountSwitchLabSession,
} from './api';

function buildSession(overrides: Partial<AccountSwitchLabSession> = {}): AccountSwitchLabSession {
  return {
    accessToken: 'staff-access-token',
    account: {
      id: 1001,
      identityHint: 'STAFF',
      loginEmail: 'staff@example.com',
      loginName: 'staff-user',
      status: 'ACTIVE',
    },
    accountId: 1001,
    displayName: 'staff-user',
    identity: {
      departmentId: 'staff-department',
      id: 'staff-1001',
      kind: 'STAFF',
      name: 'staff-user',
      slotGroup: [],
    },
    isAuthenticated: true,
    needsProfileCompletion: false,
    primaryAccessGroup: 'STAFF',
    refreshToken: 'staff-refresh-token',
    slotGroup: [],
    userInfo: {
      accessGroup: ['STAFF'],
      avatarUrl: null,
      email: 'staff@example.com',
      nickname: 'staff-user',
      signature: null,
      tags: [],
    },
    ...overrides,
  };
}

function buildMePayload(input: { accountId: number; accessGroup: 'ADMIN' | 'STAFF' }) {
  const prefix = `${input.accessGroup.toLowerCase()}-${input.accountId}`;

  return {
    me: {
      account: {
        id: input.accountId,
        identityHint: input.accessGroup,
        loginEmail: `${prefix}@example.com`,
        loginName: prefix,
        status: 'ACTIVE',
      },
      accountId: input.accountId,
      identity:
        input.accessGroup === 'STAFF'
          ? {
              __typename: 'StaffType',
              departmentId: 'staff-department',
              id: `staff-${input.accountId}`,
              name: `staff-${input.accountId}`,
              slotGroup: [],
            }
          : null,
      needsProfileCompletion: false,
      userInfo: {
        accessGroup: [input.accessGroup],
        avatarUrl: `https://example.com/${prefix}.png`,
        email: `profile-${prefix}@example.com`,
        nickname: prefix,
        signature: `signature-${prefix}`,
        tags: ['staff', ' staff ', ''],
      },
    },
  };
}

describe('account switch api', () => {
  beforeEach(() => {
    executeGraphQLMock.mockReset();
    isGraphQLIngressErrorMock.mockReset();
    isGraphQLIngressErrorMock.mockImplementation((error: unknown) =>
      Boolean(error && typeof error === 'object' && 'type' in error),
    );
  });

  it('hydrates email fields from me payload when creating account switch session', async () => {
    executeGraphQLMock
      .mockResolvedValueOnce({
        login: {
          accessToken: 'staff-access-token',
          refreshToken: 'staff-refresh-token',
        },
      })
      .mockResolvedValueOnce(buildMePayload({ accessGroup: 'STAFF', accountId: 1001 }));

    const session = await createAccountSwitchLabSession({
      loginName: 'staff-1001',
      loginPassword: 'password',
    });
    const meQuery = executeGraphQLMock.mock.calls[1]?.[0] as string;

    expect(meQuery).toContain('loginEmail');
    expect(meQuery).toContain('email');
    expect(session.account.loginEmail).toBe('staff-1001@example.com');
    expect(session.account.loginName).toBe('staff-1001');
    expect(session.userInfo.email).toBe('profile-staff-1001@example.com');
    expect(session.userInfo.avatarUrl).toBe('https://example.com/staff-1001.png');
    expect(session.userInfo.signature).toBe('signature-staff-1001');
    expect(session.userInfo.tags).toEqual(['staff']);
  });

  it('rejects restored sessions whose account id does not match the requested account', async () => {
    const authError = { type: 'auth' };

    executeGraphQLMock
      .mockRejectedValueOnce(authError)
      .mockResolvedValueOnce({
        refresh: {
          accessToken: 'admin-access-token',
          refreshToken: 'admin-refresh-token',
        },
      })
      .mockResolvedValueOnce(buildMePayload({ accessGroup: 'ADMIN', accountId: 9527 }));

    await expect(restoreAccountSwitchLabSession(buildSession())).rejects.toSatisfy(
      isAccountSwitchLabAccountMismatchError,
    );
  });
});
