import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Empty,
  Flex,
  Form,
  Input,
  Select,
  Skeleton,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';

import { WHITE_HOUSE_DEPARTMENT_NAME } from '@/shared/department';
import { HexAvatar } from '@/shared/hex-avatar';

import { myProfileLabAccess } from './access';
import type {
  MyProfileBasicData,
  MyProfileDepartmentOption,
  MyProfileIdentityData,
  MyProfileStaffIdentity,
  MyProfileStudentIdentity,
  UpdateMyUserInfoInput,
} from './api';
import {
  fetchMyProfileBasic,
  fetchMyProfileDepartmentOptions,
  fetchMyProfileIdentity,
  requestChangeLoginEmailSelf,
  requestPasswordResetEmail,
  updateMyUserInfo,
} from './api';
import { myProfileLabMeta } from './meta';

// ---------------------------------------------------------------------------
// Label maps
// ---------------------------------------------------------------------------

const GENDER_LABELS: Record<string, string> = {
  FEMALE: '女',
  MALE: '男',
  SECRET: '保密',
};

const EMPLOYMENT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: '在职',
  LEFT: '已离职',
  SUSPENDED: '已停用',
};

const STUDENT_STATUS_LABELS: Record<string, string> = {
  DROPPED: '退学',
  ENROLLED: '在读',
  GRADUATED: '已毕业',
  SUSPENDED: '休学',
};

function getAccessGroupTagColor(group: string) {
  switch (group) {
    case 'ADMIN':
      return 'volcano';
    case 'REGISTRANT':
      return 'gold';
    case 'STAFF':
      return 'blue';
    case 'STUDENT':
      return 'purple';
    default:
      return 'green';
  }
}

function getStatusTagColor(status: string) {
  switch (status) {
    case 'ACTIVE':
    case 'ENROLLED':
      return 'success';
    case 'PENDING':
      return 'processing';
    case 'INACTIVE':
    case 'LEFT':
    case 'GRADUATED':
      return 'default';
    case 'SUSPENDED':
      return 'warning';
    case 'BANNED':
    case 'DELETED':
    case 'DROPPED':
      return 'error';
    default:
      return 'default';
  }
}

// ---------------------------------------------------------------------------
// Field display primitives (aligned with admin-user-detail pattern)
// ---------------------------------------------------------------------------

function FieldItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs text-text-secondary">{label}</div>
      <div className="text-sm font-semibold" style={{ color: 'var(--ant-color-text)' }}>
        {children}
      </div>
    </div>
  );
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-x-6 gap-y-6 md:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

function displayValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';

  return String(value);
}

function getDepartmentDisplayName(
  departmentId: string | null | undefined,
  departmentOptions: readonly MyProfileDepartmentOption[],
) {
  if (!departmentId) {
    return WHITE_HOUSE_DEPARTMENT_NAME;
  }

  const department = departmentOptions.find((option) => option.id === departmentId);

  return department?.departmentName ?? departmentId;
}

type BasicFormValues = {
  address: string;
  birthDate: Dayjs | null;
  city: string;
  email: string;
  gender: string;
  nickname: string;
  phone: string;
  province: string;
  signature: string;
  tags: string[];
};

const EMPTY_BASIC_FORM_VALUES: BasicFormValues = {
  address: '',
  birthDate: null,
  city: '',
  email: '',
  gender: 'SECRET',
  nickname: '',
  phone: '',
  province: '',
  signature: '',
  tags: [],
};

function buildBasicFormValues(userInfo: MyProfileBasicData['userInfo']): BasicFormValues {
  return {
    address: userInfo.address ?? '',
    birthDate: userInfo.birthDate ? dayjs(userInfo.birthDate) : null,
    city: userInfo.geographic?.city ?? '',
    email: userInfo.email ?? '',
    gender: userInfo.gender,
    nickname: userInfo.nickname,
    phone: userInfo.phone ?? '',
    province: userInfo.geographic?.province ?? '',
    signature: userInfo.signature ?? '',
    tags: userInfo.tags ?? [],
  };
}

