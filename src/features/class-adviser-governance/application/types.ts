// src/features/class-adviser-governance/application/types.ts

export type ClassAdviserBindingStatus = 'ACTIVE' | 'ENDED' | 'INACTIVE';

export type ClassAdviserGovernanceActiveAdviser = {
  endAt: string | null;
  hasLocalStaff: boolean;
  isTemporary: boolean;
  postId: number | string;
  remarks: string | null;
  staffId: string;
  staffName: string | null;
  startAt: string | null;
};

export type ClassAdviserGovernanceClass = {
  activeAdvisers: ClassAdviserGovernanceActiveAdviser[];
  canAssign: boolean;
  canManage: boolean;
  classCode: string;
  classId: string;
  className: string;
  departmentId: string;
  gradeYear: number | null;
  lastObservedAt: string | null;
  studentCount: number;
};

export type LocalDepartmentOption = {
  departmentName: string;
  id: string;
  isEnabled: boolean;
  shortName: string | null;
};

export type ManagedDepartmentOption = {
  departmentCode: string | null;
  departmentName: string;
  id: string;
  shortName: string | null;
  slotGroups: string[];
};

export type ListClassAdviserGovernanceClassesInput = {
  departmentId?: string | null;
  keyword?: string | null;
  onlyMissing?: boolean;
};

export type AssignClassAdviserByStaffIdInput = {
  classId: string;
  remarks?: string | null;
  staffId: string;
  staffName?: string | null;
};

export type AssignClassAdviserByStaffIdResult = {
  bindingStatus: ClassAdviserBindingStatus | null;
  changed: boolean;
  classCode: string;
  classId: string;
  className: string;
  hasLocalStaff: boolean;
  postId: number | string;
  staffId: string;
  staffName: string | null;
};

export type EndClassAdviserGovernancePostInput = {
  classId: string;
  postId: number | string;
  reason: string;
};

export type EndClassAdviserGovernancePostResult = {
  bindingStatus: ClassAdviserBindingStatus | null;
  changed: boolean;
  classCode: string;
  classId: string;
  className: string;
  endedAt: string;
  postId: number | string;
  staffId: string;
  staffName: string | null;
};
