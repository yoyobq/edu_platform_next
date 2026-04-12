import {
  updateAdminUserDetailAccountSection as runUpdateAdminUserDetailAccountSection,
  type UpdateAdminUserDetailAccountSectionCommand,
  updateAdminUserDetailStaffSection as runUpdateAdminUserDetailStaffSection,
  type UpdateAdminUserDetailStaffSectionInput,
  updateAdminUserDetailUserInfoSection as runUpdateAdminUserDetailUserInfoSection,
  type UpdateAdminUserDetailUserInfoSectionInput,
} from './application/update-admin-user-detail-sections';
import {
  requestAdminDepartmentOptions,
  requestAdminUserDetail,
  requestAdminUserDetailAccountSectionUpdate as requestAdminUserDetailAccountSectionUpdatePort,
  requestAdminUserDetailStaffSectionUpdate as requestAdminUserDetailStaffSectionUpdatePort,
  requestAdminUserDetailUserInfoSectionUpdate as requestAdminUserDetailUserInfoSectionUpdatePort,
} from './infrastructure/admin-user-detail-api';

export { requestAdminDepartmentOptions, requestAdminUserDetail };

export function requestAdminUserDetailAccountSectionUpdate(
  input: UpdateAdminUserDetailAccountSectionCommand,
) {
  return runUpdateAdminUserDetailAccountSection(
    {
      updateAccountSection: requestAdminUserDetailAccountSectionUpdatePort,
    },
    input,
  );
}

export function requestAdminUserDetailUserInfoSectionUpdate(
  input: UpdateAdminUserDetailUserInfoSectionInput,
) {
  return runUpdateAdminUserDetailUserInfoSection(
    {
      updateUserInfoSection: requestAdminUserDetailUserInfoSectionUpdatePort,
    },
    input,
  );
}

export function requestAdminUserDetailStaffSectionUpdate(
  input: UpdateAdminUserDetailStaffSectionInput,
) {
  return runUpdateAdminUserDetailStaffSection(
    {
      updateStaffSection: requestAdminUserDetailStaffSectionUpdatePort,
    },
    input,
  );
}
export { AdminUserDetailPageContent } from './ui/admin-user-detail-page-content';
