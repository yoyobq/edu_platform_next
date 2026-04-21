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
  requestAdminUserDetailStaffSlotAssign,
  requestAdminUserDetailStaffSlotEnd,
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
    staffCurrentSlotPosts: [
      {
        endAt: null,
        id: 7001,
        isTemporary: false,
        remarks: '负责日常教务',
        scope: {
          classId: null,
          departmentId: 'd-alpha',
          teachingGroupId: null,
        },
        slotCode: 'ACADEMIC_OFFICER' as const,
        staffId: 'staff-1001',
        startAt: '2026-04-01T00:00:00.000Z',
        status: 'ACTIVE' as const,
      },
    ],
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
      staffSlotPosts: staffResponse.staffCurrentSlotPosts,
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
    expect(executeGraphQLMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('staffCurrentSlotPosts(accountId: $accountId)'),
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
    executeGraphQLMock
      .mockResolvedValueOnce({
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
            geographic: {
              city: 'Los Angeles',
              province: 'California',
            },
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
      })
      .mockResolvedValueOnce({
        updateAccessGroup: {
          accessGroup: ['ADMIN', 'STAFF'],
          accountId: 1001,
          identityHint: 'ADMIN',
          isUpdated: true,
        },
      });

    await expect(
      requestAdminUserDetailUserInfoSectionUpdate({
        accessGroup: ['STAFF', 'ADMIN'],
        accountId: 1001,
        address: '   ',
        birthDate: '2026-04-10',
        email: ' alpha@example.com ',
        gender: 'FEMALE',
        geographic: {
          city: 'Los Angeles',
          province: 'California',
        },
        nickname: ' Alpha ',
        phone: '',
        signature: null,
        tags: [' ops ', 'ops', ''],
        userState: 'ACTIVE',
      }),
    ).resolves.toEqual({
      account: {
        identityHint: 'ADMIN',
      },
      isUpdated: true,
      userInfo: {
        accessGroup: ['ADMIN', 'STAFF'],
        address: null,
        avatarUrl: null,
        birthDate: '2026-04-10',
        createdAt: '2026-04-01T00:00:00.000Z',
        email: 'alpha@example.com',
        gender: 'FEMALE',
        geographic: {
          city: 'Los Angeles',
          province: 'California',
        },
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
          geographic: {
            city: 'Los Angeles',
            province: 'California',
          },
          nickname: 'Alpha',
          phone: null,
          signature: null,
          tags: ['ops'],
          userState: 'ACTIVE',
        },
      },
    );
    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('mutation UpdateAccessGroup'),
      {
        input: {
          accessGroup: ['STAFF', 'ADMIN'],
          accountId: 1001,
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
          departmentName: '',
          id: 'd-whitehouse-backend',
          isEnabled: true,
          shortName: null,
        },
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
        departmentName: '白宫',
        id: '',
        isEnabled: true,
        shortName: null,
      },
      {
        departmentName: '白宫',
        id: 'd-whitehouse-backend',
        isEnabled: true,
        shortName: null,
      },
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

  it('maps empty department selection to null when updating staff section', async () => {
    executeGraphQLMock
      .mockResolvedValueOnce({
        batchUpdateStaffEmploymentStatus: {
          isUpdated: false,
          staffs: [],
        },
      })
      .mockResolvedValueOnce({
        updateStaff: {
          isUpdated: true,
          staff: {
            accountId: 1001,
            createdAt: '2026-04-01T00:00:00.000Z',
            departmentId: null,
            employmentStatus: 'ACTIVE',
            id: 'staff-1001',
            jobTitle: '主任',
            name: 'Beta Chen',
            remark: null,
            updatedAt: '2026-04-06T00:00:00.000Z',
          },
        },
      });

    await requestAdminUserDetailStaffSectionUpdate({
      accountId: 1001,
      departmentId: '',
      employmentStatus: 'ACTIVE',
      jobTitle: '主任',
      name: 'Beta Chen',
      remark: null,
    });

    expect(executeGraphQLMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('mutation UpdateStaff'),
      {
        input: {
          accountId: 1001,
          departmentId: null,
          jobTitle: '主任',
          name: 'Beta Chen',
          remark: null,
        },
      },
    );
  });

  it('assigns a department staff slot with normalized optional fields', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      assignStaffSlot: {
        binding: {
          slotCode: 'ACADEMIC_OFFICER',
          status: 'ACTIVE',
        },
        changed: true,
        post: {
          endAt: null,
          id: 7002,
          isTemporary: true,
          remarks: '临时协助',
          scope: {
            classId: null,
            departmentId: 'd-alpha',
            teachingGroupId: null,
          },
          slotCode: 'ACADEMIC_OFFICER',
          staffId: 'staff-1001',
          startAt: null,
          status: 'ACTIVE',
        },
      },
    });

    await expect(
      requestAdminUserDetailStaffSlotAssign({
        accountId: 1001,
        departmentId: 'd-alpha',
        isTemporary: true,
        remarks: ' 临时协助 ',
        slotCode: 'ACADEMIC_OFFICER',
      }),
    ).resolves.toEqual({
      binding: {
        slotCode: 'ACADEMIC_OFFICER',
        status: 'ACTIVE',
      },
      changed: true,
      post: {
        endAt: null,
        id: 7002,
        isTemporary: true,
        remarks: '临时协助',
        scope: {
          classId: null,
          departmentId: 'd-alpha',
          teachingGroupId: null,
        },
        slotCode: 'ACADEMIC_OFFICER',
        staffId: 'staff-1001',
        startAt: null,
        status: 'ACTIVE',
      },
    });

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('mutation AssignStaffSlot'),
      {
        input: {
          accountId: 1001,
          departmentId: 'd-alpha',
          endAt: undefined,
          isTemporary: true,
          remarks: '临时协助',
          slotCode: 'ACADEMIC_OFFICER',
          startAt: undefined,
        },
      },
    );
  });

  it('ends a staff slot with only the matching scope field', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      endStaffSlot: {
        binding: {
          slotCode: 'CLASS_ADVISER',
          status: 'ENDED',
        },
        changed: true,
        post: null,
      },
    });

    await expect(
      requestAdminUserDetailStaffSlotEnd({
        accountId: 1001,
        post: {
          endAt: null,
          id: 7003,
          isTemporary: false,
          remarks: null,
          scope: {
            classId: 'class-1',
            departmentId: null,
            teachingGroupId: null,
          },
          slotCode: 'CLASS_ADVISER',
          staffId: 'staff-1001',
          startAt: null,
          status: 'ACTIVE',
        },
      }),
    ).resolves.toEqual({
      binding: {
        slotCode: 'CLASS_ADVISER',
        status: 'ENDED',
      },
      changed: true,
      post: null,
    });

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('mutation EndStaffSlot'),
      {
        input: {
          accountId: 1001,
          classId: 'class-1',
          departmentId: undefined,
          slotCode: 'CLASS_ADVISER',
          teachingGroupId: undefined,
        },
      },
    );
  });

  it('skips updateAccessGroup when accessGroup is omitted', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      updateUserInfo: {
        isUpdated: true,
        userInfo: {
          accessGroup: ['REGISTRANT'],
          address: null,
          avatarUrl: null,
          birthDate: null,
          createdAt: '2026-04-01T00:00:00.000Z',
          email: 'registrant@example.com',
          gender: 'SECRET',
          geographic: null,
          id: 'user-info-1002',
          nickname: 'Registrant',
          notifyCount: 0,
          phone: null,
          signature: null,
          tags: null,
          unreadCount: 0,
          updatedAt: '2026-04-06T00:00:00.000Z',
          userState: 'PENDING',
        },
      },
    });

    await expect(
      requestAdminUserDetailUserInfoSectionUpdate({
        accountId: 1002,
        address: null,
        birthDate: null,
        email: 'registrant@example.com',
        gender: 'SECRET',
        geographic: null,
        nickname: 'Registrant',
        phone: null,
        signature: null,
        tags: [],
        userState: 'PENDING',
      }),
    ).resolves.toEqual({
      account: {},
      isUpdated: true,
      userInfo: {
        accessGroup: ['REGISTRANT'],
        address: null,
        avatarUrl: null,
        birthDate: null,
        createdAt: '2026-04-01T00:00:00.000Z',
        email: 'registrant@example.com',
        gender: 'SECRET',
        geographic: null,
        id: 'user-info-1002',
        nickname: 'Registrant',
        notifyCount: 0,
        phone: null,
        signature: null,
        tags: null,
        unreadCount: 0,
        updatedAt: '2026-04-06T00:00:00.000Z',
        userState: 'PENDING',
      },
    });

    expect(executeGraphQLMock).toHaveBeenCalledTimes(1);
    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('mutation UpdateUserInfo'),
      expect.any(Object),
    );
  });

  it('does not emit identityHint patch when updateAccessGroup response misses it', async () => {
    executeGraphQLMock
      .mockResolvedValueOnce({
        updateUserInfo: {
          isUpdated: true,
          userInfo: {
            accessGroup: ['STAFF'],
            address: null,
            avatarUrl: null,
            birthDate: null,
            createdAt: '2026-04-01T00:00:00.000Z',
            email: 'alpha@example.com',
            gender: 'SECRET',
            geographic: null,
            id: 'user-info-1003',
            nickname: 'Alpha',
            notifyCount: 0,
            phone: null,
            signature: null,
            tags: null,
            unreadCount: 0,
            updatedAt: '2026-04-06T00:00:00.000Z',
            userState: 'ACTIVE',
          },
        },
      })
      .mockResolvedValueOnce({
        updateAccessGroup: {
          accessGroup: ['ADMIN', 'STAFF'],
          accountId: 1003,
          isUpdated: true,
        },
      });

    await expect(
      requestAdminUserDetailUserInfoSectionUpdate({
        accessGroup: ['ADMIN', 'STAFF'],
        accountId: 1003,
        address: null,
        birthDate: null,
        email: 'alpha@example.com',
        gender: 'SECRET',
        geographic: null,
        nickname: 'Alpha',
        phone: null,
        signature: null,
        tags: [],
        userState: 'ACTIVE',
      }),
    ).resolves.toEqual({
      account: {},
      isUpdated: true,
      userInfo: {
        accessGroup: ['ADMIN', 'STAFF'],
        address: null,
        avatarUrl: null,
        birthDate: null,
        createdAt: '2026-04-01T00:00:00.000Z',
        email: 'alpha@example.com',
        gender: 'SECRET',
        geographic: null,
        id: 'user-info-1003',
        nickname: 'Alpha',
        notifyCount: 0,
        phone: null,
        signature: null,
        tags: null,
        unreadCount: 0,
        updatedAt: '2026-04-06T00:00:00.000Z',
        userState: 'ACTIVE',
      },
    });
  });

  it('emits identityHint null patch when updateAccessGroup response explicitly returns null', async () => {
    executeGraphQLMock
      .mockResolvedValueOnce({
        updateUserInfo: {
          isUpdated: true,
          userInfo: {
            accessGroup: ['STAFF'],
            address: null,
            avatarUrl: null,
            birthDate: null,
            createdAt: '2026-04-01T00:00:00.000Z',
            email: 'alpha@example.com',
            gender: 'SECRET',
            geographic: null,
            id: 'user-info-1004',
            nickname: 'Alpha',
            notifyCount: 0,
            phone: null,
            signature: null,
            tags: null,
            unreadCount: 0,
            updatedAt: '2026-04-06T00:00:00.000Z',
            userState: 'ACTIVE',
          },
        },
      })
      .mockResolvedValueOnce({
        updateAccessGroup: {
          accessGroup: ['STAFF'],
          accountId: 1004,
          identityHint: null,
          isUpdated: true,
        },
      });

    await expect(
      requestAdminUserDetailUserInfoSectionUpdate({
        accessGroup: ['STAFF'],
        accountId: 1004,
        address: null,
        birthDate: null,
        email: 'alpha@example.com',
        gender: 'SECRET',
        geographic: null,
        nickname: 'Alpha',
        phone: null,
        signature: null,
        tags: [],
        userState: 'ACTIVE',
      }),
    ).resolves.toEqual({
      account: {
        identityHint: null,
      },
      isUpdated: true,
      userInfo: {
        accessGroup: ['STAFF'],
        address: null,
        avatarUrl: null,
        birthDate: null,
        createdAt: '2026-04-01T00:00:00.000Z',
        email: 'alpha@example.com',
        gender: 'SECRET',
        geographic: null,
        id: 'user-info-1004',
        nickname: 'Alpha',
        notifyCount: 0,
        phone: null,
        signature: null,
        tags: null,
        unreadCount: 0,
        updatedAt: '2026-04-06T00:00:00.000Z',
        userState: 'ACTIVE',
      },
    });
  });
});
