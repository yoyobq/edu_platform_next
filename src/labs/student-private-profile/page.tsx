// src/labs/student-private-profile/page.tsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircleOutlined,
  ClearOutlined,
  CloudSyncOutlined,
  EditOutlined,
  FileSearchOutlined,
  LoginOutlined,
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
  Radio,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useLoaderData } from 'react-router';

import {
  formatUpstreamSessionDateTime,
  type StoredUpstreamSession,
  type UpstreamAccountIdentity,
  UpstreamLoginModal,
  useUpstreamLoginModalController,
} from '@/entities/upstream-session';

import { ResponsiveGrid } from '@/shared/ui/responsive-layout';

import {
  compareStudentPrivateProfileFields,
  getStudentPrivateProfileSummary,
  isExpiredUpstreamSessionError,
  listStudentPrivateProfileClassOptions,
  listStudentPrivateProfileClassStudentOptions,
  normalizeStudentPrivateProfileStudentId,
  patchStudentPrivateProfileFields,
  refreshStudentPrivateProfileFromUpstream,
  resolveUpstreamErrorMessage,
  type StudentPrivateProfileClassOption,
  type StudentPrivateProfileCompareField,
  type StudentPrivateProfileCompareResult,
  type StudentPrivateProfileManualPatchAction,
  type StudentPrivateProfileManualPatchField,
  type StudentPrivateProfileRefreshResult,
  type StudentPrivateProfileStudentOption,
  type StudentPrivateProfileSummary,
  type StudentPrivateProfileSummaryField,
} from './api';
import { studentPrivateProfileLabMeta } from './meta';

type StudentPrivateProfileLabLoaderData = {
  currentAccount: UpstreamAccountIdentity;
  lockedUpstreamLoginUserId: string | null;
  manualPatchAccess: StudentPrivateProfileManualPatchAccess;
};

type RefreshPendingAction = {
  studentId: string;
  type: 'refresh';
};

type StudentPrivateProfileManualPatchAccess = {
  contactAndAddress: boolean;
  sensitiveIdentifiers: boolean;
};

const EMPTY_MANUAL_PATCH_ACCESS: StudentPrivateProfileManualPatchAccess = {
  contactAndAddress: false,
  sensitiveIdentifiers: false,
};

type CompareFormValues = {
  candidateValue?: string;
  fieldKey?: StudentPrivateProfileCompareField;
};

type PatchFormValues = {
  action?: StudentPrivateProfileManualPatchAction;
  fieldKey?: StudentPrivateProfileManualPatchField;
  value?: string;
};

const COMPARE_FIELD_OPTIONS: {
  label: string;
  value: StudentPrivateProfileCompareField;
}[] = [
  { label: '身份证号', value: 'ID_CARD' },
  { label: '银行卡号', value: 'BANK_CARD_NUMBER' },
  { label: '校园卡号', value: 'CARD_NUMBER' },
  { label: '学生手机号', value: 'STUDENT_PHONE' },
  { label: '联系人手机号', value: 'CONTACT_PERSON_PHONE' },
];

const PATCH_FIELD_OPTIONS: {
  label: string;
  value: StudentPrivateProfileManualPatchField;
}[] = [
  ...COMPARE_FIELD_OPTIONS,
  { label: '家庭地址', value: 'HOME_ADDRESS' },
  { label: '通讯地址', value: 'MAILING_ADDRESS' },
];

const SENSITIVE_IDENTIFIER_PATCH_FIELDS = new Set<StudentPrivateProfileManualPatchField>([
  'ID_CARD',
  'BANK_CARD_NUMBER',
  'CARD_NUMBER',
]);

const CONTACT_AND_ADDRESS_PATCH_FIELDS = new Set<StudentPrivateProfileManualPatchField>([
  'STUDENT_PHONE',
  'CONTACT_PERSON_PHONE',
  'HOME_ADDRESS',
  'MAILING_ADDRESS',
]);

const PROFILE_COMPLETENESS_ITEMS: {
  key: keyof StudentPrivateProfileSummary['profileCompletenessFlags'];
  label: string;
}[] = [
  { key: 'personalObserved', label: '个人信息' },
  { key: 'sensitiveIdentifiersObserved', label: '敏感证件' },
  { key: 'photoObserved', label: '照片' },
  { key: 'familyObserved', label: '家庭情况' },
  { key: 'educationObserved', label: '学籍/教育' },
  { key: 'recordObserved', label: '记录/毕业/获奖' },
];

