import { type AuthAccessGroup } from '@/shared/auth-access';
import {
  normalizeDepartmentName,
  WHITE_HOUSE_DEPARTMENT_NAME,
  WHITE_HOUSE_DEPARTMENT_OPTION_ID,
} from '@/shared/department';
import { executeGraphQL } from '@/shared/graphql';

import type { AdminDepartmentOption } from '../application/get-admin-department-options';
import {
  type AdminUserDetail,
  type AdminUserDetailAccountStatus,
  type AdminUserDetailAssignableStaffSlotCode,
  type AdminUserDetailGender,
  type AdminUserDetailIdentityHint,
  type AdminUserDetailIdentityPostStatus,
  type AdminUserDetailPort,
  type AdminUserDetailStaffEmploymentStatus,
  type AdminUserDetailStaffSlotCode,
  type AdminUserDetailUserState,
  getAdminUserDetail,
} from '../application/get-admin-user-detail';
import {
  type UpdateAdminUserDetailAccountSectionInput,
  type UpdateAdminUserDetailAccountSectionResult,
  type UpdateAdminUserDetailStaffSectionInput,
  type UpdateAdminUserDetailStaffSectionResult,
  type UpdateAdminUserDetailUserInfoSectionInput,
  type UpdateAdminUserDetailUserInfoSectionResult,
} from '../application/update-admin-user-detail-sections';

type AdminUserDetailResponse = {
  account: {
    createdAt: string;
    id: number;
    identityHint: string | null;
    loginEmail: string | null;
    loginName: string | null;
    recentLoginHistory:
      | {
          audience: string | null;
          ip: string;
          timestamp: string;
        }[]
      | null;
    status: AdminUserDetailAccountStatus;
    updatedAt: string;
  };
  userInfo: UserInfoDTO;
};

type AdminUserDetailStaffResponse = {
  staff: StaffDTO;
  staffCurrentSlotPosts?: StaffSlotPostDTO[];
};

type AdminUserDetailVariables = {
  accountId: number;
};

type UserInfoDTO = {
  accessGroup: AdminUserDetail['userInfo']['accessGroup'];
  address: string | null;
  avatarUrl: string | null;
  birthDate: string | null;
  createdAt: string;
  email: string | null;
  gender: string;
  geographic: {
    city: string | null;
    province: string | null;
  } | null;
  id: string;
  nickname: string;
  notifyCount: number;
  phone: string | null;
  signature: string | null;
  tags: string[] | null;
  unreadCount: number;
  updatedAt: string;
  userState: AdminUserDetailUserState;
};

type StaffDTO = {
  accountId: number;
  createdAt: string;
  departmentId: string | null;
  employmentStatus: AdminUserDetailStaffEmploymentStatus;
  id: string;
  jobTitle: string | null;
  name: string;
  remark: string | null;
  updatedAt: string;
};

type StaffSlotPostDTO = {
  endAt: string | null;
  id: number;
  isTemporary: boolean;
  remarks: string | null;
  scope: {
    classId: string | null;
    departmentId: string | null;
    teachingGroupId: string | null;
  };
  slotCode: AdminUserDetailStaffSlotCode;
  staffId: string;
  startAt: string | null;
  status: AdminUserDetailIdentityPostStatus;
};

type StaffSlotMutationResponse = {
  assignStaffSlot?: StaffSlotMutationResultDTO;
  endStaffSlot?: StaffSlotMutationResultDTO;
};

type StaffSlotMutationResultDTO = {
  binding: {
    slotCode: AdminUserDetailStaffSlotCode;
    status: 'ACTIVE' | 'ENDED' | 'INACTIVE';
  };
  changed: boolean;
  post: StaffSlotPostDTO | null;
};

type AssignStaffSlotVariables = {
  input: {
    accountId: number;
    departmentId: string;
    endAt?: string;
    isTemporary: boolean;
    remarks?: string;
    slotCode: AdminUserDetailAssignableStaffSlotCode;
    startAt?: string;
  };
};

type EndStaffSlotVariables = {
  input: {
    accountId: number;
    classId?: string;
    departmentId?: string;
    slotCode: AdminUserDetailStaffSlotCode;
    teachingGroupId?: string;
  };
};

type BatchUpdateAccountStatusResponse = {
  batchUpdateAccountStatus: {
    accounts: {
      id: number;
      identityHint: string | null;
      loginEmail: string | null;
      loginName: string | null;
      status: AdminUserDetailAccountStatus;
      updatedAt: string;
    }[];
    isUpdated: boolean;
  };
};

