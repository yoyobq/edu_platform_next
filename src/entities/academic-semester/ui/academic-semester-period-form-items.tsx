// src/entities/academic-semester/ui/academic-semester-period-form-items.tsx

import type { FormItemProps } from 'antd';
import { Form, Select } from 'antd';
import type { ReactNode } from 'react';

import {
  ACADEMIC_SEMESTER_TERM_OPTIONS,
  type AcademicSemesterSchoolYearOption,
} from '../application/academic-semester-period-options';

type AcademicSemesterPeriodFormItemsProps = {
  disabled?: boolean;
  loading?: boolean;
  schoolYearHelp?: ReactNode;
  schoolYearName?: FormItemProps['name'];
  schoolYearOptions: readonly AcademicSemesterSchoolYearOption[];
  schoolYearValidateStatus?: FormItemProps['validateStatus'];
  semesterHelp?: ReactNode;
  semesterName?: FormItemProps['name'];
  semesterValidateStatus?: FormItemProps['validateStatus'];
};

export function AcademicSemesterPeriodFormItems({
  disabled = false,
  loading = false,
  schoolYearHelp,
  schoolYearName = 'schoolYear',
  schoolYearOptions,
  schoolYearValidateStatus,
  semesterHelp,
  semesterName = 'semester',
  semesterValidateStatus,
}: AcademicSemesterPeriodFormItemsProps) {
  const selectDisabled = disabled || loading || schoolYearOptions.length === 0;

  return (
    <>
      <Form.Item
        help={schoolYearHelp}
        label="学年"
        name={schoolYearName}
        rules={[{ required: true, message: '请选择学年' }]}
        validateStatus={schoolYearValidateStatus}
      >
        <Select
          disabled={selectDisabled}
          loading={loading}
          optionFilterProp="label"
          options={[...schoolYearOptions]}
          placeholder="选择学年"
          showSearch
        />
      </Form.Item>

      <Form.Item
        help={semesterHelp}
        label="学期"
        name={semesterName}
        rules={[{ required: true, message: '请选择学期' }]}
        validateStatus={semesterValidateStatus}
      >
        <Select
          disabled={selectDisabled}
          loading={loading}
          options={[...ACADEMIC_SEMESTER_TERM_OPTIONS]}
          placeholder="选择学期"
        />
      </Form.Item>
    </>
  );
}
