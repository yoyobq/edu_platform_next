import { beforeEach, describe, expect, it, vi } from 'vitest';

const { executeGraphQLMock } = vi.hoisted(() => ({
  executeGraphQLMock: vi.fn(),
}));

vi.mock('@/shared/graphql', () => ({
  executeGraphQL: executeGraphQLMock,
}));

import {
  requestAdminDepartmentOptions,
  requestAdminUserDetail,
  requestAdminUserDetailAccountSectionUpdate,
  requestAdminUserDetailStaffSectionUpdate,
  requestAdminUserDetailUserInfoSectionUpdate,
} from './admin-user-detail-api';

function buildDetailResponse() {
  return {
    account: {
      createdAt: '2026-04-01T00:00:00.000Z',
      id: 1001,
      identityHint: 'STAFF',
      loginEmail: 'staff.alpha@example.com',
      loginName: 'staff.alpha',
      recentLoginHistory: null,
      status: 'ACTIVE' as const,
      updatedAt: '2026-04-02T00:00:00.000Z',
    },
    userInfo: {
      accessGroup: ['STAFF'] as const,
      address: null,
      avatarUrl: null,
      birthDate: null,
      createdAt: '2026-04-01T00:00:00.000Z',
      email: 'staff.alpha@example.com',
      gender: 'SECRET',
      geographic: null,
      id: 'user-info-1001',
      nickname: 'Alpha',
      notifyCount: 2,
      phone: null,
      signature: null,
      tags: null,
      unreadCount: 1,
      updatedAt: '2026-04-02T00:00:00.000Z',
      userState: 'ACTIVE' as const,
    },
  };
}

function buildStaffResponse() {
  return {
    staff: {
      accountId: 1001,
      createdAt: '2026-04-01T00:00:00.000Z',
      departmentId: 'd-alpha',
      employmentStatus: 'ACTIVE' as const,
      id: 'staff-1001',
      jobTitle: '系统管理员',
      name: 'Alpha Chen',
      remark: null,
      updatedAt: '2026-04-02T00:00:00.000Z',
    },
  };
}