type BatchUpdateAccountStatusVariables = {
  input: {
    accountIds: number[];
    status: AdminUserDetailAccountStatus;
  };
};

type UpdateIdentityHintResponse = {
  updateIdentityHint: {
    accountId: number;
    identityHint: AdminUserDetailIdentityHint;
    isUpdated: boolean;
  };
};

type UpdateIdentityHintVariables = {
  input: {
    accountId: number;
    identityHint: AdminUserDetailIdentityHint;
  };
};

type UpdateUserInfoResponse = {
  updateUserInfo: {
    isUpdated: boolean;
    userInfo: UserInfoDTO;
  };
};

type UpdateUserInfoVariables = {
  input: {
    accountId: number;
    address: string | null;
    birthDate: string | null;
    email: string | null;
    gender: AdminUserDetailGender;
    geographic: {
      city?: string;
      province?: string;
    } | null;
    nickname: string;
    phone: string | null;
    signature: string | null;
    tags: string[];
    userState: AdminUserDetailUserState;
  };
};

type UpdateAccessGroupResponse = {
  updateAccessGroup: {
    accessGroup: AuthAccessGroup[];
    accountId: number;
    identityHint?: AdminUserDetailIdentityHint | string | null;
    isUpdated: boolean;
  };
};

type UpdateAccessGroupVariables = {
  input: {
    accessGroup: AuthAccessGroup[];
    accountId: number;
  };
};

type BatchUpdateStaffEmploymentStatusResponse = {
  batchUpdateStaffEmploymentStatus: {
    isUpdated: boolean;
    staffs: StaffDTO[];
  };
};

type BatchUpdateStaffEmploymentStatusVariables = {
  input: {
    accountIds: number[];
    employmentStatus: AdminUserDetailStaffEmploymentStatus;
  };
};

type UpdateStaffResponse = {
  updateStaff: {
    isUpdated: boolean;
    staff: StaffDTO;
  };
};

type UpdateStaffVariables = {
  input: {
    accountId: number;
    departmentId: string | null;
    jobTitle: string | null;
    name: string;
    remark: string | null;
  };
};

type AdminDepartmentsResponse = {
  departments: {
    departmentName: string;
    id: string;
    isEnabled: boolean;
    shortName: string | null;
  }[];
};

type AdminDepartmentsVariables = {
  limit: number;
};

const ADMIN_USER_DETAIL_QUERY = `
  query AdminUserDetail($accountId: Int!) {
    account(id: $accountId) {
      createdAt
      id
      identityHint
      loginEmail
      loginName
      recentLoginHistory {
        audience
        ip
        timestamp
      }
      status
      updatedAt
    }
    userInfo(accountId: $accountId) {
      accessGroup
      address
      avatarUrl
      birthDate
      createdAt
      email
      gender
      geographic {
        city
        province
      }
      id
      nickname
      notifyCount
      phone
      signature
      tags
      unreadCount
      updatedAt
      userState
    }
  }
`;

const ADMIN_USER_DETAIL_STAFF_QUERY = `
  query AdminUserDetailStaff($accountId: Int!) {
    staff(accountId: $accountId) {
      accountId
      createdAt
      departmentId
      employmentStatus
      id
      jobTitle
      name
      remark
      updatedAt
    }
    staffCurrentSlotPosts(accountId: $accountId) {
      endAt
      id
      isTemporary
      remarks
      scope {
        classId
        departmentId
        teachingGroupId
      }
      slotCode
      staffId
      startAt
      status
    }
  }
`;

const BATCH_UPDATE_ACCOUNT_STATUS_MUTATION = `
  mutation BatchUpdateAccountStatus($input: BatchUpdateAccountStatusInput!) {
    batchUpdateAccountStatus(input: $input) {
      isUpdated
      accounts {
        id
        identityHint
        loginEmail
        loginName
        status
        updatedAt
      }
    }
  }
`;

const UPDATE_IDENTITY_HINT_MUTATION = `
  mutation UpdateIdentityHint($input: UpdateIdentityHintInput!) {
    updateIdentityHint(input: $input) {
      accountId
      identityHint
      isUpdated
    }
  }
`;

