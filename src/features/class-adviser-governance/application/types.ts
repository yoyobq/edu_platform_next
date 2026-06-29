// src/features/class-adviser-governance/application/types.ts

export type ClassAdviserBindingStatus = 'ACTIVE' | 'INACTIVE';

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
