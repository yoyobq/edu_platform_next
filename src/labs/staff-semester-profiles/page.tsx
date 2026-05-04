import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Empty,
  Input,
  Select,
  Skeleton,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { FilterValue, SorterResult, TablePaginationConfig } from 'antd/es/table/interface';

import {
  type AcademicSemesterRecord,
  requestAcademicSemesters,
} from '@/entities/academic-semester';

import {
  type AcademicTeacherEngagementType,
  requestStaffSemesterProfiles,
  type SortDirection,
  type StaffSemesterProfile,
  type StaffSemesterProfileListResponse,
  type StaffSemesterProfileSortBy,
} from './api';

type StaffSemesterProfilesFilterState = {
  keyword: string;
  staffId: string;
  teacherEngagementType?: AcademicTeacherEngagementType;
  teachingGroupId: string;
  workloadDepartmentId: string;
};

type StaffSemesterProfilesQueryState = StaffSemesterProfilesFilterState & {
  limit: number;
  page: number;
  sortBy: StaffSemesterProfileSortBy;
  sortOrder: SortDirection;
};

type EntitySelectOption = {
  label: string;
  value: string;
};

const DEFAULT_FILTER_STATE: StaffSemesterProfilesFilterState = {
  keyword: '',
  staffId: '',
  teacherEngagementType: undefined,
  teachingGroupId: '',
  workloadDepartmentId: '',
};

const DEFAULT_QUERY_STATE: StaffSemesterProfilesQueryState = {
  ...DEFAULT_FILTER_STATE,
  limit: 10,
  page: 1,
  sortBy: 'staffId',
  sortOrder: 'ASC',
};

const TEACHER_ENGAGEMENT_TYPE_LABELS: Record<AcademicTeacherEngagementType, string> = {
  ADMINISTRATIVE_TEACHING: '行政兼课',
  EXTERNAL_TEACHER: '外聘教师',
  FULL_TIME_TEACHER: '专任教师',
  PUBLIC_WELFARE_POST: '公益岗',
};

const EMPTY_CELL_TEXT = '—';

function toSorterOrder(sortOrder: SortDirection): 'ascend' | 'descend' {
  return sortOrder === 'ASC' ? 'ascend' : 'descend';
}

function fromSorterOrder(value: 'ascend' | 'descend' | null | undefined): SortDirection {
  return value === 'descend' ? 'DESC' : 'ASC';
}

function isProfileSortField(value: string | undefined): value is StaffSemesterProfileSortBy {
  return value === 'staffId' || value === 'staffName' || value === 'updatedAt';
}

function sortSemesters(records: AcademicSemesterRecord[]) {
  return [...records].sort((left, right) => {
    if (left.isCurrent !== right.isCurrent) {
      return left.isCurrent ? -1 : 1;
    }

    if (left.schoolYear !== right.schoolYear) {
      return right.schoolYear - left.schoolYear;
    }

    if (left.termNumber !== right.termNumber) {
      return right.termNumber - left.termNumber;
    }

    return right.id - left.id;
  });
}

function pickNextSemesterId(records: AcademicSemesterRecord[], currentSelection: number | null) {
  if (currentSelection !== null && records.some((record) => record.id === currentSelection)) {
    return currentSelection;
  }

  return records.find((record) => record.isCurrent)?.id ?? records[0]?.id ?? null;
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value || EMPTY_CELL_TEXT;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
  }).format(date);
}

function normalizeTextFilter(value: string) {
  return value.trim();
}

function resolveProfileRowKey(record: StaffSemesterProfile) {
  return `${record.semesterId}-${record.staffId}`;
}

function renderNullableText(value: string | null | undefined) {
  return value?.trim() || EMPTY_CELL_TEXT;
}

function renderEmptyText() {
  return <Typography.Text type="secondary">{EMPTY_CELL_TEXT}</Typography.Text>;
}

function renderSingleLineText(
  value: string | null | undefined,
  options: { strong?: boolean } = {},
) {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return renderEmptyText();
  }

  return (
    <Typography.Text ellipsis={{ tooltip: normalizedValue }} strong={options.strong}>
      {normalizedValue}
    </Typography.Text>
  );
}

