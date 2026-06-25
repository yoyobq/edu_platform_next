// src/entities/department/index.ts

export {
  normalizeDepartmentName,
  WHITE_HOUSE_DEPARTMENT_NAME,
  WHITE_HOUSE_DEPARTMENT_OPTION_ID,
} from './application/department-normalization';
export type {
  DepartmentOptionLike,
  DepartmentSelectOption,
} from './application/department-select-options';
export {
  buildDepartmentSelectOptions,
  ensureDepartmentSelectOption,
  resolveDepartmentDefaultId,
} from './application/department-select-options';
export { DepartmentFormItem } from './ui/department-form-item';
export type { DepartmentSelectProps } from './ui/department-select';
export { DepartmentSelect } from './ui/department-select';
