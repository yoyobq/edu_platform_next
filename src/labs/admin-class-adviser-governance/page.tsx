// src/labs/admin-class-adviser-governance/page.tsx

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
  AutoComplete,
  Button,
  Card,
  Descriptions,
  Empty,
  Form,
  Input,
  Modal,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useLoaderData } from 'react-router';

import {
  buildDepartmentSelectOptions,
  DepartmentFormItem,
  type DepartmentSelectOption,
} from '@/entities/department';
import {
  isExpiredUpstreamSessionError,
  resolveUpstreamErrorMessage,
  type StoredUpstreamSession,
  type UpstreamAccountIdentity,
  UpstreamLoginModal,
  useUpstreamLoginModalController,
} from '@/entities/upstream-session';

import { DecoratedPageHeader } from '@/shared/ui/decorated-page-header';
import { ResponsiveGrid } from '@/shared/ui/responsive-layout';

import {
  assignClassAdviserByStaffId,
  type AssignClassAdviserByStaffIdResult,
  type ClassAdviserGovernanceActiveAdviser,
  type ClassAdviserGovernanceClass,
  fetchTeacherDirectory,
  listClassAdviserGovernanceClasses,
  listLocalDepartmentOptions,
  resolveClassAdviserGovernanceErrorMessage,
  type TeacherDirectoryResult,
} from './api';
import { adminClassAdviserGovernanceLabMeta } from './meta';

type AdminClassAdviserGovernanceLabLoaderData = {
  currentAccount: UpstreamAccountIdentity;
};

type FilterFormValues = {
  departmentId?: string;
  keyword?: string;
  onlyMissing?: boolean;
};

type AssignFormValues = {
  remarks?: string;
  staffId: string;
  staffName?: string;
};

