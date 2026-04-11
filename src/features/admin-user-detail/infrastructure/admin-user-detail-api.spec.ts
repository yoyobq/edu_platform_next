import { beforeEach, describe, expect, it, vi } from 'vitest';

const { executeGraphQLMock } = vi.hoisted(() => ({
  executeGraphQLMock: vi.fn(),
}));

vi.mock('@/shared/graphql', () => ({
  executeGraphQL: executeGraphQLMock,
}));

import { requestAdminUserDetail } from './admin-user-detail-api';

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
      gender: '保密',
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
});
