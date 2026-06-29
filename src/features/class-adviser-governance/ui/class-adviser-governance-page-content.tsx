// src/features/class-adviser-governance/ui/class-adviser-governance-page-content.tsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircleOutlined,
  LoginOutlined,
  ReloadOutlined,
  SearchOutlined,
  TeamOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Descriptions,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';

import {
  buildDepartmentSelectOptions,
  DepartmentFormItem,
  type DepartmentSelectOption,
  ensureDepartmentSelectOption,
} from '@/entities/department';
import {
  isExpiredUpstreamSessionError,
  resolveUpstreamErrorMessage,
  type StaffDirectoryResult,
  StaffDirectoryTeacherAutoComplete,
  type StoredUpstreamSession,
  type UpstreamAccountIdentity,
  UpstreamLoginModal,
  useUpstreamLoginModalController,
} from '@/entities/upstream-session';

import { DecoratedPageHeader } from '@/shared/ui/decorated-page-header';
import { ResponsiveGrid } from '@/shared/ui/responsive-layout';

import { resolveClassAdviserGovernanceStaffDirectory } from '../application/staff-directory-cache-workflow';
import {
  resolveAssignableClassAdviserStaffId,
  resolveClassAdviserGovernanceStaffName,
  validateClassAdviserGovernanceStaffId,
} from '../application/staff-directory-selection';
import type {
  AssignClassAdviserByStaffIdResult,
  ClassAdviserGovernanceActiveAdviser,
  ClassAdviserGovernanceClass,
} from '../application/types';
import {
  assignClassAdviserByStaffId,
  listClassAdviserGovernanceClasses,
  listLocalDepartmentOptions,
  resolveClassAdviserGovernanceErrorMessage,
} from '../infrastructure/api';

export type ClassAdviserGovernancePageContentProps = {
  canSelectDepartment?: boolean;
  currentAccount: UpstreamAccountIdentity | null;
  defaultDepartmentId?: string | null;
  lockedUpstreamLoginUserId?: string | null;
};

type FilterFormValues = {
  departmentId?: string;
  gradeYear?: number;
  keyword?: string;
  onlyMissing?: boolean;
};

type AssignFormValues = {
  remarks?: string;
  staffId: string;
  staffName?: string;
};

function formatOptionalValue(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  return String(value);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateTimeParts(value: string | null | undefined) {
  if (!value) {
    return {
      date: '—',
      time: null,
    };
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return {
      date: value,
      time: null,
    };
  }

  return {
    date: date.toLocaleDateString('zh-CN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
    time: date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      hour12: false,
      minute: '2-digit',
    }),
  };
}

function buildAdviserDisplayName(adviser: ClassAdviserGovernanceActiveAdviser) {
  const name = adviser.staffName?.trim() || adviser.staffId;

  return adviser.isTemporary ? `${name}（临时）` : name;
}

function renderLocalStaffTag(hasLocalStaff: boolean) {
  return hasLocalStaff ? <Tag color="green">本地 staff</Tag> : <Tag>预写 staffId</Tag>;
}

function renderBindingStatus(result: AssignClassAdviserByStaffIdResult) {
  if (!result.bindingStatus) {
    return <Tag>未收敛 binding</Tag>;
  }

  return result.bindingStatus === 'ACTIVE' ? (
    <Tag color="green">ACTIVE</Tag>
  ) : (
    <Tag color="orange">INACTIVE</Tag>
  );
}

function renderAdvisers(advisers: ClassAdviserGovernanceActiveAdviser[]) {
  if (advisers.length === 0) {
    return <Tag color="gold">缺失</Tag>;
  }

  return (
    <div className="flex flex-col gap-2">
      {advisers.map((adviser) => (
        <div className="flex flex-wrap items-center gap-2" key={`${adviser.postId}`}>
          <Typography.Text strong>{buildAdviserDisplayName(adviser)}</Typography.Text>
          <span className="text-xs text-text-secondary">{adviser.staffId}</span>
          {renderLocalStaffTag(adviser.hasLocalStaff)}
          {adviser.isTemporary ? <Tag color="blue">临时</Tag> : null}
        </div>
      ))}
    </div>
  );
}

function renderClassTitle(record: ClassAdviserGovernanceClass) {
  return (
    <div className="flex flex-col gap-1">
      <Typography.Text strong>{record.className}</Typography.Text>
      <span className="text-xs text-text-secondary">{record.classCode}</span>
    </div>
  );
}

