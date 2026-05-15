// src/features/academic-workload/application/workload-department-options.ts
export type AcademicWorkloadDepartmentOptionLike = {
  departmentName?: string | null;
  id: string;
  shortName?: string | null;
};

export type AcademicWorkloadDepartmentSelectOption = {
  label: string;
  value: string;
};

export const DEFAULT_WORKLOAD_DEPARTMENT_ID = 'ORG0302';

export function buildAcademicWorkloadDepartmentSelectOptions(
  records: AcademicWorkloadDepartmentOptionLike[],
) {
  const optionsByValue = new Map<string, AcademicWorkloadDepartmentSelectOption>();

  records.forEach((record) => {
    const id = record.id.trim();

    if (!id) {
      return;
    }

    const name = record.departmentName?.trim() || record.shortName?.trim() || id;

    optionsByValue.set(id, {
      label: name,
      value: id,
    });
  });

  return Array.from(optionsByValue.values()).sort((left, right) =>
    left.label.localeCompare(right.label, 'zh-CN'),
  );
}

export function ensureSelectedAcademicWorkloadDepartmentOption(input: {
  appendMissing?: boolean;
  fallbackLabel: string;
  options: AcademicWorkloadDepartmentSelectOption[];
  selectedDepartmentId: string;
}) {
  if (
    !input.selectedDepartmentId ||
    input.options.some((option) => option.value === input.selectedDepartmentId)
  ) {
    return input.options;
  }

  const selectedOption = {
    label: input.fallbackLabel,
    value: input.selectedDepartmentId,
  };

  return input.appendMissing
    ? [...input.options, selectedOption]
    : [selectedOption, ...input.options];
}