describe('requestAdminUserDetail', () => {
  beforeEach(() => {
    executeGraphQLMock.mockReset();
  });

  it('returns staff data when both detail queries succeed', async () => {
    const detailResponse = buildDetailResponse();
    const staffResponse = buildStaffResponse();

    executeGraphQLMock.mockResolvedValueOnce(detailResponse).mockResolvedValueOnce(staffResponse);

    await expect(requestAdminUserDetail(1001)).resolves.toEqual({
      account: {
        ...detailResponse.account,
        recentLoginHistory: [],
      },
      staff: staffResponse.staff,
      userInfo: {
        ...detailResponse.userInfo,
        gender: 'SECRET',
        tags: null,
      },
    });

    expect(executeGraphQLMock).toHaveBeenCalledTimes(2);
    expect(executeGraphQLMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('query AdminUserDetail($accountId: Int!)'),
      { accountId: 1001 },
    );
    expect(executeGraphQLMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('query AdminUserDetailStaff($accountId: Int!)'),
      { accountId: 1001 },
    );
  });

  it('propagates staff query failures instead of degrading to an empty state', async () => {
    const staffError = new Error('STAFF_RESOLVER_FAILED');

    executeGraphQLMock
      .mockResolvedValueOnce(buildDetailResponse())
      .mockRejectedValueOnce(staffError);

    await expect(requestAdminUserDetail(1001)).rejects.toBe(staffError);
  });

  it('updates account editable section via status and identity mutations', async () => {
    executeGraphQLMock
      .mockResolvedValueOnce({
        batchUpdateAccountStatus: {
          accounts: [
            {
              id: 1001,
              identityHint: 'STAFF',
              loginEmail: 'staff.alpha@example.com',
              loginName: 'staff.alpha',
              status: 'SUSPENDED',
              updatedAt: '2026-04-05T00:00:00.000Z',
            },
          ],
          isUpdated: true,
        },
      })
      .mockResolvedValueOnce({
        updateIdentityHint: {
          accountId: 1001,
          identityHint: 'ADMIN',
          isUpdated: true,
        },
      });

    await expect(
      requestAdminUserDetailAccountSectionUpdate({
        accountId: 1001,
        identityHint: 'ADMIN',
        status: 'SUSPENDED',
      }),
    ).resolves.toEqual({
      account: {
        identityHint: 'ADMIN',
        status: 'SUSPENDED',
        updatedAt: '2026-04-05T00:00:00.000Z',
      },
      isUpdated: true,
    });

    expect(executeGraphQLMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('mutation BatchUpdateAccountStatus'),
      {
        input: {
          accountIds: [1001],
          status: 'SUSPENDED',
        },
      },
    );
    expect(executeGraphQLMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('mutation UpdateIdentityHint'),
      {
        input: {
          accountId: 1001,
          identityHint: 'ADMIN',
        },
      },
    );
  });

  it('normalizes user info payload before mutation', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      updateUserInfo: {
        isUpdated: true,
        userInfo: {
          accessGroup: ['STAFF'],
          address: null,
          avatarUrl: null,
          birthDate: '2026-04-10',
          createdAt: '2026-04-01T00:00:00.000Z',
          email: 'alpha@example.com',
          gender: 'FEMALE',
          geographic: 'Shanghai',
          id: 'user-info-1001',
          nickname: 'Alpha',
          notifyCount: 2,
          phone: null,
          signature: null,
          tags: ['ops'],
          unreadCount: 1,
          updatedAt: '2026-04-05T00:00:00.000Z',
          userState: 'ACTIVE',
        },
      },
    });

    await expect(
      requestAdminUserDetailUserInfoSectionUpdate({
        accountId: 1001,
        address: '   ',
        birthDate: '2026-04-10',
        email: ' alpha@example.com ',
        gender: 'FEMALE',
        geographic: ' Shanghai ',
        nickname: ' Alpha ',
        phone: '',
        signature: null,
        tags: [' ops ', 'ops', ''],
        userState: 'ACTIVE',
      }),
    ).resolves.toEqual({
      isUpdated: true,
      userInfo: {
        accessGroup: ['STAFF'],
        address: null,
        avatarUrl: null,
        birthDate: '2026-04-10',
        createdAt: '2026-04-01T00:00:00.000Z',
        email: 'alpha@example.com',
        gender: 'FEMALE',
        geographic: 'Shanghai',
        id: 'user-info-1001',
        nickname: 'Alpha',
        notifyCount: 2,
        phone: null,
        signature: null,
        tags: ['ops'],
        unreadCount: 1,
        updatedAt: '2026-04-05T00:00:00.000Z',
        userState: 'ACTIVE',
      },
    });

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('mutation UpdateUserInfo'),
      {
        input: {
          accountId: 1001,
          address: null,
          birthDate: '2026-04-10',
          email: 'alpha@example.com',
          gender: 'FEMALE',
          geographic: 'Shanghai',
          nickname: 'Alpha',
          phone: null,
          signature: null,
          tags: ['ops'],
          userState: 'ACTIVE',
        },
      },
    );
  });

  it('updates staff editable section via employment status and profile mutations', async () => {
    executeGraphQLMock
      .mockResolvedValueOnce({
        batchUpdateStaffEmploymentStatus: {
          isUpdated: true,
          staffs: [
            {
              accountId: 1001,
              createdAt: '2026-04-01T00:00:00.000Z',
              departmentId: 'd-alpha',
              employmentStatus: 'LEFT',
              id: 'staff-1001',
              jobTitle: '系统管理员',
              name: 'Alpha Chen',
              remark: null,
              updatedAt: '2026-04-05T00:00:00.000Z',
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        updateStaff: {
          isUpdated: true,
          staff: {
            accountId: 1001,
            createdAt: '2026-04-01T00:00:00.000Z',
            departmentId: 'd-beta',
            employmentStatus: 'ACTIVE',
            id: 'staff-1001',
            jobTitle: '主任',
            name: 'Beta Chen',
            remark: '重点关注',
            updatedAt: '2026-04-06T00:00:00.000Z',
          },
        },
      });

    await expect(
      requestAdminUserDetailStaffSectionUpdate({
        accountId: 1001,
        departmentId: ' d-beta ',
        employmentStatus: 'LEFT',
        jobTitle: ' 主任 ',
        name: ' Beta Chen ',
        remark: ' 重点关注 ',
      }),
    ).resolves.toEqual({
      isUpdated: true,
      staff: {
        accountId: 1001,
        createdAt: '2026-04-01T00:00:00.000Z',
        departmentId: 'd-beta',
        employmentStatus: 'LEFT',
        id: 'staff-1001',
        jobTitle: '主任',
        name: 'Beta Chen',
        remark: '重点关注',
        updatedAt: '2026-04-05T00:00:00.000Z',
      },
    });
  });

  it('loads department options for department selector and display mapping', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      departments: [
        {
          departmentName: '人工智能系',
          id: 'd-ai',
          isEnabled: true,
          shortName: 'AI',
        },
      ],
    });

    await expect(requestAdminDepartmentOptions()).resolves.toEqual([
      {
        departmentName: '人工智能系',
        id: 'd-ai',
        isEnabled: true,
        shortName: 'AI',
      },
    ]);

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('query AdminDepartments'),
      { limit: 500 },
    );
  });
});