const UPDATE_USER_INFO_MUTATION = `
  mutation UpdateUserInfo($input: UpdateUserInfoInput!) {
    updateUserInfo(input: $input) {
      isUpdated
      userInfo {
        accessGroup
        address
        avatarUrl
        birthDate
        createdAt
        email
        gender
        geographic {
          city
          province
        }
        id
        nickname
        notifyCount
        phone
        signature
        tags
        unreadCount
        updatedAt
        userState
      }
    }
  }
`;

const UPDATE_ACCESS_GROUP_MUTATION = `
  mutation UpdateAccessGroup($input: UpdateAccessGroupInput!) {
    updateAccessGroup(input: $input) {
      accessGroup
      accountId
      identityHint
      isUpdated
    }
  }
`;

const BATCH_UPDATE_STAFF_EMPLOYMENT_STATUS_MUTATION = `
  mutation BatchUpdateStaffEmploymentStatus($input: BatchUpdateStaffEmploymentStatusInput!) {
    batchUpdateStaffEmploymentStatus(input: $input) {
      isUpdated
      staffs {
        accountId
        createdAt
        departmentId
        employmentStatus
        id
        jobTitle
        name
        remark
        updatedAt
      }
    }
  }
`;

const UPDATE_STAFF_MUTATION = `
  mutation UpdateStaff($input: UpdateStaffInput!) {
    updateStaff(input: $input) {
      isUpdated
      staff {
        accountId
        createdAt
        departmentId
        employmentStatus
        id
        jobTitle
        name
        remark
        updatedAt
      }
    }
  }
`;

const ASSIGN_STAFF_SLOT_MUTATION = `
  mutation AssignStaffSlot($input: AssignStaffSlotInput!) {
    assignStaffSlot(input: $input) {
      changed
      binding {
        slotCode
        status
      }
      post {
        endAt
        id
        isTemporary
        remarks
        scope {
          classId
          departmentId
          teachingGroupId
        }
        slotCode
        staffId
        startAt
        status
      }
    }
  }
`;

const END_STAFF_SLOT_MUTATION = `
  mutation EndStaffSlot($input: EndStaffSlotInput!) {
    endStaffSlot(input: $input) {
      changed
      binding {
        slotCode
        status
      }
      post {
        endAt
        id
        isTemporary
        remarks
        scope {
          classId
          departmentId
          teachingGroupId
        }
        slotCode
        staffId
        startAt
        status
      }
    }
  }
`;

const ADMIN_DEPARTMENTS_QUERY = `
  query AdminDepartments($limit: Int) {
    departments(limit: $limit) {
      departmentName
      id
      isEnabled
      shortName
    }
  }
`;

function normalizeIdentityHint(
  value: string | null | undefined,
): AdminUserDetailIdentityHint | null {
  return value === 'ADMIN' || value === 'STAFF' || value === 'STUDENT' ? value : null;
}

function normalizeGender(value: string): AdminUserDetailGender {
  switch (value) {
    case 'FEMALE':
    case '女':
      return 'FEMALE';
    case 'MALE':
    case '男':
      return 'MALE';
    case 'SECRET':
    case '保密':
    default:
      return 'SECRET';
  }
}

function mapUserInfo(dto: UserInfoDTO): AdminUserDetail['userInfo'] {
  return {
    ...dto,
    gender: normalizeGender(dto.gender),
    geographic: dto.geographic
      ? {
          city: dto.geographic.city ?? null,
          province: dto.geographic.province ?? null,
        }
      : null,
    tags: dto.tags ?? null,
  };
}

function mapStaff(dto: StaffDTO): AdminUserDetail['staff'] {
  return dto;
}

function mapStaffSlotPost(dto: StaffSlotPostDTO): AdminUserDetail['staffSlotPosts'][number] {
  return dto;
}

function normalizeOptionalTextValue(value: string | null | undefined) {
  if (value === undefined || value === null) {
    return null;
  }

  const nextValue = value.trim();

  return nextValue ? nextValue : null;
}

function normalizeRequiredTextValue(value: string) {
  return value.trim();
}

function normalizeTagsValue(tags: readonly string[]) {
  return Array.from(new Set(tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0)));
}

function normalizeAccessGroupValue(accessGroup: readonly AuthAccessGroup[]) {
  return Array.from(new Set(accessGroup));
}

function hasOwnIdentityHintField(
  value: UpdateAccessGroupResponse['updateAccessGroup'],
): value is UpdateAccessGroupResponse['updateAccessGroup'] & { identityHint: string | null } {
  return Object.prototype.hasOwnProperty.call(value, 'identityHint');
}

