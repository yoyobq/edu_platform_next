// src/entities/department/index.ts

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
