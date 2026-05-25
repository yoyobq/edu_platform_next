// src/entities/department/application/department-select-options.ts

export type DepartmentOptionLike = {
  departmentName?: string | null;
  id?: string | null;
  isEnabled?: boolean | null;
  shortName?: string | null;
};

export type DepartmentSelectOption = {
  departmentName: string;
  id: string;
  isEnabled: boolean;
  label: string;
  shortName: string | null;
  value: string;
};

type BuildDepartmentSelectOptionsInput = {
  includeDisabled?: boolean;
};

type EnsureDepartmentSelectOptionInput = {
  id: string;
  label?: string;
};

type ResolveDepartmentDefaultIdInput = {
  currentDepartmentId?: string | null;
  defaultDepartmentId: string;
  options: readonly DepartmentSelectOption[];
};

function normalizeDepartmentId(id: string | null | undefined) {
  return id?.trim() ?? '';
}

function buildDepartmentLabel(input: {
  departmentName?: string | null;
  id: string;
  shortName?: string | null;
}) {
  const name = input.departmentName?.trim() || input.id;
  const shortName = input.shortName?.trim();

  return shortName ? `${name} (${shortName})` : name;
}

export function buildDepartmentSelectOptions(
  records: readonly DepartmentOptionLike[],
  options: BuildDepartmentSelectOptionsInput = {},
) {
  const includeDisabled = options.includeDisabled ?? false;
  const seenIds = new Set<string>();
  const selectOptions: DepartmentSelectOption[] = [];

  for (const record of records) {
    const id = normalizeDepartmentId(record.id);

    if (!id || seenIds.has(id)) {
      continue;
    }

    const isEnabled = record.isEnabled ?? true;

    if (!includeDisabled && !isEnabled) {
      continue;
    }

    const departmentName = record.departmentName?.trim() || id;
    const shortName = record.shortName?.trim() || null;

    selectOptions.push({
      departmentName,
      id,
      isEnabled,
      label: buildDepartmentLabel({ departmentName, id, shortName }),
      shortName,
      value: id,
    });
    seenIds.add(id);
  }

  return selectOptions;
}

export function ensureDepartmentSelectOption(
  options: readonly DepartmentSelectOption[],
  input: EnsureDepartmentSelectOptionInput,
) {
  const id = normalizeDepartmentId(input.id);

  if (!id || options.some((option) => option.value === id)) {
    return [...options];
  }

  const label = input.label?.trim() || id;
  const fallbackOption: DepartmentSelectOption = {
    departmentName: label,
    id,
    isEnabled: true,
    label,
    shortName: null,
    value: id,
  };

  return [fallbackOption, ...options];
}

export function resolveDepartmentDefaultId(input: ResolveDepartmentDefaultIdInput) {
  const currentDepartmentId = normalizeDepartmentId(input.currentDepartmentId);

  if (currentDepartmentId && input.options.some((option) => option.value === currentDepartmentId)) {
    return currentDepartmentId;
  }

  const defaultDepartmentId = normalizeDepartmentId(input.defaultDepartmentId);

  if (defaultDepartmentId) {
    return defaultDepartmentId;
  }

  return input.options[0]?.value;
}