function normalizeBasicFormValues(values: BasicFormValues): UpdateMyUserInfoInput {
  const city = values.city.trim();
  const province = values.province.trim();

  return {
    address: values.address,
    birthDate: values.birthDate ? values.birthDate.format('YYYY-MM-DD') : null,
    email: values.email,
    gender: values.gender as UpdateMyUserInfoInput['gender'],
    geographic:
      city || province
        ? {
            ...(city ? { city } : {}),
            ...(province ? { province } : {}),
          }
        : null,
    nickname: values.nickname,
    phone: values.phone,
    signature: values.signature,
    tags: values.tags,
  };
}

function areStringArraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function isBasicFormDirty(currentValues: BasicFormValues, initialValues: BasicFormValues) {
  const normalizedCurrent = normalizeBasicFormValues(currentValues);
  const normalizedInitial = normalizeBasicFormValues(initialValues);

  return (
    normalizedCurrent.nickname.trim() !== normalizedInitial.nickname.trim() ||
    normalizedCurrent.gender !== normalizedInitial.gender ||
    normalizedCurrent.birthDate !== normalizedInitial.birthDate ||
    normalizedCurrent.email?.trim() !== normalizedInitial.email?.trim() ||
    normalizedCurrent.signature?.trim() !== normalizedInitial.signature?.trim() ||
    normalizedCurrent.address?.trim() !== normalizedInitial.address?.trim() ||
    normalizedCurrent.phone?.trim() !== normalizedInitial.phone?.trim() ||
    JSON.stringify(normalizedCurrent.geographic) !== JSON.stringify(normalizedInitial.geographic) ||
    !areStringArraysEqual(normalizedCurrent.tags, normalizedInitial.tags)
  );
}

// ---------------------------------------------------------------------------
// Recent Login List
// ---------------------------------------------------------------------------

function RecentLoginList({
  items,
}: {
  items: MyProfileBasicData['account']['recentLoginHistory'];
}) {
  const history = items || [];

  if (history.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无登录记录" />;
  }

  return (
    <Flex vertical gap={12}>
      {history.slice(0, 5).map((item, index) => (
        <div
          key={`${item.timestamp}-${index}`}
          className="rounded-block border border-border bg-bg-layout px-4 py-3"
        >
          <Flex align="center" justify="space-between" gap={16} wrap>
            <Typography.Text strong>
              {new Date(item.timestamp).toLocaleString('zh-CN')}
            </Typography.Text>
            <Tag>{item.audience || '未知客户端'}</Tag>
          </Flex>
          <Typography.Paragraph style={{ marginBottom: 0, marginTop: 8 }}>
            登录 IP：{item.ip}
          </Typography.Paragraph>
        </div>
      ))}
    </Flex>
  );
}

// ---------------------------------------------------------------------------
// Basic Tab
// ---------------------------------------------------------------------------