const adminUserDetailPort: AdminUserDetailPort = {
  async getAdminUserDetail(accountId: number): Promise<AdminUserDetail> {
    const [detailResponse, staffResponse] = await Promise.all([
      executeGraphQL<AdminUserDetailResponse, AdminUserDetailVariables>(ADMIN_USER_DETAIL_QUERY, {
        accountId,
      }),
      executeGraphQL<AdminUserDetailStaffResponse, AdminUserDetailVariables>(
        ADMIN_USER_DETAIL_STAFF_QUERY,
        { accountId },
      ),
    ]);

    return {
      account: {
        ...detailResponse.account,
        identityHint: normalizeIdentityHint(detailResponse.account.identityHint),
        recentLoginHistory: detailResponse.account.recentLoginHistory ?? [],
      },
      staff: mapStaff(staffResponse.staff),
      staffSlotPosts: (staffResponse.staffCurrentSlotPosts ?? []).map(mapStaffSlotPost),
      userInfo: mapUserInfo(detailResponse.userInfo),
    };
  },
};

export function requestAdminUserDetail(accountId: number) {
  return getAdminUserDetail(adminUserDetailPort, accountId);
}

export async function requestAdminUserDetailAccountSectionUpdate(
  input: UpdateAdminUserDetailAccountSectionInput,
): Promise<UpdateAdminUserDetailAccountSectionResult> {
  const accountStatusResponse = await executeGraphQL<
    BatchUpdateAccountStatusResponse,
    BatchUpdateAccountStatusVariables
  >(BATCH_UPDATE_ACCOUNT_STATUS_MUTATION, {
    input: {
      accountIds: [input.accountId],
      status: input.status,
    },
  });
  const identityHintResponse = await executeGraphQL<
    UpdateIdentityHintResponse,
    UpdateIdentityHintVariables
  >(UPDATE_IDENTITY_HINT_MUTATION, {
    input: {
      accountId: input.accountId,
      identityHint: input.identityHint,
    },
  });

  const updatedAccount = accountStatusResponse.batchUpdateAccountStatus.accounts[0];

  return {
    account: {
      identityHint: identityHintResponse.updateIdentityHint.identityHint,
      status: updatedAccount?.status ?? input.status,
      updatedAt: updatedAccount?.updatedAt,
    },
    isUpdated:
      accountStatusResponse.batchUpdateAccountStatus.isUpdated ||
      identityHintResponse.updateIdentityHint.isUpdated,
  };
}

export async function requestAdminUserDetailUserInfoSectionUpdate(
  input: UpdateAdminUserDetailUserInfoSectionInput,
): Promise<UpdateAdminUserDetailUserInfoSectionResult> {
  const userInfoResponse = await executeGraphQL<UpdateUserInfoResponse, UpdateUserInfoVariables>(
    UPDATE_USER_INFO_MUTATION,
    {
      input: {
        accountId: input.accountId,
        address: normalizeOptionalTextValue(input.address),
        birthDate: normalizeOptionalTextValue(input.birthDate),
        email: normalizeOptionalTextValue(input.email),
        gender: input.gender,
        geographic: input.geographic,
        nickname: normalizeRequiredTextValue(input.nickname),
        phone: normalizeOptionalTextValue(input.phone),
        signature: normalizeOptionalTextValue(input.signature),
        tags: normalizeTagsValue(input.tags),
        userState: input.userState,
      },
    },
  );
  const nextAccessGroup = input.accessGroup ? normalizeAccessGroupValue(input.accessGroup) : null;
  const accessGroupResponse = nextAccessGroup
    ? await executeGraphQL<UpdateAccessGroupResponse, UpdateAccessGroupVariables>(
        UPDATE_ACCESS_GROUP_MUTATION,
        {
          input: {
            accessGroup: nextAccessGroup,
            accountId: input.accountId,
          },
        },
      )
    : null;
  const normalizedNextIdentityHint = accessGroupResponse
    ? hasOwnIdentityHintField(accessGroupResponse.updateAccessGroup)
      ? normalizeIdentityHint(accessGroupResponse.updateAccessGroup.identityHint)
      : undefined
    : undefined;

  return {
    account:
      normalizedNextIdentityHint === undefined ? {} : { identityHint: normalizedNextIdentityHint },
    isUpdated:
      userInfoResponse.updateUserInfo.isUpdated ||
      Boolean(accessGroupResponse?.updateAccessGroup.isUpdated),
    userInfo: {
      ...mapUserInfo(userInfoResponse.updateUserInfo.userInfo),
      accessGroup:
        accessGroupResponse?.updateAccessGroup.accessGroup ??
        userInfoResponse.updateUserInfo.userInfo.accessGroup,
    },
  };
}

