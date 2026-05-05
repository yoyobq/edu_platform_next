import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Input,
  message,
  Modal,
  Popconfirm,
  Select,
  Skeleton,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { FilterValue, SorterResult, TablePaginationConfig } from 'antd/es/table/interface';
import { useLoaderData } from 'react-router';

import {
  type AcademicSemesterRecord,
  requestAcademicSemesters,
} from '@/entities/academic-semester';

import {
  type AcademicTeacherEngagementType,
  backfillStaffSemesterProfilesFromCourseSchedules,
  type BackfillStaffSemesterProfilesFromCourseSchedulesItem,
  type BackfillStaffSemesterProfilesFromCourseSchedulesResult,
  requestStaffSemesterProfileDepartments,
  requestStaffSemesterProfileOptionRecords,
  requestStaffSemesterProfiles,
  type SortDirection,
  type StaffSemesterProfile,
  type StaffSemesterProfileBackfillAction,
  type StaffSemesterProfileBackfillBlockingReason,
  type StaffSemesterProfileDepartmentOption,
  type StaffSemesterProfileListResponse,
  type StaffSemesterProfileSortBy,
  updateStaffSemesterProfile,
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

type StaffSemesterProfilesLabLoaderData = {
  defaultDepartmentId?: string | null;
  viewerRole?: 'academicOfficer' | 'admin' | 'teachingGroupLeader';
} | null;

type EditProfileFormValues = {
  teacherEngagementType?: AcademicTeacherEngagementType;
  teachingGroupId?: string;
  workloadDepartmentId?: string;
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
  limit: 50,
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

const TEACHER_ENGAGEMENT_TYPE_TAG_COLORS: Record<AcademicTeacherEngagementType, string> = {
  ADMINISTRATIVE_TEACHING: 'purple',
  EXTERNAL_TEACHER: 'orange',
  FULL_TIME_TEACHER: 'green',
  PUBLIC_WELFARE_POST: 'cyan',
};

const TEACHER_ENGAGEMENT_TYPE_OPTIONS = Object.entries(TEACHER_ENGAGEMENT_TYPE_LABELS).map(
  ([value, label]) => ({
    label,
    value,
  }),
);

const BACKFILL_ACTION_LABELS: Record<StaffSemesterProfileBackfillAction, string> = {
  already_exists: '已存在',
  blocked: '需处理',
  created: '已创建',
  would_create: '待创建',
};

const BACKFILL_ACTION_TAG_COLORS: Record<StaffSemesterProfileBackfillAction, string> = {
  already_exists: 'default',
  blocked: 'red',
  created: 'green',
  would_create: 'blue',
};

const BACKFILL_BLOCKING_REASON_LABELS: Record<
  NonNullable<StaffSemesterProfileBackfillBlockingReason>,
  string
> = {
  teaching_group_not_found: '历史教研组不存在',
  teaching_group_workload_department_mismatch: '历史教研组与本次工作量归口系不一致',
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

function buildEntityOptions(
  records: StaffSemesterProfile[],
  getId: (record: StaffSemesterProfile) => string | null,
  getName: (record: StaffSemesterProfile) => string | null,
) {
  const optionByValue = new Map<string, EntitySelectOption>();

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

function buildWorkloadDepartmentOptions(records: StaffSemesterProfile[]) {
  return buildEntityOptions(
    records,
    (record) => record.workloadDepartmentId,
    (record) => record.workloadDepartmentName,
  );
}

function buildDepartmentOptions(records: StaffSemesterProfileDepartmentOption[]) {
  return records
    .filter((record) => record.id.trim())
    .map((record) => ({
      label: record.departmentName?.trim() || record.shortName?.trim() || record.id,
      value: record.id,
    }))
    .sort((left, right) => left.label.localeCompare(right.label, 'zh-CN'));
}

function buildTeachingGroupOptions(records: StaffSemesterProfile[], workloadDepartmentId?: string) {
  const normalizedWorkloadDepartmentId = workloadDepartmentId?.trim();
  const scopedRecords = normalizedWorkloadDepartmentId
    ? records.filter((record) => record.workloadDepartmentId === normalizedWorkloadDepartmentId)
    : records;

  return buildEntityOptions(
    scopedRecords,
    (record) => record.teachingGroupId,
    (record) => record.teachingGroupName,
  );
}

function ensureEntityOption(
  options: EntitySelectOption[],
  id: string | null | undefined,
  name: string | null | undefined,
) {
  const normalizedId = id?.trim();

  if (!normalizedId || options.some((option) => option.value === normalizedId)) {
    return options;
  }

  return [...options, { label: name?.trim() || normalizedId, value: normalizedId }].sort(
    (left, right) => left.label.localeCompare(right.label, 'zh-CN'),
  );
}

function normalizeOptionalEditValue(value: string | null | undefined) {
  const normalizedValue = value?.trim();

  return normalizedValue ? normalizedValue : null;
}

function hasTeachingGroupInDepartment(
  records: StaffSemesterProfile[],
  teachingGroupId: string,
  workloadDepartmentId: string,
) {
  return records.some(
    (record) =>
      record.teachingGroupId === teachingGroupId &&
      record.workloadDepartmentId === workloadDepartmentId,
  );
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

function resolveBackfillItemRowKey(record: BackfillStaffSemesterProfilesFromCourseSchedulesItem) {
  return `${record.staffId}-${record.action}`;
}

export function StaffSemesterProfilesLabPage() {
  const loaderData = useLoaderData() as StaffSemesterProfilesLabLoaderData;
  const [messageApi, messageContextHolder] = message.useMessage();
  const [editForm] = Form.useForm<EditProfileFormValues>();
  const viewerRole = loaderData?.viewerRole ?? 'teachingGroupLeader';
  const [semesters, setSemesters] = useState<AcademicSemesterRecord[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | null>(null);
  const [filterState, setFilterState] =
    useState<StaffSemesterProfilesFilterState>(DEFAULT_FILTER_STATE);
  const [queryState, setQueryState] =
    useState<StaffSemesterProfilesQueryState>(DEFAULT_QUERY_STATE);
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
    loaderData?.defaultDepartmentId ?? '',
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
      } catch (error) {
        setProfileError(error instanceof Error ? error.message : '暂时无法加载教师学期归属。');
        setProfileResponse(null);
      } finally {
        setLoadingProfiles(false);
      }
    },
    [selectedSemesterId],
  );

  const loadProfileOptions = useCallback(async (semesterId: number) => {
    setLoadingProfileOptions(true);
    setProfileOptionsError(null);

    try {
      const result = await requestStaffSemesterProfileOptionRecords({ semesterId });

      setProfileOptionRecords(result);
    } catch (error) {
      setProfileOptionsError(error instanceof Error ? error.message : '暂时无法加载归属选项。');
      setProfileOptionRecords([]);
    } finally {
      setLoadingProfileOptions(false);
    }
  }, []);

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
    setBackfillResult(null);
  }, [backfillWorkloadDepartmentId, selectedSemesterId]);

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

  const canEditTeacherEngagementType = viewerRole === 'admin' || viewerRole === 'academicOfficer';
  const canBackfillFromCourseSchedules = viewerRole === 'admin';
  const canEditTeachingGroup = true;
  const canEditWorkloadDepartment = viewerRole === 'admin' || viewerRole === 'academicOfficer';
  const editableFieldCount =
    (canEditTeacherEngagementType ? 1 : 0) +
    (canEditTeachingGroup ? 1 : 0) +
    (canEditWorkloadDepartment ? 1 : 0);
  const workloadDepartmentOptions = useMemo(
    () => buildWorkloadDepartmentOptions(profileOptionRecords),
    [profileOptionRecords],
  );
  const backfillDepartmentOptions = useMemo(
    () => buildDepartmentOptions(departmentRecords),
    [departmentRecords],
  );
  const filterTeachingGroupOptions = useMemo(
    () => buildTeachingGroupOptions(profileOptionRecords, filterState.workloadDepartmentId),
    [filterState.workloadDepartmentId, profileOptionRecords],
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
    const nextWorkloadDepartmentId = normalizeOptionalEditValue(values.workloadDepartmentId);
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

    if (viewerRole === 'academicOfficer' && nextWorkloadDepartmentId === null) {
      void messageApi.warning('教务行政不能清空工作量归属系部。');
      return;
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
            <Tag color={TEACHER_ENGAGEMENT_TYPE_TAG_COLORS[value]} style={{ marginInlineEnd: 0 }}>
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
        title: '工作量归属系部',
        width: 220,
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
        width: 180,
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
        width: 88,
      },
    ],
    [openEditModal, queryState.sortBy, queryState.sortOrder],
  );

  const backfillColumns = useMemo<
    ColumnsType<BackfillStaffSemesterProfilesFromCourseSchedulesItem>
  >(
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
        title: '工号',
        width: 150,
      },
      {
        dataIndex: 'staffName',
        fixed: 'left',
        key: 'staffName',
        render: (value: string) => renderSingleLineText(value, { strong: true }),
        title: '姓名',
        width: 140,
      },
      {
        dataIndex: 'action',
        key: 'action',
        render: (value: StaffSemesterProfileBackfillAction) => (
          <Tag color={BACKFILL_ACTION_TAG_COLORS[value]} style={{ marginInlineEnd: 0 }}>
            {BACKFILL_ACTION_LABELS[value]}
          </Tag>
        ),
        title: '状态',
        width: 104,
      },
      {
        dataIndex: 'teacherEngagementType',
        key: 'teacherEngagementType',
        render: (value: AcademicTeacherEngagementType) => (
          <Tag color={TEACHER_ENGAGEMENT_TYPE_TAG_COLORS[value]} style={{ marginInlineEnd: 0 }}>
            {TEACHER_ENGAGEMENT_TYPE_LABELS[value]}
          </Tag>
        ),
        title: '聘任',
        width: 132,
      },
      {
        dataIndex: 'teachingGroupId',
        key: 'teachingGroupId',
        render: (value: string | null) => renderSingleLineText(value),
        title: '教研组 ID',
        width: 160,
      },
      {
        dataIndex: 'inheritedFromSemesterId',
        key: 'inheritedFromSemesterId',
        render: (value: number | null) =>
          value === null ? renderEmptyText() : <Typography.Text>{value}</Typography.Text>,
        title: '继承来源学期',
        width: 140,
      },
      {
        dataIndex: 'blockingReason',
        key: 'blockingReason',
        render: (value: StaffSemesterProfileBackfillBlockingReason) =>
          value ? (
            <Typography.Text type="danger">
              {BACKFILL_BLOCKING_REASON_LABELS[value]}
            </Typography.Text>
          ) : (
            renderEmptyText()
          ),
        title: '阻断原因',
        width: 280,
      },
    ],
    [],
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
      {messageContextHolder}

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
                  loading={loadingProfileOptions}
                  optionFilterProp="label"
                  options={filterTeachingGroupOptions}
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
                <Typography.Text strong>工作量归属系部</Typography.Text>
                <Select
                  allowClear
                  showSearch
                  loading={loadingProfileOptions}
                  optionFilterProp="label"
                  options={workloadDepartmentOptions}
                  placeholder="按名称筛选"
                  value={filterState.workloadDepartmentId || undefined}
                  onChange={(value) =>
                    setFilterState((currentValue) => ({
                      ...currentValue,
                      teachingGroupId: '',
                      workloadDepartmentId: value ?? '',
                    }))
                  }
                />
              </label>
            </div>

            {profileOptionsError ? (
              <Alert message={profileOptionsError} showIcon type="warning" />
            ) : null}

            <div className="flex flex-wrap justify-end gap-3">
              <Button disabled={!selectedSemesterId} type="primary" onClick={applyFilters}>
                查询
              </Button>
              <Button onClick={resetFilters}>重置</Button>
            </div>
          </div>
        )}
      </Card>

      {canBackfillFromCourseSchedules ? (
        <Card
          title={
            <div className="flex flex-col">
              <span>从课程表补齐教师学期归属</span>
              <span className="mt-1 text-sm font-normal text-text-secondary">
                先预览课程表候选教师，再批量创建缺失的学期归属
              </span>
            </div>
          }
        >
          <div className="flex flex-col gap-4">
            {departmentError ? <Alert message={departmentError} showIcon type="warning" /> : null}

            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
              <label className="flex flex-col gap-2">
                <Typography.Text strong>工作量归口系</Typography.Text>
                <Select
                  showSearch
                  loading={loadingDepartments}
                  optionFilterProp="label"
                  options={backfillDepartmentOptions}
                  placeholder="请选择要写入的系部"
                  value={backfillWorkloadDepartmentId || undefined}
                  onChange={(value) => setBackfillWorkloadDepartmentId(value)}
                />
              </label>

              <div className="flex items-end gap-3">
                <Button
                  disabled={!canSubmitBackfill}
                  loading={previewingBackfill}
                  onClick={() => void runBackfill(true)}
                >
                  预览补齐
                </Button>
                <Popconfirm
                  cancelText="取消"
                  disabled={!canSubmitBackfill || hasCurrentBackfillBlocking}
                  okButtonProps={{ loading: executingBackfill }}
                  okText="确认补齐"
                  title={
                    backfillResult && isBackfillResultForCurrentSelection
                      ? `确认创建 ${backfillResult.creatableCount} 条教师学期归属？`
                      : '尚未预览，确认直接执行补齐？'
                  }
                  onConfirm={() => void runBackfill(false)}
                >
                  <Button
                    disabled={!canSubmitBackfill || hasCurrentBackfillBlocking}
                    loading={executingBackfill}
                    type="primary"
                  >
                    确认补齐
                  </Button>
                </Popconfirm>
              </div>
            </div>

            {hasCurrentBackfillBlocking ? (
              <Alert message="当前预览存在阻断项，确认补齐已禁用。" showIcon type="warning" />
            ) : null}

            {backfillResult ? (
              <div className="flex flex-col gap-4">
                <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
                  <div className="rounded-block border border-border bg-bg-container p-3">
                    <Typography.Text type="secondary">候选教师</Typography.Text>
                    <div className="mt-1 text-xl font-semibold">
                      {backfillResult.candidateCount}
                    </div>
                  </div>
                  <div className="rounded-block border border-border bg-bg-container p-3">
                    <Typography.Text type="secondary">可创建</Typography.Text>
                    <div className="mt-1 text-xl font-semibold">
                      {backfillResult.creatableCount}
                    </div>
                  </div>
                  <div className="rounded-block border border-border bg-bg-container p-3">
                    <Typography.Text type="secondary">阻断</Typography.Text>
                    <div className="mt-1 text-xl font-semibold">{backfillResult.blockingCount}</div>
                  </div>
                  <div className="rounded-block border border-border bg-bg-container p-3">
                    <Typography.Text type="secondary">本次已创建</Typography.Text>
                    <div className="mt-1 text-xl font-semibold">{backfillResult.createdCount}</div>
                  </div>
                  <div className="rounded-block border border-border bg-bg-container p-3">
                    <Typography.Text type="secondary">执行时已存在</Typography.Text>
                    <div className="mt-1 text-xl font-semibold">
                      {backfillResult.alreadyExistingCount}
                    </div>
                  </div>
                </div>

                <Table<BackfillStaffSemesterProfilesFromCourseSchedulesItem>
                  columns={backfillColumns}
                  dataSource={backfillResult.items}
                  locale={{
                    emptyText: (
                      <Empty description="暂无补齐明细" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    ),
                  }}
                  pagination={{ pageSize: 10, size: 'small' }}
                  rowKey={resolveBackfillItemRowKey}
                  scroll={{ x: 1106 }}
                  size="small"
                  tableLayout="fixed"
                />
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}

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
            className: 'px-4 py-3 m-0',
            position: ['bottomCenter'],
            size: 'small',
            showSizeChanger: true,
            showTotal: (value) => `共 ${value} 条`,
            total,
          }}
          rowKey={resolveProfileRowKey}
          scroll={{ x: 1340 }}
          size="middle"
          tableLayout="fixed"
          onChange={handleTableChange}
        />
      </Card>

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
                <Form.Item<EditProfileFormValues>
                  label="教研组"
                  name="teachingGroupId"
                  rules={
                    viewerRole === 'teachingGroupLeader'
                      ? [{ required: true, message: '请选择教研组。' }]
                      : undefined
                  }
                >
                  <Select
                    allowClear={viewerRole !== 'teachingGroupLeader'}
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

            {viewerRole === 'teachingGroupLeader' ? (
              <Alert message="教研组负责人只能修改教研组，且不能清空。" showIcon type="info" />
            ) : null}
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