function mergeEntityOptions(
  currentOptions: EntitySelectOption[],
  records: StaffSemesterProfile[],
  getId: (record: StaffSemesterProfile) => string | null,
  getName: (record: StaffSemesterProfile) => string | null,
) {
  const optionByValue = new Map(currentOptions.map((option) => [option.value, option]));

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

export function StaffSemesterProfilesLabPage() {
  const [semesters, setSemesters] = useState<AcademicSemesterRecord[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | null>(null);
  const [filterState, setFilterState] =
    useState<StaffSemesterProfilesFilterState>(DEFAULT_FILTER_STATE);
  const [queryState, setQueryState] =
    useState<StaffSemesterProfilesQueryState>(DEFAULT_QUERY_STATE);
  const [loadingSemesters, setLoadingSemesters] = useState(true);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [semesterError, setSemesterError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [teachingGroupOptions, setTeachingGroupOptions] = useState<EntitySelectOption[]>([]);
  const [workloadDepartmentOptions, setWorkloadDepartmentOptions] = useState<EntitySelectOption[]>(
    [],
  );
  const [profileResponse, setProfileResponse] = useState<StaffSemesterProfileListResponse | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    async function loadSemesters() {
      setLoadingSemesters(true);
      setSemesterError(null);

      try {
        const result = sortSemesters(await requestAcademicSemesters({ limit: 500 }));

        if (cancelled) {
          return;
        }

        setSemesters(result);
        setSelectedSemesterId((currentSelection) => pickNextSemesterId(result, currentSelection));
      } catch (error) {
        if (!cancelled) {
          setSemesterError(error instanceof Error ? error.message : '暂时无法加载学期列表。');
        }
      } finally {
        if (!cancelled) {
          setLoadingSemesters(false);
        }
      }
    }

    void loadSemesters();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedSemester = useMemo(
    () => semesters.find((semester) => semester.id === selectedSemesterId) ?? null,
    [selectedSemesterId, semesters],
  );

  const loadProfiles = useCallback(
    async (nextQueryState: StaffSemesterProfilesQueryState) => {
      if (!selectedSemesterId) {
        setProfileResponse(null);
        return;
      }

      setLoadingProfiles(true);
      setProfileError(null);

      try {
        const result = await requestStaffSemesterProfiles({
          keyword: normalizeTextFilter(nextQueryState.keyword),
          limit: nextQueryState.limit,
          page: nextQueryState.page,
          semesterId: selectedSemesterId,
          sortBy: nextQueryState.sortBy,
          sortOrder: nextQueryState.sortOrder,
          staffId: normalizeTextFilter(nextQueryState.staffId),
          teacherEngagementType: nextQueryState.teacherEngagementType,
          teachingGroupId: normalizeTextFilter(nextQueryState.teachingGroupId),
          workloadDepartmentId: normalizeTextFilter(nextQueryState.workloadDepartmentId),
        });

        setProfileResponse(result);
        setTeachingGroupOptions((currentOptions) =>
          mergeEntityOptions(
            currentOptions,
            result.list,
            (record) => record.teachingGroupId,
            (record) => record.teachingGroupName,
          ),
        );
        setWorkloadDepartmentOptions((currentOptions) =>
          mergeEntityOptions(
            currentOptions,
            result.list,
            (record) => record.workloadDepartmentId,
            (record) => record.workloadDepartmentName,
          ),
        );
      } catch (error) {
        setProfileError(error instanceof Error ? error.message : '暂时无法加载教师学期归属。');
        setProfileResponse(null);
      } finally {
        setLoadingProfiles(false);
      }
    },
    [selectedSemesterId],
  );

  useEffect(() => {
    if (selectedSemesterId) {
      void loadProfiles(queryState);
    } else {
      setProfileResponse(null);
    }
  }, [loadProfiles, queryState, selectedSemesterId]);

  const applyFilters = useCallback(() => {
    setQueryState((currentValue) => ({
      ...currentValue,
      ...filterState,
      page: 1,
    }));
  }, [filterState]);

  const resetFilters = useCallback(() => {
    setFilterState(DEFAULT_FILTER_STATE);
    setQueryState((currentValue) => ({
      ...currentValue,
      ...DEFAULT_FILTER_STATE,
      page: 1,
    }));
  }, []);

  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        normalizeTextFilter(queryState.keyword) ||
        normalizeTextFilter(queryState.staffId) ||
        queryState.teacherEngagementType ||
        normalizeTextFilter(queryState.teachingGroupId) ||
        normalizeTextFilter(queryState.workloadDepartmentId),
      ),
    [queryState],
  );

  const columns = useMemo<ColumnsType<StaffSemesterProfile>>(
    () => [
      {
        dataIndex: 'staffId',
        fixed: 'left',
        key: 'staffId',
        render: (value: string) => (
          <Typography.Text ellipsis={{ tooltip: value }}>
            <span className="font-mono text-sm">{value}</span>
          </Typography.Text>
        ),
        sorter: true,
        sortOrder:
          queryState.sortBy === 'staffId' ? toSorterOrder(queryState.sortOrder) : undefined,
        title: '工号',
        width: 150,
      },
      {
        dataIndex: 'staffName',
        fixed: 'left',
        key: 'staffName',
        render: (value: string) => renderSingleLineText(value, { strong: true }),
        sorter: true,
        sortOrder:
          queryState.sortBy === 'staffName' ? toSorterOrder(queryState.sortOrder) : undefined,
        title: '姓名',
        width: 150,
      },
      {
        dataIndex: 'teacherEngagementType',
        key: 'teacherEngagementType',
        render: (value: AcademicTeacherEngagementType | null) =>
          value ? (
            <Tag color="blue" style={{ marginInlineEnd: 0 }}>
              {TEACHER_ENGAGEMENT_TYPE_LABELS[value]}
            </Tag>
          ) : (
            renderEmptyText()
          ),
        title: '聘任',
        width: 132,
      },
      {
        key: 'teachingGroup',
        render: (_, record) =>
          renderSingleLineText(record.teachingGroupName || record.teachingGroupId),
        title: '教研组',
        width: 180,
      },
      {
        key: 'workloadDepartment',
        render: (_, record) =>
          renderSingleLineText(record.workloadDepartmentName || record.workloadDepartmentId),
        title: '系部',
        width: 180,
      },
      {
        dataIndex: 'remarks',
        key: 'remarks',
        render: (value: string | null) => {
          const normalizedValue = renderNullableText(value);

          if (normalizedValue === EMPTY_CELL_TEXT) {
            return renderEmptyText();
          }

          return (
            <div className="min-w-0">
              <Tooltip title={normalizedValue}>
                <Typography.Text ellipsis style={{ display: 'block', maxWidth: '100%' }}>
                  {normalizedValue}
                </Typography.Text>
              </Tooltip>
            </div>
          );
        },
        title: '备注',
        width: 180,
      },
      {
        dataIndex: 'updatedAt',
        key: 'updatedAt',
        render: (value: string) => (
          <Typography.Text ellipsis={{ tooltip: formatDateTime(value) }}>
            {formatDateTime(value)}
          </Typography.Text>
        ),
        sorter: true,
        sortOrder:
          queryState.sortBy === 'updatedAt' ? toSorterOrder(queryState.sortOrder) : undefined,
        title: '更新时间',
        width: 180,
      },
    ],
    [queryState.sortBy, queryState.sortOrder],
  );

  const total = profileResponse?.total ?? 0;

  function handleTableChange(
    pagination: TablePaginationConfig,
    _filters: Record<string, FilterValue | null>,
    sorter: SorterResult<StaffSemesterProfile> | SorterResult<StaffSemesterProfile>[],
  ) {
    const normalizedSorter = Array.isArray(sorter) ? sorter[0] : sorter;
    const nextSortKey =
      (typeof normalizedSorter?.columnKey === 'string' ? normalizedSorter.columnKey : undefined) ??
      (typeof normalizedSorter?.field === 'string' ? normalizedSorter.field : undefined);
    const nextSortBy = isProfileSortField(nextSortKey) ? nextSortKey : DEFAULT_QUERY_STATE.sortBy;
    const nextSortOrder = normalizedSorter?.order
      ? fromSorterOrder(normalizedSorter.order)
      : DEFAULT_QUERY_STATE.sortOrder;

    setQueryState((currentValue) => ({
      ...currentValue,
      limit: pagination.pageSize ?? currentValue.limit,
      page: pagination.current ?? currentValue.page,
      sortBy: nextSortBy,
      sortOrder: nextSortOrder,
    }));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Typography.Title level={3} style={{ margin: 0 }}>
          教师学期归属
        </Typography.Title>
        <Typography.Paragraph style={{ margin: 0 }} type="secondary">
          {selectedSemester ? `${selectedSemester.name} · 共 ${total} 条` : '请选择学期'}
        </Typography.Paragraph>
      </div>

      <Card>
        {loadingSemesters ? (
          <Skeleton active paragraph={{ rows: 5 }} />
        ) : (
          <div className="flex flex-col gap-4">
            {semesterError ? <Alert message={semesterError} showIcon type="error" /> : null}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="flex flex-col gap-2">
                <Typography.Text strong>学期</Typography.Text>
                <Select
                  options={semesters.map((semester) => ({
                    label: `${semester.name}${semester.isCurrent ? ' · 当前' : ''}`,
                    value: semester.id,
                  }))}
                  placeholder="请选择学期"
                  value={selectedSemesterId ?? undefined}
                  onChange={(value) => {
                    setSelectedSemesterId(value);
                    setQueryState((currentValue) => ({ ...currentValue, page: 1 }));
                  }}
                />
              </label>

              <label className="flex flex-col gap-2">
                <Typography.Text strong>工号</Typography.Text>
                <Input
                  allowClear
                  placeholder="精确匹配"
                  value={filterState.staffId}
                  onChange={(event) =>
                    setFilterState((currentValue) => ({
                      ...currentValue,
                      staffId: event.target.value,
                    }))
                  }
                  onPressEnter={applyFilters}
                />
              </label>

              <label className="flex flex-col gap-2">
                <Typography.Text strong>关键词</Typography.Text>
                <Input
                  allowClear
                  placeholder="姓名 / 工号"
                  value={filterState.keyword}
                  onChange={(event) =>
                    setFilterState((currentValue) => ({
                      ...currentValue,
                      keyword: event.target.value,
                    }))
                  }
                  onPressEnter={applyFilters}
                />
              </label>

              <label className="flex flex-col gap-2">
                <Typography.Text strong>聘任类型</Typography.Text>
                <Select
                  allowClear
                  options={Object.entries(TEACHER_ENGAGEMENT_TYPE_LABELS).map(([value, label]) => ({
                    label,
                    value,
                  }))}
                  placeholder="全部"
                  value={filterState.teacherEngagementType}
                  onChange={(value) =>
                    setFilterState((currentValue) => ({
                      ...currentValue,
                      teacherEngagementType: value,
                    }))
                  }
                />
              </label>

              <label className="flex flex-col gap-2">
                <Typography.Text strong>教研组</Typography.Text>
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  options={teachingGroupOptions}
                  placeholder="按名称筛选"
                  value={filterState.teachingGroupId || undefined}
                  onChange={(value) =>
                    setFilterState((currentValue) => ({
                      ...currentValue,
                      teachingGroupId: value ?? '',
                    }))
                  }
                />
              </label>

              <label className="flex flex-col gap-2">
                <Typography.Text strong>工作量系部</Typography.Text>
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  options={workloadDepartmentOptions}
                  placeholder="按名称筛选"
                  value={filterState.workloadDepartmentId || undefined}
                  onChange={(value) =>
                    setFilterState((currentValue) => ({
                      ...currentValue,
                      workloadDepartmentId: value ?? '',
                    }))
                  }
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button disabled={!selectedSemesterId} type="primary" onClick={applyFilters}>
                查询
              </Button>
              <Button onClick={resetFilters}>重置</Button>
            </div>
          </div>
        )}
      </Card>

      <Card
        title={
          <div className="flex flex-col">
            <span>教师学期归属列表</span>
            <span className="mt-1 text-sm font-normal text-text-secondary">
              {selectedSemester
                ? `${selectedSemester.name} · 数据来自 staffSemesterProfiles`
                : '请选择学期'}
            </span>
          </div>
        }
      >
        {profileError ? (
          <Alert message={profileError} showIcon style={{ marginBottom: 16 }} type="error" />
        ) : null}

        <Table<StaffSemesterProfile>
          columns={columns}
          dataSource={profileResponse?.list ?? []}
          locale={{
            emptyText: (
              <Empty
                description={hasActiveFilters ? '暂无查询结果' : '暂无教师学期归属'}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ),
          }}
          loading={loadingProfiles}
          pagination={{
            current: profileResponse?.current ?? queryState.page,
            pageSize: profileResponse?.pageSize ?? queryState.limit,
            pageSizeOptions: [10, 20, 50, 100],
            showSizeChanger: true,
            showTotal: (value) => `共 ${value} 条`,
            total,
          }}
          rowKey={resolveProfileRowKey}
          scroll={{ x: 1252 }}
          size="middle"
          tableLayout="fixed"
          onChange={handleTableChange}
        />
      </Card>
    </div>
  );
}
