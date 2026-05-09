// src/features/staff-semester-profiles/ui/staff-semester-profiles-page-content.tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SolutionOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Empty,
  Form,
  message,
  Modal,
  Select,
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

import { DecoratedPageHeader } from '@/shared/ui/decorated-page-header';

import { formatDateTime } from '../application/format';
import {
  TEACHER_ENGAGEMENT_TYPE_LABELS,
  TEACHER_ENGAGEMENT_TYPE_OPTIONS,
  TEACHER_ENGAGEMENT_TYPE_TAG_COLORS,
} from '../application/labels';
import {
  buildDepartmentOptions,
  buildTeacherOptions,
  buildTeachingGroupOptions,
  buildWorkloadDepartmentOptions,
  ensureEntityOption,
  hasTeachingGroupInDepartment,
} from '../application/options';
import {
  DEFAULT_FILTER_STATE,
  DEFAULT_QUERY_STATE,
  fromSorterOrder,
  isProfileSortField,
  normalizeTextFilter,
  scopeFilterStateToWorkloadDepartment,
  type StaffSemesterProfilesFilterState,
  type StaffSemesterProfilesQueryState,
  type StaffSemesterProfilesViewerRole,
  toSorterOrder,
} from '../application/query-state';
import { pickNextSemesterId, sortSemesters } from '../application/semester';
import {
  type AcademicTeacherEngagementType,
  backfillStaffSemesterProfilesFromCourseSchedules,
  type BackfillStaffSemesterProfilesFromCourseSchedulesResult,
  requestStaffSemesterProfileDepartments,
  requestStaffSemesterProfileOptionRecords,
  requestStaffSemesterProfiles,
  type StaffSemesterProfile,
  type StaffSemesterProfileDepartmentOption,
  type StaffSemesterProfileListResponse,
  updateStaffSemesterProfile,
} from '../infrastructure/staff-semester-profiles-api';

import { StaffSemesterProfilesBackfillPanel } from './backfill-panel';
import { renderEmptyText, renderSingleLineText } from './cell-renderers';
import { StaffSemesterProfilesFiltersCard } from './filters-card';

export type StaffSemesterProfilesPageContentProps = {
  defaultDepartmentId?: string | null;
  viewerRole?: StaffSemesterProfilesViewerRole;
};

type EditProfileFormValues = {
  teacherEngagementType?: AcademicTeacherEngagementType;
  teachingGroupId?: string;
  workloadDepartmentId?: string;
};

function resolveProfileRowKey(record: StaffSemesterProfile) {
  return `${record.semesterId}-${record.staffId}`;
}

function normalizeOptionalEditValue(value: string | null | undefined) {
  const normalizedValue = value?.trim();

  return normalizedValue ? normalizedValue : null;
}

function applyUpdatedProfile(
  response: StaffSemesterProfileListResponse | null,
  updatedProfile: StaffSemesterProfile,
) {
  if (!response) {
    return response;
  }

  return {
    ...response,
    list: response.list.map((record) =>
      record.staffId === updatedProfile.staffId && record.semesterId === updatedProfile.semesterId
        ? updatedProfile
        : record,
    ),
  };
}