export async function requestAdminUserDetailStaffSectionUpdate(
  input: UpdateAdminUserDetailStaffSectionInput,
): Promise<UpdateAdminUserDetailStaffSectionResult> {
  const employmentStatusResponse = await executeGraphQL<
    BatchUpdateStaffEmploymentStatusResponse,
    BatchUpdateStaffEmploymentStatusVariables
  >(BATCH_UPDATE_STAFF_EMPLOYMENT_STATUS_MUTATION, {
    input: {
      accountIds: [input.accountId],
      employmentStatus: input.employmentStatus,
    },
  });
  const staffResponse = await executeGraphQL<UpdateStaffResponse, UpdateStaffVariables>(
    UPDATE_STAFF_MUTATION,
    {
      input: {
        accountId: input.accountId,
        departmentId: normalizeOptionalTextValue(input.departmentId),
        jobTitle: normalizeOptionalTextValue(input.jobTitle),
        name: normalizeRequiredTextValue(input.name),
        remark: normalizeOptionalTextValue(input.remark),
      },
    },
  );

  const employmentStatusStaff = employmentStatusResponse.batchUpdateStaffEmploymentStatus.staffs[0];
  const updatedStaff = mapStaff(staffResponse.updateStaff.staff);

  return {
    isUpdated:
      employmentStatusResponse.batchUpdateStaffEmploymentStatus.isUpdated ||
      staffResponse.updateStaff.isUpdated,
    staff: {
      ...updatedStaff,
      employmentStatus: employmentStatusStaff?.employmentStatus ?? updatedStaff.employmentStatus,
      updatedAt: employmentStatusStaff?.updatedAt ?? updatedStaff.updatedAt,
    },
  };
}

export async function requestAdminUserDetailStaffSlotAssign(input: {
  accountId: number;
  departmentId: string;
  endAt?: string;
  isTemporary: boolean;
  remarks?: string;
  slotCode: AdminUserDetailAssignableStaffSlotCode;
  startAt?: string;
}): Promise<StaffSlotMutationResultDTO> {
  const response = await executeGraphQL<StaffSlotMutationResponse, AssignStaffSlotVariables>(
    ASSIGN_STAFF_SLOT_MUTATION,
    {
      input: {
        accountId: input.accountId,
        departmentId: input.departmentId,
        endAt: input.endAt,
        isTemporary: input.isTemporary,
        remarks: normalizeOptionalTextValue(input.remarks) ?? undefined,
        slotCode: input.slotCode,
        startAt: input.startAt,
      },
    },
  );

  if (!response.assignStaffSlot) {
    throw new Error('staff slot 新增结果缺失。');
  }

  return response.assignStaffSlot;
}

export async function requestAdminUserDetailStaffSlotEnd(input: {
  accountId: number;
  post: AdminUserDetail['staffSlotPosts'][number];
}): Promise<StaffSlotMutationResultDTO> {
  const response = await executeGraphQL<StaffSlotMutationResponse, EndStaffSlotVariables>(
    END_STAFF_SLOT_MUTATION,
    {
      input: {
        accountId: input.accountId,
        classId: input.post.scope.classId ?? undefined,
        departmentId: input.post.scope.departmentId ?? undefined,
        slotCode: input.post.slotCode,
        teachingGroupId: input.post.scope.teachingGroupId ?? undefined,
      },
    },
  );

  if (!response.endStaffSlot) {
    throw new Error('staff slot 结束结果缺失。');
  }

  return response.endStaffSlot;
}

export async function requestAdminDepartmentOptions(): Promise<readonly AdminDepartmentOption[]> {
  const response = await executeGraphQL<AdminDepartmentsResponse, AdminDepartmentsVariables>(
    ADMIN_DEPARTMENTS_QUERY,
    { limit: 500 },
  );

  return [
    {
      departmentName: WHITE_HOUSE_DEPARTMENT_NAME,
      id: WHITE_HOUSE_DEPARTMENT_OPTION_ID,
      isEnabled: true,
      shortName: null,
    },
    ...response.departments.map((department) => ({
      departmentName: normalizeDepartmentName(department.departmentName),
      id: department.id,
      isEnabled: department.isEnabled,
      shortName: department.shortName,
    })),
  ];
}