const FIELD_LABELS = new Map<string, string>(
  PATCH_FIELD_OPTIONS.map((item) => [item.value, item.label]),
);

const FIELD_ORDER = new Map(PATCH_FIELD_OPTIONS.map((item, index) => [item.value, index]));

function formatClassOption(option: StudentPrivateProfileClassOption) {
  return `${option.className} · ${option.studentCount}人`;
}

function formatStudentOption(option: StudentPrivateProfileStudentOption) {
  const studentLabel = option.studentName
    ? `${option.studentName} (${option.studentId})`
    : option.studentId;
  const upstreamStatus = option.upstreamIdPresent ? null : '缺 upstream ID';

  return [studentLabel, option.studentStatus, upstreamStatus].filter(Boolean).join(' · ');
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return '未记录';
  }

  return formatUpstreamSessionDateTime(value);
}

function displayText(value: string | null | undefined) {
  return value?.trim() || '未记录';
}

function formatApproxByteSize(byteSize: number) {
  if (!Number.isFinite(byteSize) || byteSize <= 0) {
    return '约 0 KB';
  }

  return `约 ${Math.round(byteSize / 1024).toLocaleString('zh-CN')} KB`;
}

function formatObservedStatus(value: boolean) {
  return value ? '已观察' : '未观察';
}

function formatUpstreamPhotoStatus(photo: StudentPrivateProfileSummary['photo']) {
  if (!photo.present) {
    return '上游照片：未观察';
  }

  return `上游照片：已观察，${formatApproxByteSize(photo.byteSize)}`;
}

function resolveFieldLabel(fieldKey: string) {
  return FIELD_LABELS.get(fieldKey) ?? fieldKey;
}

function resolveCompareResultColor(
  result: StudentPrivateProfileCompareResult['results'][number]['result'],
) {
  if (result === 'MATCH') {
    return 'success';
  }

  if (result === 'MISMATCH') {
    return 'error';
  }

  return 'warning';
}

function resolveSourceColor(source: string) {
  if (source === 'MANUAL') {
    return 'processing';
  }

  if (source === 'UPSTREAM') {
    return 'success';
  }

  return 'default';
}

function resolveStatusColor(status: string) {
  if (status === 'PRESENT' || status === 'OBSERVED') {
    return 'success';
  }

  if (status === 'MISSING') {
    return 'warning';
  }

  return 'default';
}

function sortSummaryFields(fields: StudentPrivateProfileSummaryField[]) {
  return [...fields].sort((left, right) => {
    const leftOrder =
      FIELD_ORDER.get(left.fieldKey as StudentPrivateProfileManualPatchField) ?? 999;
    const rightOrder =
      FIELD_ORDER.get(right.fieldKey as StudentPrivateProfileManualPatchField) ?? 999;

    return leftOrder - rightOrder || left.fieldKey.localeCompare(right.fieldKey);
  });
}

function canPatchStudentPrivateProfileField(
  fieldKey: string,
  access: StudentPrivateProfileManualPatchAccess,
) {
  const patchFieldKey = fieldKey as StudentPrivateProfileManualPatchField;

  if (SENSITIVE_IDENTIFIER_PATCH_FIELDS.has(patchFieldKey)) {
    return access.sensitiveIdentifiers;
  }

  if (CONTACT_AND_ADDRESS_PATCH_FIELDS.has(patchFieldKey)) {
    return access.contactAndAddress;
  }

  return false;
}