export function StaffSemesterProfilesPageContent({
  defaultDepartmentId: defaultDepartmentIdProp,
  viewerRole: viewerRoleProp,
}: StaffSemesterProfilesPageContentProps) {
  const [messageApi, messageContextHolder] = message.useMessage();
  const [editForm] = Form.useForm<EditProfileFormValues>();
  const viewerRole = viewerRoleProp ?? 'academicOfficer';
  const isAcademicOfficer = viewerRole === 'academicOfficer';
  const defaultDepartmentId = defaultDepartmentIdProp?.trim() ?? '';
  const scopedWorkloadDepartmentId = isAcademicOfficer ? defaultDepartmentId : '';
  const initialFilterState = useMemo(
    () => scopeFilterStateToWorkloadDepartment(DEFAULT_FILTER_STATE, scopedWorkloadDepartmentId),
    [scopedWorkloadDepartmentId],
  );
  const initialQueryState = useMemo(
    () => scopeFilterStateToWorkloadDepartment(DEFAULT_QUERY_STATE, scopedWorkloadDepartmentId),
    [scopedWorkloadDepartmentId],
  );
  const [semesters, setSemesters] = useState<AcademicSemesterRecord[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | null>(null);
  const [filterState, setFilterState] =
    useState<StaffSemesterProfilesFilterState>(initialFilterState);
  const [queryState, setQueryState] = useState<StaffSemesterProfilesQueryState>(initialQueryState);
  const [loadingSemesters, setLoadingSemesters] = useState(true);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [loadingProfileOptions, setLoadingProfileOptions] = useState(false);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [semesterError, setSemesterError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileOptionsError, setProfileOptionsError] = useState<string | null>(null);
  const [departmentError, setDepartmentError] = useState<string | null>(null);
  const [profileOptionRecords, setProfileOptionRecords] = useState<StaffSemesterProfile[]>([]);
  const [departmentRecords, setDepartmentRecords] = useState<
    StaffSemesterProfileDepartmentOption[]
  >([]);
  const [editingProfile, setEditingProfile] = useState<StaffSemesterProfile | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [backfillWorkloadDepartmentId, setBackfillWorkloadDepartmentId] = useState(
    defaultDepartmentIdProp ?? '',
  );
  const [backfillResult, setBackfillResult] =
    useState<BackfillStaffSemesterProfilesFromCourseSchedulesResult | null>(null);
  const [previewingBackfill, setPreviewingBackfill] = useState(false);
  const [executingBackfill, setExecutingBackfill] = useState(false);
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

  const loadProfiles = useCallback(
    async (nextQueryState: StaffSemesterProfilesQueryState) => {
      if (!selectedSemesterId) {
        setProfileResponse(null);
        return;
      }

      if (isAcademicOfficer && !scopedWorkloadDepartmentId) {
        setProfileError('当前教务账号缺少系部归属，无法查看教师学期归属。');
        setProfileResponse(null);
        return;
      }

      const effectiveQueryState = scopeFilterStateToWorkloadDepartment(
        nextQueryState,
        scopedWorkloadDepartmentId,
      );

      setLoadingProfiles(true);
      setProfileError(null);

      try {
        const result = await requestStaffSemesterProfiles({
          limit: effectiveQueryState.limit,
          page: effectiveQueryState.page,
          semesterId: selectedSemesterId,
          sortBy: effectiveQueryState.sortBy,
          sortOrder: effectiveQueryState.sortOrder,
          staffId: normalizeTextFilter(effectiveQueryState.staffId),
          teacherEngagementType: effectiveQueryState.teacherEngagementType,
          teachingGroupId: normalizeTextFilter(effectiveQueryState.teachingGroupId),
          workloadDepartmentId: normalizeTextFilter(effectiveQueryState.workloadDepartmentId),
        });

        setProfileResponse(result);
      } catch (error) {
        setProfileError(error instanceof Error ? error.message : '暂时无法加载教师学期归属。');
        setProfileResponse(null);
      } finally {
        setLoadingProfiles(false);
      }
    },
    [isAcademicOfficer, scopedWorkloadDepartmentId, selectedSemesterId],
  );

  const loadProfileOptions = useCallback(
    async (semesterId: number) => {
      if (isAcademicOfficer && !scopedWorkloadDepartmentId) {
        setProfileOptionsError('当前教务账号缺少系部归属，无法加载归属选项。');
        setProfileOptionRecords([]);
        return;
      }

      setLoadingProfileOptions(true);
      setProfileOptionsError(null);

      try {
        const result = await requestStaffSemesterProfileOptionRecords({
          semesterId,
          workloadDepartmentId: scopedWorkloadDepartmentId || undefined,
        });

        setProfileOptionRecords(result);
      } catch (error) {
        setProfileOptionsError(error instanceof Error ? error.message : '暂时无法加载归属选项。');
        setProfileOptionRecords([]);
      } finally {
        setLoadingProfileOptions(false);
      }
    },
    [isAcademicOfficer, scopedWorkloadDepartmentId],
  );

  const loadDepartments = useCallback(async () => {
    setLoadingDepartments(true);
    setDepartmentError(null);

    try {
      const result = await requestStaffSemesterProfileDepartments();

      setDepartmentRecords(result);
    } catch (error) {
      setDepartmentError(error instanceof Error ? error.message : '暂时无法加载系部列表。');
      setDepartmentRecords([]);
    } finally {
      setLoadingDepartments(false);
    }
  }, []);

  useEffect(() => {
    if (selectedSemesterId) {
      void loadProfiles(queryState);
    } else {
      setProfileResponse(null);
    }
  }, [loadProfiles, queryState, selectedSemesterId]);

  useEffect(() => {
    if (selectedSemesterId) {
      void loadProfileOptions(selectedSemesterId);
    } else {
      setProfileOptionRecords([]);
    }
  }, [loadProfileOptions, selectedSemesterId]);

  useEffect(() => {
    if (viewerRole === 'admin') {
      void loadDepartments();
    }
  }, [loadDepartments, viewerRole]);

  useEffect(() => {
    if (!isAcademicOfficer) {
      return;
    }

    setFilterState((currentValue) => ({
      ...currentValue,
      teachingGroupId:
        currentValue.workloadDepartmentId === scopedWorkloadDepartmentId
          ? currentValue.teachingGroupId
          : '',
      workloadDepartmentId: scopedWorkloadDepartmentId,
    }));
    setQueryState((currentValue) => ({
      ...currentValue,
      page: 1,
      teachingGroupId:
        currentValue.workloadDepartmentId === scopedWorkloadDepartmentId
          ? currentValue.teachingGroupId
          : '',
      workloadDepartmentId: scopedWorkloadDepartmentId,
    }));
  }, [isAcademicOfficer, scopedWorkloadDepartmentId]);

  useEffect(() => {
    setBackfillResult(null);
  }, [backfillWorkloadDepartmentId, selectedSemesterId]);

  const applyFilters = useCallback(() => {
    const effectiveFilterState = scopeFilterStateToWorkloadDepartment(
      filterState,
      scopedWorkloadDepartmentId,
    );

    setFilterState(effectiveFilterState);
    setQueryState((currentValue) => ({
      ...currentValue,
      ...effectiveFilterState,
      page: 1,
    }));
  }, [filterState, scopedWorkloadDepartmentId]);

  const resetFilters = useCallback(() => {
    setFilterState(initialFilterState);
    setQueryState((currentValue) => ({
      ...currentValue,
      ...initialFilterState,
      page: 1,
    }));
  }, [initialFilterState]);

  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        normalizeTextFilter(queryState.staffId) ||
        queryState.teacherEngagementType ||
        normalizeTextFilter(queryState.teachingGroupId) ||
        (!isAcademicOfficer && normalizeTextFilter(queryState.workloadDepartmentId)),
      ),
    [isAcademicOfficer, queryState],
  );

  const canEditTeacherEngagementType = viewerRole === 'admin' || viewerRole === 'academicOfficer';
  const canBackfillFromCourseSchedules = viewerRole === 'admin';
  const canEditTeachingGroup = true;
  const canEditWorkloadDepartment = viewerRole === 'admin';
  const editableFieldCount =
    (canEditTeacherEngagementType ? 1 : 0) +
    (canEditTeachingGroup ? 1 : 0) +
    (canEditWorkloadDepartment ? 1 : 0);
  const scopedProfileOptionRecords = useMemo(
    () =>
      scopedWorkloadDepartmentId
        ? profileOptionRecords.filter(
            (record) => record.workloadDepartmentId === scopedWorkloadDepartmentId,
          )
        : profileOptionRecords,
    [profileOptionRecords, scopedWorkloadDepartmentId],
  );
  const workloadDepartmentOptions = useMemo(
    () =>
      ensureEntityOption(
        buildWorkloadDepartmentOptions(scopedProfileOptionRecords),
        scopedWorkloadDepartmentId,
        scopedWorkloadDepartmentId,
      ),
    [scopedProfileOptionRecords, scopedWorkloadDepartmentId],
  );
  const teacherOptions = useMemo(
    () => buildTeacherOptions(scopedProfileOptionRecords),
    [scopedProfileOptionRecords],
  );
  const backfillDepartmentOptions = useMemo(
    () => buildDepartmentOptions(departmentRecords),
    [departmentRecords],
  );
  const filterTeachingGroupOptions = useMemo(
    () => buildTeachingGroupOptions(scopedProfileOptionRecords, filterState.workloadDepartmentId),
    [filterState.workloadDepartmentId, scopedProfileOptionRecords],
  );
  const isBackfillResultForCurrentSelection =
    backfillResult?.semesterId === selectedSemesterId &&
    backfillResult.workloadDepartmentId === backfillWorkloadDepartmentId;
  const hasCurrentBackfillBlocking =
    Boolean(isBackfillResultForCurrentSelection) && (backfillResult?.blockingCount ?? 0) > 0;
  const canSubmitBackfill =
    Boolean(selectedSemesterId && backfillWorkloadDepartmentId.trim()) &&
    !previewingBackfill &&
    !executingBackfill;
  const editingWorkloadDepartmentId = Form.useWatch('workloadDepartmentId', editForm);
  const effectiveEditingWorkloadDepartmentId =
    editingWorkloadDepartmentId ?? editingProfile?.workloadDepartmentId ?? undefined;
  const departmentSelectOptions = useMemo(
    () =>
      ensureEntityOption(
        workloadDepartmentOptions,
        editingProfile?.workloadDepartmentId,
        editingProfile?.workloadDepartmentName,
      ),
    [
      editingProfile?.workloadDepartmentId,
      editingProfile?.workloadDepartmentName,
      workloadDepartmentOptions,
    ],
  );
  const teachingGroupEditOptions = useMemo(
    () =>
      ensureEntityOption(
        buildTeachingGroupOptions(profileOptionRecords, effectiveEditingWorkloadDepartmentId),
        editingProfile?.teachingGroupId,
        editingProfile?.teachingGroupName,
      ),
    [
      editingProfile?.teachingGroupId,
      editingProfile?.teachingGroupName,
      effectiveEditingWorkloadDepartmentId,
      profileOptionRecords,
    ],
  );

  const runBackfill = useCallback(
    async (dryRun: boolean) => {
      const normalizedWorkloadDepartmentId = backfillWorkloadDepartmentId.trim();

      if (!selectedSemesterId || !normalizedWorkloadDepartmentId) {
        void messageApi.warning('请选择学期和工作量归口系。');
        return;
      }

      if (!dryRun && hasCurrentBackfillBlocking) {
        void messageApi.warning('当前预览存在阻断项，请处理后再确认补齐。');
        return;
      }

      if (dryRun) {
        setPreviewingBackfill(true);
      } else {
        setExecutingBackfill(true);
      }

      try {
        const result = await backfillStaffSemesterProfilesFromCourseSchedules({
          dryRun,
          semesterId: selectedSemesterId,
          workloadDepartmentId: normalizedWorkloadDepartmentId,
        });

        setBackfillResult(result);

        if (dryRun) {
          void messageApi.success('补齐预览已生成。');
          return;
        }

        void messageApi.success(`补齐完成，本次创建 ${result.createdCount} 条。`);
        await loadProfiles(queryState);
        await loadProfileOptions(selectedSemesterId);
      } catch (error) {
        void messageApi.error(
          error instanceof Error ? error.message : '暂时无法从课程表补齐教师学期归属。',
        );
      } finally {
        if (dryRun) {
          setPreviewingBackfill(false);
        } else {
          setExecutingBackfill(false);
        }
      }
    },
    [
      backfillWorkloadDepartmentId,
      hasCurrentBackfillBlocking,
      loadProfileOptions,
      loadProfiles,
      messageApi,
      queryState,
      selectedSemesterId,
    ],
  );

  const openEditModal = useCallback(
    (record: StaffSemesterProfile) => {
      setEditingProfile(record);
      editForm.setFieldsValue({
        teacherEngagementType: record.teacherEngagementType ?? undefined,
        teachingGroupId: record.teachingGroupId ?? undefined,
        workloadDepartmentId: record.workloadDepartmentId ?? undefined,
      });
    },
    [editForm],
  );

  function closeEditModal() {
    setEditingProfile(null);
    editForm.resetFields();
  }

  async function handleEditSubmit() {
    if (!editingProfile) {
      return;
    }

    const values = await editForm.validateFields();
    const nextTeacherEngagementType = values.teacherEngagementType;
    const nextTeachingGroupId = normalizeOptionalEditValue(values.teachingGroupId);
    const nextWorkloadDepartmentId = canEditWorkloadDepartment
      ? normalizeOptionalEditValue(values.workloadDepartmentId)
      : editingProfile.workloadDepartmentId;
    const input: Parameters<typeof updateStaffSemesterProfile>[0] = {
      semesterId: editingProfile.semesterId,
      staffId: editingProfile.staffId,
    };

    if (
      canEditTeacherEngagementType &&
      nextTeacherEngagementType !== editingProfile.teacherEngagementType
    ) {
      input.teacherEngagementType = nextTeacherEngagementType;
    }

    if (
      canEditWorkloadDepartment &&
      nextWorkloadDepartmentId !== editingProfile.workloadDepartmentId &&
      nextWorkloadDepartmentId !== null &&
      nextTeachingGroupId !== null &&
      !hasTeachingGroupInDepartment(
        profileOptionRecords,
        nextTeachingGroupId,
        nextWorkloadDepartmentId,
      )
    ) {
      void messageApi.warning('修改工作量归属系部时，请改选目标系部下的教研组，或清空教研组。');
      return;
    }

    if (canEditTeachingGroup && nextTeachingGroupId !== editingProfile.teachingGroupId) {
      input.teachingGroupId = nextTeachingGroupId;
    }

    if (
      canEditWorkloadDepartment &&
      nextWorkloadDepartmentId !== editingProfile.workloadDepartmentId
    ) {
      input.workloadDepartmentId = nextWorkloadDepartmentId;
    }

    if (
      input.teacherEngagementType === undefined &&
      input.teachingGroupId === undefined &&
      input.workloadDepartmentId === undefined
    ) {
      void messageApi.info('没有字段变更。');
      closeEditModal();
      return;
    }

    setSavingProfile(true);

    try {
      const updatedProfile = await updateStaffSemesterProfile(input);

      setProfileResponse((currentResponse) => applyUpdatedProfile(currentResponse, updatedProfile));
      closeEditModal();
      void messageApi.success('教师学期归属已更新。');

      await loadProfiles(queryState);
      if (selectedSemesterId) {
        await loadProfileOptions(selectedSemesterId);
      }
    } catch (error) {
      void messageApi.error(error instanceof Error ? error.message : '暂时无法修改教师学期归属。');
    } finally {
      setSavingProfile(false);
    }
  }

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
        width: 88,
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
        width: 104,
      },
      {
        dataIndex: 'teacherEngagementType',
        key: 'teacherEngagementType',
        render: (value: AcademicTeacherEngagementType | null) =>
          value ? (
            <Tag color={TEACHER_ENGAGEMENT_TYPE_TAG_COLORS[value]} style={{ marginInlineEnd: 0 }}>
              {TEACHER_ENGAGEMENT_TYPE_LABELS[value]}
            </Tag>
          ) : (
            renderEmptyText()
          ),
        title: '聘任',
        width: 112,
      },
      {
        key: 'teachingGroup',
        render: (_, record) =>
          renderSingleLineText(record.teachingGroupName || record.teachingGroupId),
        title: '教研组',
        width: 160,
      },
      {
        key: 'workloadDepartment',
        render: (_, record) =>
          renderSingleLineText(record.workloadDepartmentName || record.workloadDepartmentId),
        title: '工作量归属系部',
        width: 180,
      },
      {
        dataIndex: 'updatedAt',
        key: 'updatedAt',
        render: (value: string, record) => {
          const formattedUpdatedAt = formatDateTime(value);
          const normalizedRemarks = record.remarks?.trim();

          return (
            <Tooltip title={normalizedRemarks ? `备注：${normalizedRemarks}` : undefined}>
              <Typography.Text ellipsis>{formattedUpdatedAt}</Typography.Text>
            </Tooltip>
          );
        },
        sorter: true,
        sortOrder:
          queryState.sortBy === 'updatedAt' ? toSorterOrder(queryState.sortOrder) : undefined,
        title: '更新时间',
        width: 160,
      },
      {
        fixed: 'right',
        key: 'actions',
        render: (_, record) => (
          <Button size="small" type="link" onClick={() => openEditModal(record)}>
            修改
          </Button>
        ),
        title: '操作',
        width: 72,
      },
    ],
    [openEditModal, queryState.sortBy, queryState.sortOrder],
  );

  const total = profileResponse?.total ?? 0;

  const updateFilterState = useCallback((patch: Partial<StaffSemesterProfilesFilterState>) => {
    setFilterState((currentValue) => ({
      ...currentValue,
      ...patch,
    }));
  }, []);

  const handleSemesterChange = useCallback((value: number) => {
    setSelectedSemesterId(value);
    setQueryState((currentValue) => ({ ...currentValue, page: 1 }));
  }, []);

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
      {messageContextHolder}

      <DecoratedPageHeader
        description="按学期维护教师聘任类型、教研组与工作量归属系部"
        icon={<SolutionOutlined />}
        title="教师学期归属"
      />

      <StaffSemesterProfilesFiltersCard
        filterState={filterState}
        isAcademicOfficer={isAcademicOfficer}
        loadingProfileOptions={loadingProfileOptions}
        loadingSemesters={loadingSemesters}
        profileOptionsError={profileOptionsError}
        scopedWorkloadDepartmentId={scopedWorkloadDepartmentId}
        selectedSemesterId={selectedSemesterId}
        semesterError={semesterError}
        semesters={semesters}
        teacherOptions={teacherOptions}
        teachingGroupOptions={filterTeachingGroupOptions}
        workloadDepartmentOptions={workloadDepartmentOptions}
        onApplyFilters={applyFilters}
        onFilterChange={updateFilterState}
        onResetFilters={resetFilters}
        onSemesterChange={handleSemesterChange}
      />

      {canBackfillFromCourseSchedules ? (
        <StaffSemesterProfilesBackfillPanel
          backfillResult={backfillResult}
          canSubmitBackfill={canSubmitBackfill}
          departmentError={departmentError}
          departmentOptions={backfillDepartmentOptions}
          executingBackfill={executingBackfill}
          hasCurrentBackfillBlocking={hasCurrentBackfillBlocking}
          isBackfillResultForCurrentSelection={isBackfillResultForCurrentSelection}
          loadingDepartments={loadingDepartments}
          previewingBackfill={previewingBackfill}
          workloadDepartmentId={backfillWorkloadDepartmentId}
          onRunBackfill={(dryRun) => void runBackfill(dryRun)}
          onWorkloadDepartmentChange={setBackfillWorkloadDepartmentId}
        />
      ) : null}

      <div className="flex flex-col gap-4">
        {profileError ? <Alert message={profileError} showIcon type="error" /> : null}

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
            className: 'px-4 py-3 m-0',
            position: ['bottomCenter'],
            size: 'small',
            showSizeChanger: true,
            showTotal: (value) => `共 ${value} 条`,
            total,
          }}
          rowKey={resolveProfileRowKey}
          scroll={{ x: 920 }}
          size="small"
          tableLayout="fixed"
          onChange={handleTableChange}
        />
      </div>

      <Modal
        destroyOnHidden
        footer={null}
        open={Boolean(editingProfile)}
        title="教师学期归属修改"
        width={420}
        onCancel={closeEditModal}
      >
        {editingProfile ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-block border border-border bg-bg-container p-4">
              <div className="flex flex-col gap-1">
                <Typography.Text strong>{editingProfile.staffName}</Typography.Text>
                <Typography.Text type="secondary">{editingProfile.staffId}</Typography.Text>
              </div>
            </div>

            <Form<EditProfileFormValues>
              form={editForm}
              id="staff-semester-profile-edit-form"
              layout="vertical"
              onFinish={() => void handleEditSubmit()}
            >
              {canEditTeacherEngagementType ? (
                <Form.Item<EditProfileFormValues> label="聘任类型" name="teacherEngagementType">
                  <Select options={TEACHER_ENGAGEMENT_TYPE_OPTIONS} placeholder="请选择" />
                </Form.Item>
              ) : null}

              {canEditTeachingGroup ? (
                <Form.Item<EditProfileFormValues> label="教研组" name="teachingGroupId">
                  <Select
                    allowClear
                    loading={loadingProfileOptions}
                    showSearch
                    optionFilterProp="label"
                    options={teachingGroupEditOptions}
                    placeholder="请选择教研组"
                  />
                </Form.Item>
              ) : null}

              {canEditWorkloadDepartment ? (
                <Form.Item<EditProfileFormValues>
                  label="工作量归属系部"
                  name="workloadDepartmentId"
                >
                  <Select
                    allowClear={viewerRole !== 'academicOfficer'}
                    showSearch
                    loading={loadingProfileOptions}
                    optionFilterProp="label"
                    options={departmentSelectOptions}
                    placeholder="请选择工作量归属系部"
                    onChange={() => {
                      editForm.setFieldValue('teachingGroupId', undefined);
                    }}
                  />
                </Form.Item>
              ) : null}
            </Form>

            {editableFieldCount === 0 ? (
              <Alert message="当前账号没有可编辑字段。" showIcon type="warning" />
            ) : null}

            <div className="flex justify-end gap-2">
              <Button onClick={closeEditModal}>取消</Button>
              <Button
                form="staff-semester-profile-edit-form"
                htmlType="submit"
                loading={savingProfile}
                type="primary"
              >
                保存
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
