// src/entities/academic-semester/ui/academic-semester-select.tsx

import { useMemo } from 'react';
import type { SelectProps } from 'antd';
import { Select, Tag } from 'antd';
import type { ReactNode } from 'react';

import {
  type AcademicSemesterSelectRecord,
  formatAcademicSemesterLabel,
} from '../application/academic-semester-period-options';

import './academic-semester-select.css';

type AcademicSemesterSelectOption = {
  label: ReactNode;
  plainLabel: string;
  title: string;
  value: number;
};

export type AcademicSemesterSelectProps = Omit<SelectProps<number>, 'options'> & {
  emptyText?: ReactNode;
  records: readonly AcademicSemesterSelectRecord[];
  showCurrentInSelection?: boolean;
  showHiddenState?: boolean;
};

function buildAcademicSemesterSelectOptions(
  records: readonly AcademicSemesterSelectRecord[],
  showCurrentInSelection: boolean,
  showHiddenState: boolean,
) {
  const groups = new Map<number, AcademicSemesterSelectRecord[]>();

  for (const semester of records) {
    const existing = groups.get(semester.schoolYear) ?? [];
    existing.push(semester);
    groups.set(semester.schoolYear, existing);
  }

  return Array.from(groups.entries()).map(([schoolYear, semesters]) => ({
    label: `${schoolYear}-${schoolYear + 1} 学年`,
    options: semesters.map<AcademicSemesterSelectOption>((semester) => ({
      label: (
        <span className="academic-semester-select-option">
          <span className="academic-semester-select-option-name">{semester.name}</span>
          {semester.isCurrent ? (
            <span aria-label="当前学期" className="academic-semester-current-dot" />
          ) : null}
          {showHiddenState && semester.isVisible === false ? (
            <Tag color="default" bordered={false}>
              隐藏
            </Tag>
          ) : null}
        </span>
      ),
      plainLabel: showCurrentInSelection ? formatAcademicSemesterLabel(semester) : semester.name,
      title: formatAcademicSemesterLabel(semester),
      value: semester.id,
    })),
  }));
}

export function AcademicSemesterSelect({
  emptyText,
  records,
  showCurrentInSelection = true,
  showHiddenState = false,
  ...props
}: AcademicSemesterSelectProps) {
  const hasNoOptions = records.length === 0;
  const options = useMemo(
    () => buildAcademicSemesterSelectOptions(records, showCurrentInSelection, showHiddenState),
    [records, showCurrentInSelection, showHiddenState],
  );

  return (
    <Select
      popupMatchSelectWidth={false}
      showSearch
      {...props}
      notFoundContent={hasNoOptions ? (emptyText ?? '当前没有可选学期') : props.notFoundContent}
      optionFilterProp={props.optionFilterProp ?? 'plainLabel'}
      optionLabelProp={props.optionLabelProp ?? 'plainLabel'}
      options={options}
    />
  );
}