function buildColumns(input: {
  departmentLabelById: ReadonlyMap<string, string>;
  isAssigning: boolean;
  onOpenAssign: (record: ClassAdviserGovernanceClass) => void;
}): ColumnsType<ClassAdviserGovernanceClass> {
  return [
    {
      dataIndex: 'className',
      key: 'className',
      render: (_value: string, record) => renderClassTitle(record),
      title: '班级',
      width: 260,
    },
    {
      dataIndex: 'departmentId',
      key: 'departmentId',
      render: (departmentId: string) => {
        const departmentLabel = input.departmentLabelById.get(departmentId);

        return departmentLabel ?? departmentId;
      },
      title: '系部',
      width: 160,
    },
    {
      dataIndex: 'gradeYear',
      defaultSortOrder: 'descend',
      key: 'gradeYear',
      render: (gradeYear: number | null) => formatOptionalValue(gradeYear),
      sorter: (left, right) => (left.gradeYear ?? -Infinity) - (right.gradeYear ?? -Infinity),
      title: '年级',
      width: 90,
    },
    {
      dataIndex: 'studentCount',
      key: 'studentCount',
      render: (studentCount: number) => studentCount.toLocaleString('zh-CN'),
      title: '学生数',
      width: 100,
    },
    {
      dataIndex: 'activeAdvisers',
      key: 'activeAdvisers',
      render: (advisers: ClassAdviserGovernanceActiveAdviser[]) => renderAdvisers(advisers),
      title: '当前班主任',
      width: 300,
    },
    {
      dataIndex: 'lastObservedAt',
      key: 'lastObservedAt',
      render: (lastObservedAt: string | null) => {
        const display = formatDateTimeParts(lastObservedAt);

        return (
          <span className="inline-flex flex-col gap-px leading-tight">
            <span className="whitespace-nowrap text-xs font-normal text-text-secondary">
              {display.date}
            </span>
            {display.time ? (
              <span className="whitespace-nowrap text-xs font-normal text-text-tertiary">
                {display.time}
              </span>
            ) : null}
          </span>
        );
      },
      title: '最近操作',
      width: 96,
    },
    {
      dataIndex: 'canAssign',
      key: 'canAssign',
      render: (canAssign: boolean) =>
        canAssign ? <Tag color="gold">可指派</Tag> : <Tag color="green">已配置</Tag>,
      title: '状态',
      width: 110,
    },
    {
      fixed: 'right',
      key: 'action',
      render: (_value: unknown, record) =>
        record.canAssign ? (
          <Button
            disabled={input.isAssigning}
            icon={<UserAddOutlined />}
            size="small"
            type="primary"
            onClick={() => input.onOpenAssign(record)}
          >
            指定班主任
          </Button>
        ) : (
          <Tooltip title="当前已有 active 班主任">
            <Button disabled size="small">
              不可追加
            </Button>
          </Tooltip>
        ),
      title: '操作',
      width: 140,
    },
  ];
}

function compareClassesByGradeDesc(
  left: ClassAdviserGovernanceClass,
  right: ClassAdviserGovernanceClass,
) {
  const gradeOrder = (right.gradeYear ?? -Infinity) - (left.gradeYear ?? -Infinity);

  if (gradeOrder !== 0) {
    return gradeOrder;
  }

  return left.classCode.localeCompare(right.classCode, 'zh-CN');
}

function buildGradeYearFilterOptions(classes: ClassAdviserGovernanceClass[]) {
  return Array.from(
    new Set(
      classes
        .map((item) => item.gradeYear)
        .filter((gradeYear): gradeYear is number => typeof gradeYear === 'number'),
    ),
  )
    .sort((left, right) => right - left)
    .map((gradeYear) => ({
      label: String(gradeYear),
      value: gradeYear,
    }));
}

