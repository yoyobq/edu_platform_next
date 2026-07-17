// src/entities/academic-semester/ui/academic-term-tabs.tsx

import { type ReactNode, useMemo } from 'react';
import { Tabs, theme } from 'antd';

import { formatAcademicSchoolYear, formatAcademicSemester } from '../application/academic-term';

import './academic-term-tabs.css';

export type AcademicTermTabRecord = {
  label: string;
  schoolYear: number | string;
  semesterId: number;
  sequence: number;
  termNumber: number | string;
};

type AcademicTermTabsProps = {
  activeSemesterId?: number | null;
  children: ReactNode;
  disabled?: boolean;
  records: readonly AcademicTermTabRecord[];
  onChange: (semesterId: number) => void;
};

export function AcademicTermTabs({
  activeSemesterId,
  children,
  disabled = false,
  records,
  onChange,
}: AcademicTermTabsProps) {
  const { token } = theme.useToken();
  const orderedRecords = useMemo(
    () => [...records].sort((left, right) => right.sequence - left.sequence),
    [records],
  );

  if (!records.length) return <>{children}</>;

  return (
    <Tabs
      activeKey={activeSemesterId == null ? undefined : String(activeSemesterId)}
      items={orderedRecords.map((record) => {
        const isActive = record.semesterId === activeSemesterId;

        return {
          children: isActive ? children : null,
          disabled,
          key: String(record.semesterId),
          label: (
            <span className="academic-term-tab-label" title={record.label}>
              <span
                className={[
                  'academic-term-tab-primary',
                  isActive ? 'academic-term-tab-primary-active' : null,
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {formatAcademicSchoolYear(record.schoolYear)}
              </span>
              <span className="academic-term-tab-secondary">
                <span className="academic-term-tab-secondary-text">
                  {formatAcademicSemester(record.termNumber)}
                </span>
                <span className="academic-term-tab-badge">{record.sequence}</span>
              </span>
            </span>
          ),
        };
      })}
      size="small"
      tabBarGutter={token.marginXS}
      tabPlacement="start"
      onChange={(key) => {
        const record = records.find((item) => String(item.semesterId) === key);
        if (record) onChange(record.semesterId);
      }}
    />
  );
}