type TeacherSearchOption = {
  label: string;
  name: string;
  staffId: string;
  value: string;
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
      render: (departmentId: string, record) => {
        const departmentLabel = input.departmentLabelById.get(departmentId);

        return (
          <div className="flex flex-col gap-1">
            <span>{departmentLabel ?? departmentId}</span>
            <span className="text-xs text-text-secondary">
              年级：{formatOptionalValue(record.gradeYear)}
            </span>
          </div>
        );
      },
      title: '系部',
      width: 160,
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
      render: (lastObservedAt: string | null) => formatDateTime(lastObservedAt),
      title: '最近观测',
      width: 180,
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

function removeStaffIdFromTeacherName(value: string, staffId: string) {
  const normalizedValue = value.trim();
  const normalizedStaffId = staffId.trim();

  if (!normalizedValue || !normalizedStaffId) {
    return normalizedValue;
  }

  if (normalizedValue === normalizedStaffId) {
    return '';
  }

  if (!normalizedValue.startsWith(normalizedStaffId)) {
    return normalizedValue;
  }

  return normalizedValue
    .slice(normalizedStaffId.length)
    .replace(/^[\s:：\-()（）]+/, '')
    .trim();
}

function buildTeacherSearchOptions(result: TeacherDirectoryResult): TeacherSearchOption[] {
  return result.teachers
    .map((teacher) => {
      const staffId = teacher.code.trim() || teacher.value.trim();
      const label = teacher.text.trim() || teacher.name.trim() || staffId;
      const rawName = teacher.name.trim() || teacher.text.trim();
      const name = removeStaffIdFromTeacherName(rawName, staffId);

      if (!staffId || !label) {
        return null;
      }

      return {
        label,
        name,
        staffId,
        value: label,
      };
    })
    .filter((teacher): teacher is TeacherSearchOption => teacher !== null);
}

function resolveTeacherStaffIdFromValue(
  value: string | undefined,
  options: readonly TeacherSearchOption[],
) {
  const normalizedValue = value?.trim() ?? '';

  if (!normalizedValue) {
    return '';
  }

  const matchedOption = options.find(
    (option) =>
      option.staffId === normalizedValue ||
      option.value === normalizedValue ||
      option.label === normalizedValue ||
      option.name === normalizedValue,
  );

  if (matchedOption) {
    return matchedOption.staffId;
  }

  return normalizedValue.split(/\s+/)[0] ?? '';
}

function resolveTeacherNameFromValue(
  value: string | undefined,
  options: readonly TeacherSearchOption[],
) {
  const normalizedValue = value?.trim() ?? '';

  if (!normalizedValue) {
    return '';
  }

  const matchedOption = options.find(
    (option) =>
      option.staffId === normalizedValue ||
      option.value === normalizedValue ||
      option.label === normalizedValue ||
      option.name === normalizedValue,
  );

  if (matchedOption) {
    return (
      matchedOption.name || removeStaffIdFromTeacherName(matchedOption.label, matchedOption.staffId)
    );
  }

  return removeStaffIdFromTeacherName(
    normalizedValue,
    resolveTeacherStaffIdFromValue(value, options),
  );
}

function validateStaffIdInput(value: string | undefined, options: readonly TeacherSearchOption[]) {
  const staffId = resolveTeacherStaffIdFromValue(value, options);

  if (!staffId) {
    return Promise.reject(new Error('请输入教职工 ID'));
  }

  if (staffId.length > 8) {
    return Promise.reject(new Error('教职工 ID 不能超过 8 个字符'));
  }

  if (/\s/.test(staffId) || staffId.includes("'")) {
    return Promise.reject(new Error('教职工 ID 不能包含空白或单引号'));
  }

  return Promise.resolve();
}

function filterTeacherOption(inputValue: string, option?: TeacherSearchOption) {
  const keyword = inputValue.trim().toLowerCase();

  if (!keyword || !option) {
    return true;
  }

  return (
    option.staffId.toLowerCase().includes(keyword) ||
    option.name.toLowerCase().includes(keyword) ||
    option.label.toLowerCase().includes(keyword)
  );
}

export function AdminClassAdviserGovernanceLabPage() {
  const loaderData = useLoaderData() as AdminClassAdviserGovernanceLabLoaderData | null;
  const currentAccount = loaderData?.currentAccount ?? null;
  const { message } = AntApp.useApp();
  const [filterForm] = Form.useForm<FilterFormValues>();
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
  const [teacherDirectoryResult, setTeacherDirectoryResult] =
    useState<TeacherDirectoryResult | null>(null);
  const [teacherDirectoryError, setTeacherDirectoryError] = useState<string | null>(null);
  const [isLoadingTeacherDirectory, setIsLoadingTeacherDirectory] = useState(false);
  const teacherOptions = useMemo(
    () => (teacherDirectoryResult ? buildTeacherSearchOptions(teacherDirectoryResult) : []),
    [teacherDirectoryResult],
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
    resolveLoginErrorMessage: (error) =>
      resolveUpstreamErrorMessage(error, '暂时无法登录 upstream。'),
  });

  const loadClasses = useCallback(async (values: FilterFormValues) => {
    setIsLoading(true);
    setListError(null);

    try {
      const nextClasses = await listClassAdviserGovernanceClasses({
        departmentId: values.departmentId,
        keyword: values.keyword,
        onlyMissing: values.onlyMissing,
      });

      setClasses(nextClasses);
    } catch (error) {
      setClasses([]);
      setListError(
        resolveClassAdviserGovernanceErrorMessage(error, '暂时无法加载班主任治理列表。'),
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadDepartments = useCallback(async () => {
    setIsLoadingDepartments(true);
    setDepartmentOptionsError(null);

    try {
      const departments = await listLocalDepartmentOptions();

      setDepartmentOptions(buildDepartmentSelectOptions(departments));
    } catch (error) {
      setDepartmentOptions([]);
      setDepartmentOptionsError(
        resolveClassAdviserGovernanceErrorMessage(error, '暂时无法加载系部列表。'),
      );
    } finally {
      setIsLoadingDepartments(false);
    }
  }, []);

  const loadTeacherDirectory = useCallback(
    async (session: StoredUpstreamSession) => {
      setIsLoadingTeacherDirectory(true);
      setTeacherDirectoryError(null);

      try {
        const result = await fetchTeacherDirectory({
          upstreamSessionToken: session.upstreamSessionToken,
        });

        setTeacherDirectoryResult(result);
        persistSessionFromResult(session, result);
      } catch (error) {
        const errorMessage = resolveUpstreamErrorMessage(error, '暂时无法读取教师目录。');

        setTeacherDirectoryError(errorMessage);

        if (isExpiredUpstreamSessionError(error)) {
          openLoginModalForExpiredSession({
            loginError: errorMessage,
            session,
          });
        }
      } finally {
        setIsLoadingTeacherDirectory(false);
      }
    },
    [openLoginModalForExpiredSession, persistSessionFromResult],
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
        staffId: resolveTeacherStaffIdFromValue(values.staffId, teacherOptions),
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
  }, [assignForm, message, refreshCurrentList, selectedClass, teacherOptions]);

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
    if (!isAssignModalOpen || !upstreamSession || teacherOptions.length > 0) {
      return;
    }

    void loadTeacherDirectory(upstreamSession);
  }, [isAssignModalOpen, loadTeacherDirectory, teacherOptions.length, upstreamSession]);

  useEffect(() => {
    void loadClasses({
      onlyMissing: false,
    });
  }, [loadClasses]);

  const missingCount = classes.filter((item) => item.canAssign).length;
  const configuredCount = classes.length - missingCount;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-6">
      <DecoratedPageHeader
        badge={<Tag>{adminClassAdviserGovernanceLabMeta.name}</Tag>}
        description="补齐本地已同步学生归属班级的班主任任职事实。"
        icon={<TeamOutlined />}
        title="班主任治理"
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
              onlyMissing: false,
            }}
            layout="vertical"
            requiredMark={false}
            onFinish={(values) => {
              void loadClasses(values);
            }}
          >
            <ResponsiveGrid className="gap-4" columns={{ compact: 1, regular: 2, wide: 3 }}>
              <DepartmentFormItem
                disabled={isLoadingDepartments || isLoading}
                emptyText="当前没有可选系部"
                help="不选择时查询全部系部。"
                label="系部"
                loading={isLoadingDepartments}
                name="departmentId"
                options={departmentOptions}
                placeholder="选择系部"
                selectProps={{
                  allowClear: true,
                }}
                validateStatus={departmentOptionsError ? 'warning' : undefined}
              />

              <Form.Item
                extra="匹配班级、班主任 staffId 或本地 staff 姓名。"
                label="关键词"
                name="keyword"
                rules={[{ max: 100, message: '关键词不能超过 100 个字符' }]}
              >
                <Input allowClear placeholder="输入班级或教职工信息" prefix={<SearchOutlined />} />
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
            <Descriptions.Item label="班级数">{classes.length}</Descriptions.Item>
            <Descriptions.Item label="缺失班主任">{missingCount}</Descriptions.Item>
            <Descriptions.Item label="已配置">{configuredCount}</Descriptions.Item>
          </Descriptions>

          <Table<ClassAdviserGovernanceClass>
            columns={columns}
            dataSource={classes}
            loading={isLoading}
            locale={{
              emptyText: <Empty description="暂无可治理班级" />,
            }}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
            }}
            rowKey="classId"
            scroll={{ x: 1250 }}
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
              {teacherDirectoryError ? (
                <Alert showIcon type="warning" title={teacherDirectoryError} />
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                {upstreamSession ? (
                  <>
                    <Tag color={teacherOptions.length > 0 ? 'green' : 'blue'}>
                      教师目录：
                      {teacherOptions.length > 0 ? `${teacherOptions.length} 人` : '待读取'}
                    </Tag>
                    {teacherDirectoryResult?.expiresAt ? (
                      <Tag>过期：{formatDateTime(teacherDirectoryResult.expiresAt)}</Tag>
                    ) : null}
                    <Button
                      icon={<ReloadOutlined />}
                      loading={isLoadingTeacherDirectory}
                      size="small"
                      onClick={() => {
                        void loadTeacherDirectory(upstreamSession);
                      }}
                    >
                      刷新教师目录
                    </Button>
                  </>
                ) : (
                  <>
                    <Tag>教师目录未读取</Tag>
                    <Button
                      icon={<LoginOutlined />}
                      loading={upstreamLoginModalProps.isSubmitting}
                      size="small"
                      type="primary"
                      onClick={() => {
                        openLoginModal();
                      }}
                    >
                      登录 upstream 后读取
                    </Button>
                  </>
                )}
              </div>

              <Form.Item
                label="教职工 ID"
                name="staffId"
                rules={[
                  {
                    validator: (_rule, value: string | undefined) =>
                      validateStaffIdInput(value, teacherOptions),
                  },
                ]}
              >
                <AutoComplete
                  allowClear
                  autoFocus
                  filterOption={(inputValue, option) =>
                    filterTeacherOption(inputValue, option as TeacherSearchOption | undefined)
                  }
                  loading={isLoadingTeacherDirectory}
                  notFoundContent={
                    isLoadingTeacherDirectory ? '读取中' : '暂无教师目录，可直接输入 staffId'
                  }
                  options={teacherOptions}
                  placeholder="搜索教师姓名或 staffId"
                  onChange={(value) => {
                    assignForm.setFieldsValue({
                      staffName: resolveTeacherNameFromValue(value, teacherOptions),
                    });
                  }}
                  onSelect={(value) => {
                    assignForm.setFieldsValue({
                      staffName: resolveTeacherNameFromValue(value, teacherOptions),
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
        description="读取教师目录需要 upstream session；登录后将通过 fetchTeacherDirectory 获取教师 staffId 与姓名。"
        title="登录 upstream"
      />
    </div>
  );
}