export function ClassAdviserGovernancePageContent({
  canSelectDepartment: rawCanSelectDepartment = false,
  currentAccount,
  defaultDepartmentId = null,
  lockedUpstreamLoginUserId = null,
}: ClassAdviserGovernancePageContentProps) {
  const { message } = AntApp.useApp();
  const canSelectDepartment = Boolean(rawCanSelectDepartment);
  const scopedDepartmentId = defaultDepartmentId?.trim() || '';
  const initialDepartmentId = scopedDepartmentId || undefined;
  const fallbackDepartmentLabel = canSelectDepartment ? '默认系部' : '当前账号归口系';
  const [filterForm] = Form.useForm<FilterFormValues>();
  const selectedGradeYear = Form.useWatch('gradeYear', filterForm);
  const [assignForm] = Form.useForm<AssignFormValues>();
  const [classes, setClasses] = useState<ClassAdviserGovernanceClass[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<DepartmentSelectOption[]>([]);
  const [departmentOptionsError, setDepartmentOptionsError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [assignResult, setAssignResult] = useState<AssignClassAdviserByStaffIdResult | null>(null);
  const [selectedClass, setSelectedClass] = useState<ClassAdviserGovernanceClass | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [staffDirectoryResult, setStaffDirectoryResult] = useState<StaffDirectoryResult | null>(
    null,
  );
  const [staffDirectoryError, setStaffDirectoryError] = useState<string | null>(null);
  const [isLoadingStaffDirectory, setIsLoadingStaffDirectory] = useState(false);
  const staffDirectoryTeachers = useMemo(
    () => staffDirectoryResult?.teachers ?? [],
    [staffDirectoryResult],
  );
  const isAssignModalOpen = selectedClass !== null;
  const departmentLabelById = useMemo(
    () => new Map(departmentOptions.map((option) => [option.value, option.label])),
    [departmentOptions],
  );
  const {
    modalProps: upstreamLoginModalProps,
    openLoginModal,
    openLoginModalForExpiredSession,
    persistSessionFromResult,
    session: upstreamSession,
  } = useUpstreamLoginModalController({
    account: currentAccount,
    keepAlive: true,
    lockedUserId: lockedUpstreamLoginUserId,
    resolveLoginErrorMessage: (error) =>
      resolveUpstreamErrorMessage(error, '暂时无法登录 upstream。'),
  });
  const upstreamSessionKey = upstreamSession
    ? `${upstreamSession.accountId}:${upstreamSession.upstreamSessionToken}`
    : 'none';

  const loadClasses = useCallback(
    async (values: FilterFormValues) => {
      const departmentId = canSelectDepartment ? values.departmentId : scopedDepartmentId;

      if (!canSelectDepartment && !departmentId) {
        setClasses([]);
        setListError('当前账号缺少归口系，暂时无法加载班主任任职列表');
        return;
      }

      setIsLoading(true);
      setListError(null);

      try {
        const nextClasses = await listClassAdviserGovernanceClasses({
          departmentId,
          keyword: values.keyword,
          onlyMissing: values.onlyMissing,
        });

        setClasses(nextClasses);
      } catch (error) {
        setClasses([]);
        setListError(
          resolveClassAdviserGovernanceErrorMessage(error, '暂时无法加载班主任任职列表。'),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [canSelectDepartment, scopedDepartmentId],
  );

  const loadDepartments = useCallback(async () => {
    setIsLoadingDepartments(true);
    setDepartmentOptionsError(null);

    const resolveNextDepartmentId = () => {
      if (!canSelectDepartment) {
        return initialDepartmentId;
      }

      const currentDepartmentId = filterForm.getFieldValue('departmentId') as string | undefined;

      if (filterForm.isFieldTouched('departmentId')) {
        return currentDepartmentId;
      }

      return currentDepartmentId ?? initialDepartmentId;
    };

    try {
      const departments = await listLocalDepartmentOptions();
      const nextOptions = initialDepartmentId
        ? ensureDepartmentSelectOption(buildDepartmentSelectOptions(departments), {
            id: initialDepartmentId,
            label: fallbackDepartmentLabel,
          })
        : buildDepartmentSelectOptions(departments);

      setDepartmentOptions(nextOptions);
      filterForm.setFieldsValue({
        departmentId: resolveNextDepartmentId(),
      });
    } catch (error) {
      setDepartmentOptions(
        initialDepartmentId
          ? ensureDepartmentSelectOption([], {
              id: initialDepartmentId,
              label: fallbackDepartmentLabel,
            })
          : [],
      );
      setDepartmentOptionsError(
        resolveClassAdviserGovernanceErrorMessage(error, '暂时无法加载系部列表。'),
      );
      filterForm.setFieldsValue({
        departmentId: resolveNextDepartmentId(),
      });
    } finally {
      setIsLoadingDepartments(false);
    }
  }, [canSelectDepartment, fallbackDepartmentLabel, filterForm, initialDepartmentId]);

  const loadStaffDirectory = useCallback(
    async (input: { forceRefresh?: boolean; session?: StoredUpstreamSession | null } = {}) => {
      const session = input.session ?? upstreamSession ?? null;

      if (input.forceRefresh && !session) {
        openLoginModal();
        return;
      }

      setIsLoadingStaffDirectory(true);
      setStaffDirectoryError(null);

      try {
        const result = await resolveClassAdviserGovernanceStaffDirectory({
          currentDirectory: input.forceRefresh ? null : staffDirectoryResult,
          forceRefresh: input.forceRefresh,
          persistSessionFromResult,
          session,
        });

        setStaffDirectoryResult(result.directory);
      } catch (error) {
        const errorMessage = resolveUpstreamErrorMessage(error, '暂时无法加载教师目录。');

        setStaffDirectoryError(errorMessage);

        if (session && isExpiredUpstreamSessionError(error)) {
          openLoginModalForExpiredSession({
            loginError: errorMessage,
            session,
          });
        }
      } finally {
        setIsLoadingStaffDirectory(false);
      }
    },
    [
      openLoginModal,
      openLoginModalForExpiredSession,
      persistSessionFromResult,
      staffDirectoryResult,
      upstreamSession,
    ],
  );

  const refreshCurrentList = useCallback(async () => {
    await loadClasses(filterForm.getFieldsValue());
  }, [filterForm, loadClasses]);

  const handleOpenAssign = useCallback(
    (record: ClassAdviserGovernanceClass) => {
      setAssignResult(null);
      assignForm.resetFields();
      setSelectedClass(record);
    },
    [assignForm],
  );

  const handleCloseAssign = useCallback(() => {
    if (isAssigning) {
      return;
    }

    setSelectedClass(null);
    setAssignResult(null);
    assignForm.resetFields();
  }, [assignForm, isAssigning]);

  const handleAssign = useCallback(async () => {
    if (!selectedClass) {
      return;
    }

    const values = await assignForm.validateFields();

    setIsAssigning(true);

    try {
      const result = await assignClassAdviserByStaffId({
        classId: selectedClass.classId,
        remarks: values.remarks,
        staffId: resolveAssignableClassAdviserStaffId(values.staffId, staffDirectoryTeachers),
        staffName: values.staffName,
      });

      setAssignResult(result);
      message.success(result.changed ? '已指定班主任。' : '当前任职事实已满足。');
      setSelectedClass(null);
      assignForm.resetFields();
      await refreshCurrentList();
    } catch (error) {
      message.error(resolveClassAdviserGovernanceErrorMessage(error, '暂时无法指定班主任。'));
      await refreshCurrentList();
    } finally {
      setIsAssigning(false);
    }
  }, [assignForm, message, refreshCurrentList, selectedClass, staffDirectoryTeachers]);

  const columns = useMemo(
    () =>
      buildColumns({
        departmentLabelById,
        isAssigning,
        onOpenAssign: handleOpenAssign,
      }),
    [departmentLabelById, handleOpenAssign, isAssigning],
  );

  useEffect(() => {
    void loadDepartments();
  }, [loadDepartments]);

  useEffect(() => {
    if (
      !isAssignModalOpen ||
      isLoadingStaffDirectory ||
      (staffDirectoryResult && (staffDirectoryResult.cacheStatus !== 'MISS' || !upstreamSession))
    ) {
      return;
    }

    void loadStaffDirectory();
  }, [
    isAssignModalOpen,
    isLoadingStaffDirectory,
    loadStaffDirectory,
    staffDirectoryResult,
    upstreamSession,
    upstreamSessionKey,
  ]);

  useEffect(() => {
    void loadClasses({
      departmentId: initialDepartmentId,
      onlyMissing: false,
    });
  }, [initialDepartmentId, loadClasses]);

  const gradeYearOptions = useMemo(() => buildGradeYearFilterOptions(classes), [classes]);
  const visibleClasses = useMemo(
    () =>
      classes
        .filter((item) =>
          typeof selectedGradeYear === 'number' ? item.gradeYear === selectedGradeYear : true,
        )
        .sort(compareClassesByGradeDesc),
    [classes, selectedGradeYear],
  );
  const missingCount = visibleClasses.filter((item) => item.canAssign).length;
  const configuredCount = visibleClasses.length - missingCount;

  return (
    <div className="flex flex-col gap-6">
      <DecoratedPageHeader
        description="补齐本地已从校园网同步学生归属班级的班主任任职事实"
        icon={<TeamOutlined />}
        title="班主任任职"
      />

      <Card title="筛选条件">
        <div className="flex flex-col gap-4">
          {listError ? <Alert showIcon type="error" title={listError} /> : null}
          {departmentOptionsError ? (
            <Alert showIcon type="warning" title={departmentOptionsError} />
          ) : null}

          <Form<FilterFormValues>
            form={filterForm}
            initialValues={{
              departmentId: initialDepartmentId,
              onlyMissing: false,
            }}
            layout="vertical"
            requiredMark={false}
            onFinish={(values) => {
              void loadClasses(values);
            }}
          >
            <ResponsiveGrid
              className="gap-4"
              columns={{ compact: 1, regular: 2, large: 4, wide: 4 }}
            >
              <DepartmentFormItem
                disabled={isLoadingDepartments || isLoading || !canSelectDepartment}
                emptyText="当前没有可选系部"
                label="系部"
                loading={isLoadingDepartments}
                name="departmentId"
                options={departmentOptions}
                placeholder={canSelectDepartment ? '选择系部，清空可查全院' : '当前账号归口系'}
                selectProps={{
                  allowClear: canSelectDepartment,
                }}
                validateStatus={departmentOptionsError ? 'warning' : undefined}
              />

              <Form.Item
                label="关键词"
                name="keyword"
                rules={[{ max: 100, message: '关键词不能超过 100 个字符' }]}
              >
                <Input
                  allowClear
                  placeholder="匹配班级、班主任工号或班主任姓名"
                  prefix={<SearchOutlined />}
                />
              </Form.Item>

              <Form.Item label="年级" name="gradeYear">
                <Select
                  allowClear
                  disabled={classes.length === 0}
                  options={gradeYearOptions}
                  placeholder="按年级筛选"
                />
              </Form.Item>

              <Form.Item label="只看缺失" name="onlyMissing" valuePropName="checked">
                <Switch />
              </Form.Item>
            </ResponsiveGrid>

            <div className="flex flex-wrap gap-3">
              <Button
                htmlType="submit"
                icon={<SearchOutlined />}
                loading={isLoading}
                type="primary"
              >
                查询
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  void refreshCurrentList();
                }}
              >
                刷新
              </Button>
              <Button
                onClick={() => {
                  filterForm.resetFields();
                  void loadClasses({
                    departmentId: initialDepartmentId,
                    onlyMissing: false,
                  });
                }}
              >
                重置
              </Button>
            </div>
          </Form>
        </div>
      </Card>

      <Card title="班级列表">
        <div className="flex flex-col gap-4">
          <Descriptions bordered column={{ md: 3, sm: 1, xs: 1 }} size="small">
            <Descriptions.Item label="班级数">{visibleClasses.length}</Descriptions.Item>
            <Descriptions.Item label="缺失班主任">{missingCount}</Descriptions.Item>
            <Descriptions.Item label="已配置">{configuredCount}</Descriptions.Item>
          </Descriptions>

          <Table<ClassAdviserGovernanceClass>
            columns={columns}
            dataSource={visibleClasses}
            loading={isLoading}
            locale={{
              emptyText: <Empty description="暂无班主任任职班级" />,
            }}
            pagination={{
              defaultPageSize: 30,
              pageSizeOptions: [30, 60],
              showSizeChanger: true,
            }}
            rowKey="classId"
            scroll={{ x: 1260 }}
            size="middle"
          />
        </div>
      </Card>

      <Modal
        confirmLoading={isAssigning}
        okText="确认指定"
        open={isAssignModalOpen}
        title="指定班主任"
        onCancel={handleCloseAssign}
        onOk={() => {
          void handleAssign();
        }}
      >
        {selectedClass ? (
          <div className="flex flex-col gap-4">
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="班级名称">{selectedClass.className}</Descriptions.Item>
              <Descriptions.Item label="班级 code">{selectedClass.classCode}</Descriptions.Item>
            </Descriptions>

            <Form<AssignFormValues> form={assignForm} layout="vertical" requiredMark={false}>
              {staffDirectoryError ? (
                <Alert showIcon type="warning" title={staffDirectoryError} />
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <Tag color={staffDirectoryTeachers.length > 0 ? 'green' : 'blue'}>
                  教师目录：
                  {staffDirectoryResult
                    ? `${staffDirectoryResult.cacheStatus} / ${staffDirectoryResult.teacherCount} 人`
                    : '待读取'}
                </Tag>
                {staffDirectoryResult?.cacheExpiresAt ? (
                  <Tag>缓存过期：{formatDateTime(staffDirectoryResult.cacheExpiresAt)}</Tag>
                ) : null}
                <Button
                  icon={upstreamSession ? <ReloadOutlined /> : <LoginOutlined />}
                  loading={isLoadingStaffDirectory || upstreamLoginModalProps.isSubmitting}
                  size="small"
                  type={upstreamSession ? 'default' : 'primary'}
                  onClick={() => {
                    if (!upstreamSession) {
                      openLoginModal();
                      return;
                    }

                    void loadStaffDirectory({
                      forceRefresh: true,
                      session: upstreamSession,
                    });
                  }}
                >
                  {upstreamSession ? '刷新教师目录' : '登录后刷新'}
                </Button>
              </div>

              <Form.Item
                label="教职工 ID"
                name="staffId"
                rules={[
                  {
                    validator: (_rule, value: string | undefined) =>
                      validateClassAdviserGovernanceStaffId(value, staffDirectoryTeachers),
                  },
                ]}
              >
                <StaffDirectoryTeacherAutoComplete
                  autoFocus
                  directoryUnavailableContent={
                    staffDirectoryError ? '目录不可用，可直接输入 staffId' : '可直接输入 staffId'
                  }
                  loading={isLoadingStaffDirectory}
                  placeholder="搜索教师姓名或 staffId"
                  teachers={staffDirectoryTeachers}
                  onChange={(value) => {
                    assignForm.setFieldsValue({
                      staffName: resolveClassAdviserGovernanceStaffName(
                        value,
                        staffDirectoryTeachers,
                      ),
                    });
                  }}
                />
              </Form.Item>

              <Form.Item
                extra="本地 member_staff 尚未建立时，后端会保存该姓名快照。"
                label="班主任姓名"
                name="staffName"
                rules={[
                  { required: true, message: '请输入班主任姓名' },
                  { max: 100, message: '班主任姓名不能超过 100 个字符' },
                ]}
              >
                <Input allowClear placeholder="选择教师后自动填充，也可手动输入" />
              </Form.Item>

              <Form.Item
                label="备注"
                name="remarks"
                rules={[{ max: 500, message: '备注不能超过 500 个字符' }]}
              >
                <Input.TextArea
                  allowClear
                  autoSize={{ maxRows: 5, minRows: 3 }}
                  placeholder="可选"
                  showCount
                  maxLength={500}
                />
              </Form.Item>
            </Form>
          </div>
        ) : null}
      </Modal>

      {assignResult ? (
        <Card title="最近一次指派结果">
          <Descriptions bordered column={{ md: 3, sm: 1, xs: 1 }} size="small">
            <Descriptions.Item label="结果">
              {assignResult.changed ? (
                <Tag color="green" icon={<CheckCircleOutlined />}>
                  已写入
                </Tag>
              ) : (
                <Tag>已满足</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="班级">{assignResult.className}</Descriptions.Item>
            <Descriptions.Item label="staffId">{assignResult.staffId}</Descriptions.Item>
            <Descriptions.Item label="姓名">
              {formatOptionalValue(assignResult.staffName)}
            </Descriptions.Item>
            <Descriptions.Item label="本地 staff">
              {renderLocalStaffTag(assignResult.hasLocalStaff)}
            </Descriptions.Item>
            <Descriptions.Item label="binding">
              {renderBindingStatus(assignResult)}
            </Descriptions.Item>
            <Descriptions.Item label="postId">
              {formatOptionalValue(assignResult.postId)}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      ) : null}

      <UpstreamLoginModal
        {...upstreamLoginModalProps}
        description="刷新教师目录需要 upstream session；登录后将通过 Staff Directory Cache 更新教师 staffId 与姓名。"
        title="登录 upstream"
      />
    </div>
  );
}