function BasicTab({
  data,
  onUpdated,
}: {
  data: MyProfileBasicData | null;
  onUpdated: (userInfo: MyProfileBasicData['userInfo']) => void;
}) {
  const [form] = Form.useForm<BasicFormValues>();
  const [isDirty, setIsDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const initialValues = data ? buildBasicFormValues(data.userInfo) : EMPTY_BASIC_FORM_VALUES;

  useEffect(() => {
    if (!data) {
      form.resetFields();
      setIsDirty(false);
      setSubmitError(null);
      return;
    }

    form.setFieldsValue(buildBasicFormValues(data.userInfo));
    setIsDirty(false);
    setSubmitError(null);
  }, [data, form]);

  const handleValuesChange = useCallback(
    (_: unknown, allValues: BasicFormValues) => {
      if (!data) {
        setIsDirty(false);
        return;
      }

      setIsDirty(isBasicFormDirty(allValues, buildBasicFormValues(data.userInfo)));
    },
    [data],
  );

  const handleSubmit = useCallback(
    async (values: BasicFormValues) => {
      setSubmitting(true);
      setSubmitError(null);
      setSuccess(null);

      try {
        const result = await updateMyUserInfo(normalizeBasicFormValues(values));
        const nextValues = buildBasicFormValues(result.userInfo);

        form.setFieldsValue(nextValues);
        onUpdated(result.userInfo);
        setIsDirty(false);
        setSuccess(result.isUpdated ? '基本资料已更新。' : '基本资料未发生变化。');
      } catch (err: unknown) {
        setSubmitError(err instanceof Error ? err.message : '更新失败');
      } finally {
        setSubmitting(false);
      }
    },
    [form, onUpdated],
  );

  if (!data) return <Skeleton active paragraph={{ rows: 8 }} />;

  const { account } = data;

  return (
    <Form<BasicFormValues>
      form={form}
      initialValues={initialValues}
      onFinish={handleSubmit}
      onValuesChange={handleValuesChange}
      layout="vertical"
    >
      <div className="flex flex-col gap-6">
        {success ? (
          <Alert
            type="success"
            showIcon
            message={success}
            closable
            onClose={() => setSuccess(null)}
          />
        ) : null}

        {submitError ? (
          <Alert
            type="error"
            showIcon
            message={submitError}
            closable
            onClose={() => setSubmitError(null)}
          />
        ) : null}

        <div className="grid gap-x-6 gap-y-6 md:grid-cols-2 xl:grid-cols-3">
          <FieldItem label="昵称">
            <Form.Item name="nickname" noStyle>
              <Input variant="filled" />
            </Form.Item>
          </FieldItem>
          <FieldItem label="性别">
            <Form.Item name="gender" noStyle>
              <Select
                options={Object.entries(GENDER_LABELS).map(([value, label]) => ({ value, label }))}
                variant="filled"
                style={{ width: '100%' }}
              />
            </Form.Item>
          </FieldItem>
          <FieldItem label="展示邮箱">
            <Form.Item name="email" noStyle>
              <Input placeholder="未设置展示邮箱" variant="filled" />
            </Form.Item>
          </FieldItem>
          <FieldItem label="出生日期">
            <Form.Item name="birthDate" noStyle>
              <DatePicker style={{ width: '100%' }} variant="filled" />
            </Form.Item>
          </FieldItem>
          <FieldItem label="所在省份">
            <Form.Item name="province" noStyle>
              <Input placeholder="省份" variant="filled" />
            </Form.Item>
          </FieldItem>
          <FieldItem label="所在城市">
            <Form.Item name="city" noStyle>
              <Input placeholder="城市" variant="filled" />
            </Form.Item>
          </FieldItem>
          <div className="md:col-span-2 xl:col-span-2">
            <FieldItem label="详细地址">
              <Form.Item name="address" noStyle>
                <Input placeholder="请输入详细地址" variant="filled" />
              </Form.Item>
            </FieldItem>
          </div>
          <FieldItem label="手机号">
            <Form.Item name="phone" noStyle>
              <Input placeholder="未绑定手机号" variant="filled" />
            </Form.Item>
          </FieldItem>
          <div className="md:col-span-2 xl:col-span-3">
            <FieldItem label="个性签名">
              <Form.Item name="signature" noStyle>
                <Input placeholder="介绍一下自己..." variant="filled" />
              </Form.Item>
            </FieldItem>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <FieldItem label="标签">
            <Form.Item name="tags" noStyle>
              <Select
                mode="tags"
                tokenSeparators={[',', '，']}
                placeholder="输入后回车添加标签"
                variant="filled"
                style={{ width: '100%' }}
              />
            </Form.Item>
          </FieldItem>

          <Flex justify="end" align="center" gap={8}>
            {isDirty && (
              <Button
                type="text"
                onClick={() => {
                  form.setFieldsValue(initialValues);
                  setIsDirty(false);
                  setSubmitError(null);
                }}
              >
                还原设置
              </Button>
            )}
            <Button
              type={isDirty ? 'primary' : 'default'}
              disabled={!isDirty}
              htmlType="submit"
              loading={submitting}
            >
              更新基本资料
            </Button>
          </Flex>
        </div>

        <div className="border-t border-border pt-6">
          <div className="grid gap-x-6 gap-y-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            <FieldItem label="账户 ID">
              <Input
                value={account.id}
                variant="borderless"
                style={{ width: 96, paddingInline: 0, fontFamily: 'monospace' }}
                readOnly
              />
            </FieldItem>
            <FieldItem label="登录名">
              <Input
                value={account.loginName ?? ''}
                variant="borderless"
                style={{ paddingInline: 0 }}
                readOnly
              />
            </FieldItem>
            <FieldItem label="登录邮箱">
              <Input
                value={account.loginEmail ?? ''}
                variant="borderless"
                style={{ paddingInline: 0 }}
                readOnly
              />
            </FieldItem>
          </div>
        </div>
      </div>
    </Form>
  );
}

// ---------------------------------------------------------------------------
// Identity Tab
// ---------------------------------------------------------------------------

function StaffIdentitySection({
  staff,
  departmentOptions,
}: {
  staff: MyProfileStaffIdentity;
  departmentOptions: readonly MyProfileDepartmentOption[];
}) {
  return (
    <FieldGrid>
      <FieldItem label="员工 ID">{staff.id}</FieldItem>
      <FieldItem label="姓名">{staff.name}</FieldItem>
      <FieldItem label="在职状态">
        <Tag color={getStatusTagColor(staff.employmentStatus)}>
          {EMPLOYMENT_STATUS_LABELS[staff.employmentStatus] ?? staff.employmentStatus}
        </Tag>
      </FieldItem>
      <FieldItem label="称呼">{displayValue(staff.jobTitle)}</FieldItem>
      <FieldItem label="系部名称">
        {getDepartmentDisplayName(staff.departmentId, departmentOptions)}
      </FieldItem>
    </FieldGrid>
  );
}

function StudentIdentitySection({ student }: { student: MyProfileStudentIdentity }) {
  return (
    <FieldGrid>
      <FieldItem label="学号">{student.id}</FieldItem>
      <FieldItem label="姓名">{student.name}</FieldItem>
      <FieldItem label="学籍状态">
        <Tag color={getStatusTagColor(student.studentStatus)}>
          {STUDENT_STATUS_LABELS[student.studentStatus] ?? student.studentStatus}
        </Tag>
      </FieldItem>
      <FieldItem label="班级 ID">{displayValue(student.classId)}</FieldItem>
    </FieldGrid>
  );
}

function IdentityTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MyProfileIdentityData | null | undefined>(undefined);
  const [departmentOptions, setDepartmentOptions] = useState<readonly MyProfileDepartmentOption[]>(
    [],
  );

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetchMyProfileIdentity(),
      fetchMyProfileDepartmentOptions().catch(() => [] as const),
    ])
      .then(([identityResult, departmentResult]) => {
        if (!cancelled) {
          setData(identityResult);
          setDepartmentOptions(departmentResult);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '加载失败');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <Skeleton active paragraph={{ rows: 6 }} />;
  if (error) return <Alert type="error" showIcon message="加载失败" description={error} />;

  if (!data) {
    return <Empty description="当前账户暂无关联的身份信息（教职工或学生）" />;
  }

  const isStaff = data.__typename === 'MyProfileStaffIdentityDTO';

  return (
    <div className="flex flex-col gap-6">
      <Typography.Text strong>{isStaff ? '教职工身份' : '学生身份'}</Typography.Text>
      {isStaff ? (
        <StaffIdentitySection
          staff={data as MyProfileStaffIdentity}
          departmentOptions={departmentOptions}
        />
      ) : (
        <StudentIdentitySection student={data as MyProfileStudentIdentity} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Security Tab
// ---------------------------------------------------------------------------

function ChangeEmailCard({ currentLoginEmail }: { currentLoginEmail: string | null }) {
  const [form] = Form.useForm<{ newLoginEmail: string }>();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (values: { newLoginEmail: string }) => {
      setSubmitting(true);
      setSubmitError(null);
      setSuccess(null);

      try {
        const result = await requestChangeLoginEmailSelf(values.newLoginEmail.trim());

        setSuccess(result.message || '验证邮件已发送，请前往新邮箱查收并完成验证。');
        form.resetFields();
      } catch (err: unknown) {
        setSubmitError(err instanceof Error ? err.message : '操作失败');
      } finally {
        setSubmitting(false);
      }
    },
    [form],
  );

  return (
    <Card title="修改登录邮箱">
      {currentLoginEmail ? (
        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
          当前登录邮箱：{currentLoginEmail}
        </Typography.Paragraph>
      ) : null}

      {success ? (
        <Alert
          type="success"
          showIcon
          message={success}
          closable
          onClose={() => setSuccess(null)}
          style={{ marginBottom: 16 }}
        />
      ) : null}

      {submitError ? (
        <Alert
          type="error"
          showIcon
          message={submitError}
          closable
          onClose={() => setSubmitError(null)}
          style={{ marginBottom: 16 }}
        />
      ) : null}

      <Form<{ newLoginEmail: string }>
        form={form}
        layout="vertical"
        requiredMark={false}
        onFinish={handleSubmit}
      >
        <Form.Item
          label="新的登录邮箱"
          name="newLoginEmail"
          rules={[
            { required: true, message: '请输入新的登录邮箱。' },
            { type: 'email', message: '请输入有效的邮箱地址。' },
          ]}
        >
          <Input placeholder="name@example.com" autoComplete="email" />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0 }}>
          <Button type="primary" htmlType="submit" loading={submitting}>
            发送验证邮件
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
}

function ResetPasswordCard({ currentLoginEmail }: { currentLoginEmail: string | null }) {
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [manualEmail, setManualEmail] = useState('');

  const targetEmail = currentLoginEmail || manualEmail.trim();

  const handleSend = useCallback(async () => {
    if (!targetEmail) return;

    setSubmitting(true);
    setSubmitError(null);
    setSuccess(null);

    try {
      const result = await requestPasswordResetEmail(targetEmail);

      setSuccess(result.message || '密码重置邮件已发送，请前往邮箱查收。');
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setSubmitting(false);
    }
  }, [targetEmail]);

  return (
    <Card title="重置密码">
      <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
        点击发送后，系统会向登录邮箱发送密码重置链接，通过链接完成密码修改。
      </Typography.Paragraph>

      {success ? (
        <Alert
          type="success"
          showIcon
          message={success}
          closable
          onClose={() => setSuccess(null)}
          style={{ marginBottom: 16 }}
        />
      ) : null}

      {submitError ? (
        <Alert
          type="error"
          showIcon
          message={submitError}
          closable
          onClose={() => setSubmitError(null)}
          style={{ marginBottom: 16 }}
        />
      ) : null}

      {currentLoginEmail ? (
        <Flex vertical gap={12}>
          <Typography.Text>
            当前登录邮箱：<Typography.Text strong>{currentLoginEmail}</Typography.Text>
          </Typography.Text>
          <div>
            <Button type="primary" loading={submitting} onClick={handleSend}>
              发送密码重置邮件
            </Button>
          </div>
        </Flex>
      ) : (
        <Flex vertical gap={12}>
          <Alert type="warning" showIcon message="当前账户未设置登录邮箱，请手动输入邮箱地址。" />
          <Input
            placeholder="请输入邮箱地址"
            value={manualEmail}
            onChange={(e) => setManualEmail(e.target.value)}
            autoComplete="email"
          />
          <div>
            <Button
              type="primary"
              loading={submitting}
              disabled={!targetEmail}
              onClick={handleSend}
            >
              发送密码重置邮件
            </Button>
          </div>
        </Flex>
      )}
    </Card>
  );
}

function SecurityTab({
  loginEmail,
  loginHistory,
}: {
  loginEmail: string | null;
  loginHistory: MyProfileBasicData['account']['recentLoginHistory'];
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-6">
        <ChangeEmailCard currentLoginEmail={loginEmail} />
        <ResetPasswordCard currentLoginEmail={loginEmail} />
      </div>

      <Card title="最近登录活动">
        <RecentLoginList items={loginHistory} />
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

function ProfileSidebar({ data, loading }: { data: MyProfileBasicData | null; loading: boolean }) {
  if (loading || !data) {
    return (
      <div className="rounded-card shadow-card">
        <Card styles={{ body: { padding: 24 } }}>
          <Flex vertical align="center" gap={16}>
            <Skeleton.Avatar active size={160} shape="circle" />
            <Skeleton.Input active size="small" style={{ width: 120 }} />
            <Skeleton active paragraph={{ rows: 2 }} />
          </Flex>
        </Card>
      </div>
    );
  }

  const { userInfo, account } = data;

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-card shadow-card">
        <Card styles={{ body: { padding: 24 } }}>
          <Flex vertical align="center" gap={16}>
            <HexAvatar
              accountId={account.id}
              avatarUrl={userInfo.avatarUrl}
              size={160}
              style={{
                border: '3px solid var(--ant-color-bg-container)',
                boxShadow: 'var(--ant-box-shadow-tertiary)',
              }}
            />

            <div className="text-center">
              <Typography.Title level={4} style={{ margin: 0 }}>
                {userInfo.nickname}
              </Typography.Title>
              {account.loginName ? (
                <Typography.Text type="secondary">@{account.loginName}</Typography.Text>
              ) : null}
            </div>

            {userInfo.signature ? (
              <Typography.Paragraph
                type="secondary"
                ellipsis={{ rows: 2, tooltip: userInfo.signature }}
                style={{ marginBottom: 0, textAlign: 'center' }}
              >
                {userInfo.signature}
              </Typography.Paragraph>
            ) : null}

            <Flex gap={4} wrap justify="center">
              {userInfo.accessGroup.map((group) => (
                <Tag key={group} color={getAccessGroupTagColor(group)}>
                  {group}
                </Tag>
              ))}
            </Flex>
          </Flex>

          {userInfo.tags && userInfo.tags.length > 0 ? (
            <div className="mt-4 border-t border-border pt-4">
              <Flex gap={4} wrap>
                {userInfo.tags.map((tag) => (
                  <Tag key={tag} color="cyan">
                    {tag}
                  </Tag>
                ))}
              </Flex>
            </div>
          ) : null}
        </Card>
      </div>

      <div className="rounded-card shadow-card">
        <Card styles={{ body: { padding: 16 } }}>
          <Flex vertical gap={6}>
            <Typography.Text type="secondary" style={{ fontSize: 'var(--ant-font-size-sm)' }}>
              Lab Status
            </Typography.Text>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              {myProfileLabMeta.purpose}
            </Typography.Paragraph>
            <Flex gap={4} wrap>
              <Tag>{myProfileLabMeta.owner}</Tag>
              <Tag>{myProfileLabMeta.reviewAt}</Tag>
              <Tag>{myProfileLabAccess.env.join(', ')}</Tag>
            </Flex>
          </Flex>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export function MyProfileLabPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MyProfileBasicData | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchMyProfileBasic()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '加载失败');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (error && !data) {
    return (
      <div className="mx-auto w-full max-w-[--width-content-readable]">
        <Alert type="error" showIcon message="加载失败" description={error} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[--width-content-readable] pb-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-card shadow-card">
            <Card styles={{ body: { padding: 24 } }}>
              <div className="app-profile-tabs">
                <Tabs
                  defaultActiveKey="basic"
                  items={[
                    {
                      key: 'basic',
                      label: '基本资料',
                      children: (
                        <BasicTab
                          data={data}
                          onUpdated={(userInfo) =>
                            setData((current) => (current ? { ...current, userInfo } : current))
                          }
                        />
                      ),
                    },
                    {
                      key: 'identity',
                      label: '身份信息',
                      children: <IdentityTab />,
                    },
                    {
                      key: 'security',
                      label: '安全设置',
                      children: (
                        <SecurityTab
                          loginEmail={data?.account.loginEmail ?? null}
                          loginHistory={data?.account.recentLoginHistory ?? []}
                        />
                      ),
                    },
                  ]}
                />
              </div>
            </Card>
          </div>
        </div>

        <div className="lg:col-span-1">
          <ProfileSidebar data={data} loading={loading} />
        </div>
      </div>
    </div>
  );
}
