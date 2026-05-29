// src/features/staff-semester-profiles/ui/filters-card.tsx
import { Alert, Button, Card, Select, Skeleton, Typography } from 'antd';

import type { AcademicSemesterRecord } from '@/entities/academic-semester';

import { TEACHER_ENGAGEMENT_TYPE_OPTIONS } from '../application/labels';
import type { EntitySelectOption } from '../application/options';
import type { StaffSemesterProfilesFilterState } from '../application/query-state';

type StaffSemesterProfilesFiltersCardProps = {
  filterState: StaffSemesterProfilesFilterState;
  isAcademicOfficer: boolean;
  loadingProfileOptions: boolean;
  loadingSemesters: boolean;
  onApplyFilters: () => void;
  onFilterChange: (patch: Partial<StaffSemesterProfilesFilterState>) => void;
  onResetFilters: () => void;
  onSemesterChange: (semesterId: number) => void;
  profileOptionsError: string | null;
  scopedWorkloadDepartmentId: string;
  selectedSemesterId: number | null;
  semesterError: string | null;
  semesters: AcademicSemesterRecord[];
  teacherOptions: EntitySelectOption[];
  teachingGroupOptions: EntitySelectOption[];
  workloadDepartmentOptions: EntitySelectOption[];
};

export function StaffSemesterProfilesFiltersCard({
  filterState,
  isAcademicOfficer,
  loadingProfileOptions,
  loadingSemesters,
  onApplyFilters,
  onFilterChange,
  onResetFilters,
  onSemesterChange,
  profileOptionsError,
  scopedWorkloadDepartmentId,
  selectedSemesterId,
  semesterError,
  semesters,
  teacherOptions,
  teachingGroupOptions,
  workloadDepartmentOptions,
}: StaffSemesterProfilesFiltersCardProps) {
  return (
    <Card>
      {loadingSemesters ? (
        <Skeleton active paragraph={{ rows: 5 }} />
      ) : (
        <div className="flex flex-col gap-4">
          {semesterError ? <Alert title={semesterError} showIcon type="error" /> : null}

          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
              <label className="flex flex-col gap-2">
                <Typography.Text strong>学期</Typography.Text>
                <Select
                  options={semesters.map((semester) => ({
                    label: `${semester.name}${semester.isCurrent ? ' · 当前' : ''}`,
                    value: semester.id,
                  }))}
                  placeholder="请选择学期"
                  value={selectedSemesterId ?? undefined}
                  onChange={onSemesterChange}
                />
              </label>

              <label className="flex flex-col gap-2">
                <Typography.Text strong>工作量归属系部</Typography.Text>
                <Select
                  allowClear={!isAcademicOfficer}
                  disabled={isAcademicOfficer}
                  showSearch
                  loading={loadingProfileOptions}
                  optionFilterProp="label"
                  options={workloadDepartmentOptions}
                  placeholder={
                    isAcademicOfficer
                      ? scopedWorkloadDepartmentId
                        ? '已固定为当前系部'
                        : '当前账号缺少系部归属'
                      : '按名称筛选'
                  }
                  value={filterState.workloadDepartmentId || undefined}
                  onChange={(value) =>
                    onFilterChange({
                      teachingGroupId: '',
                      workloadDepartmentId: value ?? '',
                    })
                  }
                />
              </label>
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
              <label className="flex flex-col gap-2">
                <Typography.Text strong>教师</Typography.Text>
                <Select
                  allowClear
                  showSearch
                  loading={loadingProfileOptions}
                  optionFilterProp="label"
                  options={teacherOptions}
                  placeholder="按姓名或工号筛选"
                  value={filterState.staffId || undefined}
                  onChange={(value) => onFilterChange({ staffId: value ?? '' })}
                />
              </label>

              <label className="flex flex-col gap-2">
                <Typography.Text strong>聘任类型</Typography.Text>
                <Select
                  allowClear
                  options={TEACHER_ENGAGEMENT_TYPE_OPTIONS}
                  placeholder="全部"
                  value={filterState.teacherEngagementType}
                  onChange={(value) => onFilterChange({ teacherEngagementType: value })}
                />
              </label>

              <label className="flex flex-col gap-2">
                <Typography.Text strong>教研组</Typography.Text>
                <Select
                  allowClear
                  showSearch
                  loading={loadingProfileOptions}
                  optionFilterProp="label"
                  options={teachingGroupOptions}
                  placeholder="按名称筛选"
                  value={filterState.teachingGroupId || undefined}
                  onChange={(value) => onFilterChange({ teachingGroupId: value ?? '' })}
                />
              </label>
            </div>
          </div>

          {profileOptionsError ? (
            <Alert title={profileOptionsError} showIcon type="warning" />
          ) : null}

          <div className="flex flex-wrap justify-end gap-3">
            <Button disabled={!selectedSemesterId} type="primary" onClick={onApplyFilters}>
              查询
            </Button>
            <Button onClick={onResetFilters}>重置</Button>
          </div>
        </div>
      )}
    </Card>
  );
}
