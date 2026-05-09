// src/features/staff-semester-profiles/application/options.ts
import type {
  StaffSemesterProfile,
  StaffSemesterProfileDepartmentOption,
} from '../infrastructure/staff-semester-profiles-api';

export type EntitySelectOption = {
  label: string;
  value: string;
};

function buildEntityOptions(
  records: StaffSemesterProfile[],
  getId: (record: StaffSemesterProfile) => string | null,
  getName: (record: StaffSemesterProfile) => string | null,
) {
  const optionByValue = new Map<string, EntitySelectOption>();

  for (const record of records) {
    const id = getId(record)?.trim();

    if (!id) {
      continue;
    }

    const name = getName(record)?.trim();

    optionByValue.set(id, {
      label: name || id,
      value: id,
    });
  }

  return Array.from(optionByValue.values()).sort((left, right) =>
    left.label.localeCompare(right.label, 'zh-CN'),
  );
}

export function buildWorkloadDepartmentOptions(records: StaffSemesterProfile[]) {
  return buildEntityOptions(
    records,
    (record) => record.workloadDepartmentId,
    (record) => record.workloadDepartmentName,
  );
}

export function buildTeacherOptions(records: StaffSemesterProfile[]) {
  return buildEntityOptions(
    records,
    (record) => record.staffId,
    (record) => `${record.staffId} ${record.staffName}`.trim(),
  );
}

export function buildDepartmentOptions(records: StaffSemesterProfileDepartmentOption[]) {
  return records
    .filter((record) => record.id.trim())
    .map((record) => ({
      label: record.departmentName?.trim() || record.shortName?.trim() || record.id,
      value: record.id,
    }))
    .sort((left, right) => left.label.localeCompare(right.label, 'zh-CN'));
}

export function buildTeachingGroupOptions(
  records: StaffSemesterProfile[],
  workloadDepartmentId?: string,
) {
  const normalizedWorkloadDepartmentId = workloadDepartmentId?.trim();
  const scopedRecords = normalizedWorkloadDepartmentId
    ? records.filter((record) => record.workloadDepartmentId === normalizedWorkloadDepartmentId)
    : records;

  return buildEntityOptions(
    scopedRecords,
    (record) => record.teachingGroupId,
    (record) => record.teachingGroupName,
  );
}

export function ensureEntityOption(
  options: EntitySelectOption[],
  id: string | null | undefined,
  name: string | null | undefined,
) {
  const normalizedId = id?.trim();

  if (!normalizedId || options.some((option) => option.value === normalizedId)) {
    return options;
  }

  return [...options, { label: name?.trim() || normalizedId, value: normalizedId }].sort(
    (left, right) => left.label.localeCompare(right.label, 'zh-CN'),
  );
}

export function hasTeachingGroupInDepartment(
  records: StaffSemesterProfile[],
  teachingGroupId: string,
  workloadDepartmentId: string,
) {
  return records.some(
    (record) =>
      record.teachingGroupId === teachingGroupId &&
      record.workloadDepartmentId === workloadDepartmentId,
  );
}
