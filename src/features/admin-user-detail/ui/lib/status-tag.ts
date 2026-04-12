import type {
  AdminUserDetailAccountStatus,
  AdminUserDetailStaffEmploymentStatus,
  AdminUserDetailUserState,
} from '../../application/get-admin-user-detail';

export function getStatusTagColor(
  status:
    | AdminUserDetailAccountStatus
    | AdminUserDetailStaffEmploymentStatus
    | AdminUserDetailUserState,
) {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'PENDING':
      return 'processing';
    case 'INACTIVE':
    case 'LEFT':
      return 'default';
    case 'SUSPENDED':
      return 'warning';
    case 'BANNED':
    case 'DELETED':
      return 'error';
    default:
      return 'default';
  }
}