export function StudentPrivateProfileLabPage() {
  const loaderData = useLoaderData() as StudentPrivateProfileLabLoaderData | null;
  const currentAccount = loaderData?.currentAccount ?? null;
  const lockedUpstreamLoginUserId = loaderData?.lockedUpstreamLoginUserId ?? null;
  const manualPatchAccess = loaderData?.manualPatchAccess ?? EMPTY_MANUAL_PATCH_ACCESS;
  const { message } = AntApp.useApp();
  const [studentForm] = Form.useForm<{ studentId: string }>();
  const [compareForm] = Form.useForm<CompareFormValues>();
  const [patchForm] = Form.useForm<PatchFormValues>();
  const [summary, setSummary] = useState<StudentPrivateProfileSummary | null>(null);
  const [compareResult, setCompareResult] = useState<StudentPrivateProfileCompareResult | null>(
    null,
  );
  const [refreshResult, setRefreshResult] = useState<StudentPrivateProfileRefreshResult | null>(
    null,
  );
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [isPatching, setIsPatching] = useState(false);
  const [classes, setClasses] = useState<StudentPrivateProfileClassOption[]>([]);
  const [students, setStudents] = useState<StudentPrivateProfileStudentOption[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [classOptionsError, setClassOptionsError] = useState<string | null>(null);
  const [studentOptionsError, setStudentOptionsError] = useState<string | null>(null);
  const [loginRefreshRequest, setLoginRefreshRequest] = useState<{
    session: StoredUpstreamSession;
    studentId: string;
  } | null>(null);

  const currentStudentId = Form.useWatch('studentId', studentForm);
  const patchAction = Form.useWatch('action', patchForm);

  const summaryFields = useMemo(() => sortSummaryFields(summary?.fields ?? []), [summary]);
  const summaryFieldByKey = useMemo(
    () => new Map(summaryFields.map((field) => [field.fieldKey, field])),
    [summaryFields],
  );
  const patchFieldOptions = useMemo(
    () =>
      PATCH_FIELD_OPTIONS.filter((option) =>
        canPatchStudentPrivateProfileField(option.value, manualPatchAccess),
      ),
    [manualPatchAccess],
  );
  const classSelectOptions = useMemo(
    () =>
      classes.map((option) => ({
        label: formatClassOption(option),
        value: option.id,
      })),
    [classes],
  );
  const studentSelectOptions = useMemo(
    () =>
      students.map((option) => ({
        label: formatStudentOption(option),
        value: option.studentId,
      })),
    [students],
  );

  const loadClasses = useCallback(async () => {
    setIsLoadingClasses(true);
    setClassOptionsError(null);

    try {
      const nextClasses = await listStudentPrivateProfileClassOptions();

      setClasses(nextClasses);
    } catch (error) {
      const errorMessage = resolveUpstreamErrorMessage(error, '暂时无法加载本地班级列表。');

      setClassOptionsError(errorMessage);
      message.error(errorMessage);
    } finally {
      setIsLoadingClasses(false);
    }
  }, [message]);

  const loadStudentsForClass = useCallback(async (classId: string) => {
    setIsLoadingStudents(true);
    setStudentOptionsError(null);
    setStudents([]);

    try {
      const nextStudents = await listStudentPrivateProfileClassStudentOptions({ classId });

      setStudents(nextStudents);

      if (nextStudents.length === 0) {
        setStudentOptionsError('该班级暂未返回 active 学生归属，仍可直接输入本地学生 ID。');
      }
    } catch (error) {
      setStudentOptionsError(
        resolveUpstreamErrorMessage(error, '暂时无法加载班级学生列表，仍可直接输入本地学生 ID。'),
      );
    } finally {
      setIsLoadingStudents(false);
    }
  }, []);

  useEffect(() => {
    if (!currentAccount) {
      return;
    }

    void loadClasses();
  }, [currentAccount, loadClasses]);

  useEffect(() => {
    const currentFieldKey = patchForm.getFieldValue('fieldKey') as
      | StudentPrivateProfileManualPatchField
      | undefined;

    if (currentFieldKey && patchFieldOptions.some((option) => option.value === currentFieldKey)) {
      return;
    }

    patchForm.setFieldValue('fieldKey', patchFieldOptions[0]?.value);
  }, [patchFieldOptions, patchForm]);

  const loadSummary = useCallback(
    async (studentIdValue: string | null | undefined) => {
      const studentId = normalizeStudentPrivateProfileStudentId(studentIdValue);

      setIsLoadingSummary(true);
      setCompareResult(null);
      setRefreshResult(null);

      try {
        const nextSummary = await getStudentPrivateProfileSummary({ studentId });

        setSummary(nextSummary);
        studentForm.setFieldValue('studentId', nextSummary.studentId);
      } catch (error) {
        message.error(resolveUpstreamErrorMessage(error, '暂时无法读取学生个人资料摘要。'));
      } finally {
        setIsLoadingSummary(false);
      }
    },
    [message, studentForm],
  );

  const {
    clearSession,
    modalProps: upstreamLoginModalProps,
    openLoginModal,
    openLoginModalForExpiredSession,
    persistSessionFromResult,
    refreshSession,
    session: upstreamSession,
  } = useUpstreamLoginModalController<RefreshPendingAction>({
    account: currentAccount,
    keepAlive: true,
    lockedUserId: lockedUpstreamLoginUserId,
    resolveLoginErrorMessage: (error) =>
      resolveUpstreamErrorMessage(error, 'upstream 登录失败，请检查账号或密码。'),
    onLoginSuccess: ({ pendingAction, session }) => {
      if (pendingAction?.type === 'refresh') {
        setLoginRefreshRequest({
          session,
          studentId: pendingAction.studentId,
        });
      }
    },
  });

  const runRefreshWithSession = useCallback(
    async (session: StoredUpstreamSession, studentId: string) => {
      setIsRefreshing(true);

      try {
        const result = await refreshStudentPrivateProfileFromUpstream({
          studentId,
          upstreamSessionToken: session.upstreamSessionToken,
        });

        persistSessionFromResult(session, result);
        setRefreshResult(result);
        await loadSummary(studentId);
        message.success('已刷新 upstream 并重新读取本地摘要。');
      } catch (error) {
        if (!isExpiredUpstreamSessionError(error)) {
          message.error(resolveUpstreamErrorMessage(error, '暂时无法刷新学生个人资料。'));
          return;
        }

        try {
          const refreshedSession = await refreshSession(session);
          const result = await refreshStudentPrivateProfileFromUpstream({
            studentId,
            upstreamSessionToken: refreshedSession.upstreamSessionToken,
          });

          persistSessionFromResult(refreshedSession, result);
          setRefreshResult(result);
          await loadSummary(studentId);
          message.success('upstream 会话已续期，资料刷新完成。');
        } catch (refreshError) {
          openLoginModalForExpiredSession({
            loginError: resolveUpstreamErrorMessage(
              refreshError,
              'upstream 会话已失效，请重新登录后继续刷新。',
            ),
            pendingAction: {
              studentId,
              type: 'refresh',
            },
            session,
          });
        }
      } finally {
        setIsRefreshing(false);
      }
    },
    [
      loadSummary,
      message,
      openLoginModalForExpiredSession,
      persistSessionFromResult,
      refreshSession,
    ],
  );

  useEffect(() => {
    if (!loginRefreshRequest) {
      return;
    }

    setLoginRefreshRequest(null);
    void runRefreshWithSession(loginRefreshRequest.session, loginRefreshRequest.studentId);
  }, [loginRefreshRequest, runRefreshWithSession]);

  const handleLoadSummary = useCallback(async () => {
    await loadSummary(currentStudentId);
  }, [currentStudentId, loadSummary]);

  const handleClassChange = useCallback(
    (classId: string | null) => {
      setSelectedClassId(classId);
      setStudents([]);
      setStudentOptionsError(null);

      if (!classId) {
        return;
      }

      void loadStudentsForClass(classId);
    },
    [loadStudentsForClass],
  );

  const handleStudentOptionChange = useCallback(
    (studentId: string | null) => {
      studentForm.setFieldValue('studentId', studentId ?? '');
    },
    [studentForm],
  );

  const handleRefresh = useCallback(async () => {
    const studentId = normalizeStudentPrivateProfileStudentId(currentStudentId);

    if (!upstreamSession) {
      openLoginModal({
        pendingAction: {
          studentId,
          type: 'refresh',
        },
      });
      return;
    }

    await runRefreshWithSession(upstreamSession, studentId);
  }, [currentStudentId, openLoginModal, runRefreshWithSession, upstreamSession]);

  const handleCompare = useCallback(
    async (values: CompareFormValues) => {
      setIsComparing(true);

      try {
        const result = await compareStudentPrivateProfileFields({
          fields: [
            {
              candidateValue: values.candidateValue,
              fieldKey: values.fieldKey as StudentPrivateProfileCompareField,
            },
          ],
          studentId: currentStudentId,
        });

        setCompareResult(result);
        compareForm.resetFields(['candidateValue']);
        message.success('核验完成，候选值已从表单清除。');
      } catch (error) {
        message.error(resolveUpstreamErrorMessage(error, '暂时无法核验候选值。'));
      } finally {
        setIsComparing(false);
      }
    },
    [compareForm, currentStudentId, message],
  );

  const handlePatch = useCallback(
    async (values: PatchFormValues) => {
      const fieldKey = values.fieldKey as StudentPrivateProfileManualPatchField;
      const action = values.action as StudentPrivateProfileManualPatchAction;
      const summaryField = summaryFieldByKey.get(fieldKey);

      if (!canPatchStudentPrivateProfileField(fieldKey, manualPatchAccess)) {
        message.error('当前账号没有该字段的人工修正入口。');
        return;
      }

      if (action === 'SET' && !summaryField?.upstreamBaselineToken) {
        message.error('当前摘要没有可用于 SET 的 baseline token，请先重新读取 summary。');
        return;
      }

      setIsPatching(true);

      try {
        const nextSummary = await patchStudentPrivateProfileFields({
          fields: [
            {
              action,
              fieldKey,
              upstreamBaselineToken:
                action === 'SET' ? (summaryField?.upstreamBaselineToken ?? null) : undefined,
              value: action === 'SET' ? values.value : undefined,
            },
          ],
          studentId: currentStudentId,
        });

        setSummary(nextSummary);
        setCompareResult(null);
        patchForm.resetFields(['value']);
        message.success(action === 'SET' ? '人工修正已写入。' : '人工修正已清除。');
      } catch (error) {
        message.error(
          resolveUpstreamErrorMessage(error, '暂时无法保存人工修正，请重新读取 summary 后再试。'),
        );
      } finally {
        setIsPatching(false);
      }
    },
    [currentStudentId, manualPatchAccess, message, patchForm, summaryFieldByKey],
  );

  const columns: ColumnsType<StudentPrivateProfileSummaryField> = [
    {
      dataIndex: 'fieldKey',
      key: 'fieldKey',
      title: '字段',
      render: (value: string) => resolveFieldLabel(value),
    },
    {
      dataIndex: 'maskedValue',
      key: 'maskedValue',
      title: '脱敏值',
      render: (value: string | null) => displayText(value),
    },
    {
      dataIndex: 'valueStatus',
      key: 'valueStatus',
      title: '状态',
      render: (value: string) => <Tag color={resolveStatusColor(value)}>{value}</Tag>,
    },
    {
      dataIndex: 'source',
      key: 'source',
      title: '来源',
      render: (value: string) => <Tag color={resolveSourceColor(value)}>{value}</Tag>,
    },
    {
      key: 'manual',
      title: '复核',
      render: (_, record) => (
        <Space size="small" wrap>
          {record.manualOverrideActive ? <Tag color="processing">人工修正</Tag> : null}
          {record.upstreamChangedSinceManualPatch ? <Tag color="warning">需复核</Tag> : null}
          {record.upstreamBaselineToken &&
          canPatchStudentPrivateProfileField(record.fieldKey, manualPatchAccess) ? (
            <Tag>可 SET</Tag>
          ) : null}
        </Space>
      ),
    },
    {
      dataIndex: 'sourceObservedAt',
      key: 'sourceObservedAt',
      title: '观察时间',
      render: (value: string) => formatDateTime(value),
    },
  ];

  if (!currentAccount) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-6">
        <Alert showIcon type="warning" title="当前登录会话尚未恢复，请稍后重试。" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-6">
      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Typography.Title level={3} style={{ marginBottom: 0 }}>
              学生敏感资料 Lab
            </Typography.Title>
            <Typography.Paragraph style={{ marginBottom: 0 }}>
              {studentPrivateProfileLabMeta.purpose}
            </Typography.Paragraph>
          </div>

          <Alert
            showIcon
            type="info"
            message="本页面只读取脱敏 summary；compare 候选值提交后会从表单清除，不写入页面结果。"
          />

          <Form
            form={studentForm}
            initialValues={{ studentId: '' }}
            layout="inline"
            onFinish={handleLoadSummary}
          >
            <Form.Item label="班级">
              <Select
                allowClear
                filterOption={(input, option) =>
                  String(option?.label ?? '')
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
                loading={isLoadingClasses}
                notFoundContent={isLoadingClasses ? '正在加载班级' : '没有匹配班级'}
                onChange={handleClassChange}
                options={classSelectOptions}
                placeholder="选择有 active 学生归属的班级"
                showSearch
                style={{ minWidth: 260 }}
                value={selectedClassId}
              />
            </Form.Item>
            <Form.Item label="学生">
              <Select
                allowClear
                disabled={!selectedClassId}
                filterOption={(input, option) =>
                  String(option?.label ?? '')
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
                loading={isLoadingStudents}
                notFoundContent={isLoadingStudents ? '正在加载学生' : '没有匹配学生'}
                onChange={handleStudentOptionChange}
                options={studentSelectOptions}
                placeholder={selectedClassId ? '选择学生' : '先选择班级'}
                showSearch
                style={{ minWidth: 240 }}
              />
            </Form.Item>
            <Form.Item
              label="本地学生 ID"
              name="studentId"
              rules={[{ required: true, message: '请输入本地学生 ID。', whitespace: true }]}
            >
              <Input allowClear placeholder="member_student.id" />
            </Form.Item>
            <Form.Item>
              <Space wrap>
                <Button
                  htmlType="submit"
                  icon={<FileSearchOutlined />}
                  loading={isLoadingSummary}
                  type="primary"
                >
                  读取摘要
                </Button>
                <Button icon={<CloudSyncOutlined />} loading={isRefreshing} onClick={handleRefresh}>
                  显式刷新
                </Button>
                <Button icon={<LoginOutlined />} onClick={() => openLoginModal()}>
                  Upstream 登录
                </Button>
                <Button icon={<ClearOutlined />} onClick={clearSession}>
                  清除会话
                </Button>
              </Space>
            </Form.Item>
          </Form>

          {classOptionsError ? <Alert showIcon type="warning" message={classOptionsError} /> : null}
          {studentOptionsError ? (
            <Alert showIcon type="warning" message={studentOptionsError} />
          ) : null}

          <Descriptions bordered column={3} size="small">
            <Descriptions.Item label="当前账号">{currentAccount.displayName}</Descriptions.Item>
            <Descriptions.Item label="Upstream 账号锁定">
              {lockedUpstreamLoginUserId ?? '不锁定'}
            </Descriptions.Item>
            <Descriptions.Item label="Upstream session">
              {upstreamSession ? `有效至 ${formatDateTime(upstreamSession.expiresAt)}` : '未建立'}
            </Descriptions.Item>
          </Descriptions>
        </div>
      </Card>

      <Card title="脱敏摘要">
        {summary ? (
          <div className="flex flex-col gap-4">
            <Descriptions bordered column={3} size="small">
              <Descriptions.Item label="学生 ID">{summary.studentId}</Descriptions.Item>
              <Descriptions.Item label="来源观察">
                {formatDateTime(summary.sourceObservedAt)}
              </Descriptions.Item>
              <Descriptions.Item label="本地写入">
                {formatDateTime(summary.lastSyncedAt)}
              </Descriptions.Item>
              <Descriptions.Item label="人工修正">
                {formatDateTime(summary.lastManualUpdatedAt)}
              </Descriptions.Item>
              <Descriptions.Item label="照片状态">
                {formatUpstreamPhotoStatus(summary.photo)}
              </Descriptions.Item>
              <Descriptions.Item label="完整度">
                <Space size="small" wrap>
                  {PROFILE_COMPLETENESS_ITEMS.map((item) => {
                    const isObserved = summary.profileCompletenessFlags[item.key];

                    return (
                      <Tag color={isObserved ? 'success' : 'default'} key={item.key}>
                        {item.label}：{formatObservedStatus(isObserved)}
                      </Tag>
                    );
                  })}
                </Space>
              </Descriptions.Item>
            </Descriptions>

            <Table
              columns={columns}
              dataSource={summaryFields}
              pagination={false}
              rowKey="fieldKey"
              size="small"
            />

            {summary.sectionStatuses.length > 0 ? (
              <Descriptions bordered column={2} size="small" title="Section 状态">
                {summary.sectionStatuses.map((section) => (
                  <Descriptions.Item key={section.section} label={section.section}>
                    <Space direction="vertical" size="small">
                      <Space size="small" wrap>
                        <Tag color={resolveStatusColor(section.sourceStatus)}>
                          {section.sourceStatus}
                        </Tag>
                        <span>{formatDateTime(section.observedAt)}</span>
                      </Space>
                      {section.warningCodes.length > 0 ? (
                        <Space size="small" wrap>
                          {section.warningCodes.map((code) => (
                            <Tag color="warning" key={code}>
                              {code}
                            </Tag>
                          ))}
                        </Space>
                      ) : null}
                    </Space>
                  </Descriptions.Item>
                ))}
              </Descriptions>
            ) : null}
          </div>
        ) : (
          <Empty description="先输入本地学生 ID 并读取 summary" />
        )}
      </Card>

      <ResponsiveGrid className="gap-6" columns={{ compact: 1, large: 2 }}>
        <Card title="候选值核验">
          <Form
            form={compareForm}
            initialValues={{ fieldKey: 'STUDENT_PHONE' }}
            layout="vertical"
            onFinish={handleCompare}
          >
            <Form.Item label="字段" name="fieldKey" rules={[{ required: true }]}>
              <Select options={COMPARE_FIELD_OPTIONS} />
            </Form.Item>
            <Form.Item
              label="候选值"
              name="candidateValue"
              rules={[{ required: true, message: '请输入候选值。', whitespace: true }]}
            >
              <Input.Password autoComplete="off" placeholder="仅用于本次 compare" />
            </Form.Item>
            <Button
              htmlType="submit"
              icon={<CheckCircleOutlined />}
              loading={isComparing}
              type="primary"
            >
              核验
            </Button>
          </Form>

          {compareResult ? (
            <Descriptions bordered column={1} size="small" style={{ marginTop: 16 }}>
              {compareResult.results.map((result) => (
                <Descriptions.Item key={result.fieldKey} label={resolveFieldLabel(result.fieldKey)}>
                  <Space size="small" wrap>
                    <Tag color={resolveCompareResultColor(result.result)}>{result.result}</Tag>
                    <Tag>{result.valueStatus}</Tag>
                  </Space>
                </Descriptions.Item>
              ))}
            </Descriptions>
          ) : null}
        </Card>

        <Card title="人工修正">
          <Form
            form={patchForm}
            initialValues={{ action: 'SET', fieldKey: 'STUDENT_PHONE' }}
            layout="vertical"
            onFinish={handlePatch}
          >
            <Form.Item label="字段" name="fieldKey" rules={[{ required: true }]}>
              <Select
                disabled={patchFieldOptions.length === 0}
                options={patchFieldOptions}
                placeholder="当前账号无可修正字段"
              />
            </Form.Item>
            <Form.Item label="动作" name="action" rules={[{ required: true }]}>
              <Radio.Group
                options={[
                  { label: 'SET', value: 'SET' },
                  { label: 'CLEAR', value: 'CLEAR' },
                ]}
                optionType="button"
              />
            </Form.Item>
            {patchAction === 'SET' ? (
              <Form.Item
                label="修正值"
                name="value"
                rules={[{ required: true, message: '请输入修正值。', whitespace: true }]}
              >
                <Input.Password autoComplete="off" placeholder="提交后不在页面保存原文" />
              </Form.Item>
            ) : null}
            <Button
              disabled={patchFieldOptions.length === 0}
              htmlType="submit"
              icon={<EditOutlined />}
              loading={isPatching}
              type="primary"
            >
              保存修正
            </Button>
          </Form>
        </Card>
      </ResponsiveGrid>

      {refreshResult ? (
        <Card title="最近一次刷新">
          <Descriptions bordered column={3} size="small">
            <Descriptions.Item label="成功">
              <Tag color={refreshResult.success ? 'success' : 'error'}>
                {refreshResult.success ? 'true' : 'false'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="snapshotUpdated">
              {refreshResult.snapshotUpdated ? 'true' : 'false'}
            </Descriptions.Item>
            <Descriptions.Item label="traceId">{refreshResult.traceId}</Descriptions.Item>
            <Descriptions.Item label="变化 section">
              {refreshResult.changedSections.length > 0
                ? refreshResult.changedSections.join(', ')
                : '无'}
            </Descriptions.Item>
            <Descriptions.Item label="照片">
              {refreshResult.photoPresent
                ? `上游照片：本次已返回，${formatApproxByteSize(refreshResult.photoByteSize)}`
                : '上游照片：本次未返回'}
            </Descriptions.Item>
            <Descriptions.Item label="被动 rolling">
              {refreshResult.upstreamSessionToken ? '已返回新 token' : '无'}
            </Descriptions.Item>
          </Descriptions>
          {refreshResult.warnings.length > 0 ? (
            <Alert
              showIcon
              type="warning"
              message="刷新返回 warnings"
              description={refreshResult.warnings
                .map((warning) => `${warning.code}: ${warning.message}`)
                .join('\n')}
              style={{ marginTop: 16, whiteSpace: 'pre-line' }}
            />
          ) : null}
        </Card>
      ) : null}

      <UpstreamLoginModal {...upstreamLoginModalProps} />
    </div>
  );
}
