import { type CSSProperties, type ReactNode, useMemo, useState } from 'react';
import { EditOutlined } from '@ant-design/icons';
import {
  Alert,
  Avatar,
  Button,
  Card,
  DatePicker,
  Flex,
  Form,
  Input,
  message,
  Radio,
  Select,
  Skeleton,
  Tag,
  Typography,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useLocation, useNavigate } from 'react-router';

import type { AuthAccessGroup } from '@/shared/auth-access';

import type { AdminDepartmentOption } from '../application/get-admin-department-options';
import type {
  AdminUserDetail,
  AdminUserDetailAccountStatus,
  AdminUserDetailGender,
  AdminUserDetailStaffEmploymentStatus,
  AdminUserDetailUserState,
} from '../application/get-admin-user-detail';
import {
  ADMIN_USER_DETAIL_ACCOUNT_STATUS_LABELS,
  ADMIN_USER_DETAIL_ACCOUNT_STATUSES,
  ADMIN_USER_DETAIL_GENDER_LABELS,
  ADMIN_USER_DETAIL_GENDERS,
  ADMIN_USER_DETAIL_IDENTITY_HINTS,
  ADMIN_USER_DETAIL_STAFF_EMPLOYMENT_STATUS_LABELS,
  ADMIN_USER_DETAIL_STAFF_EMPLOYMENT_STATUSES,
  ADMIN_USER_DETAIL_USER_STATE_LABELS,
  ADMIN_USER_DETAIL_USER_STATES,
} from '../application/get-admin-user-detail';
import type {
  UpdateAdminUserDetailAccountSectionInput,
  UpdateAdminUserDetailAccountSectionResult,
  UpdateAdminUserDetailStaffSectionInput,
  UpdateAdminUserDetailStaffSectionResult,
  UpdateAdminUserDetailUserInfoSectionInput,
  UpdateAdminUserDetailUserInfoSectionResult,
} from '../application/update-admin-user-detail-sections';
import {
  type AdminDepartmentOptionsLoader,
  useAdminDepartmentOptions,
} from '../application/use-admin-department-options';
import {
  type AdminUserDetailLoader,
  useAdminUserDetail,
} from '../application/use-admin-user-detail';

const { TextArea } = Input;
const DEFAULT_BIRTH_DATE_PICKER_VALUE = dayjs('1984-01-01');

type EditableSectionKey = 'account' | 'staff' | 'userInfo';

type DetailItem = {
  key: string;
  label: ReactNode;
  value: ReactNode;
};

type DetailSection = {
  items: readonly DetailItem[];
  key: string;
  tone: 'editable' | 'fixed' | 'reference';
};

type DetailSectionGroup = {
  editable: DetailSection;
  fixed: DetailSection;
  reference: DetailSection;
};

type SectionErrorState = Record<EditableSectionKey, string | null>;

type AdminUserDetailPageContentProps = {
  accountId: number;
  loadDepartmentOptions: AdminDepartmentOptionsLoader;
  loadDetail: AdminUserDetailLoader;
  updateAccountSection: (
    input: UpdateAdminUserDetailAccountSectionInput,
  ) => Promise<UpdateAdminUserDetailAccountSectionResult>;
  updateStaffSection: (
    input: UpdateAdminUserDetailStaffSectionInput,
  ) => Promise<UpdateAdminUserDetailStaffSectionResult>;
  updateUserInfoSection: (
    input: UpdateAdminUserDetailUserInfoSectionInput,
  ) => Promise<UpdateAdminUserDetailUserInfoSectionResult>;
};

type AccountSectionFormValues = {
  identityHint?: AuthAccessGroup;
  status: AdminUserDetailAccountStatus;
};

type UserInfoSectionFormValues = {
  address?: string;
  birthDate?: Dayjs | null;
  email?: string;
  gender: AdminUserDetailGender;
  geographic?: string;
  nickname: string;
  phone?: string;
  signature?: string;
  tags: string[];
  userState: AdminUserDetailUserState;
};

type StaffSectionFormValues = {
  departmentId?: string;
  employmentStatus: AdminUserDetailStaffEmploymentStatus;
  jobTitle?: string;
  name: string;
  remark?: string;
};

const INITIAL_SECTION_ERROR_STATE: SectionErrorState = {
  account: null,
  staff: null,
  userInfo: null,
};

function getDepartmentDisplayName(
  departmentId: string | null | undefined,
  departmentMap: ReadonlyMap<string, AdminDepartmentOption>,
) {
  if (!departmentId) {
    return '—';
  }

  const department = departmentMap.get(departmentId);

  if (!department) {
    return departmentId;
  }

  return department.departmentName || department.id;
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
    hour12: false,
  });
}

function formatOptionalValue(value: string | null | undefined) {
  return value && value.trim() ? value : '—';
}

function formatCount(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function normalizeOptionalTextValue(value: string | null | undefined) {
  if (value === undefined || value === null) {
    return null;
  }

  const nextValue = value.trim();

  return nextValue ? nextValue : null;
}

function normalizeRequiredTextValue(value: string) {
  return value.trim();
}

function normalizeBirthDateValue(value: Dayjs | null | undefined) {
  if (!value || !value.isValid()) {
    return null;
  }

  return value.format('YYYY-MM-DD');
}

function toBirthDatePickerValue(value: string | null | undefined) {
  if (!value) {
    return undefined;
  }

  const dateValue = dayjs(value);

  return dateValue.isValid() ? dateValue : undefined;
}

function normalizeTagsValue(tags: readonly string[]) {
  return Array.from(new Set(tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0)));
}

function areStringArraysEqual(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function getStatusTagColor(
  status:
    | AdminUserDetailAccountStatus
    | AdminUserDetailStaffEmploymentStatus
    | AdminUserDetailUserState,
) {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'PENDING':
      return 'processing';
    case 'INACTIVE':
    case 'LEFT':
      return 'default';
    case 'SUSPENDED':
      return 'warning';
    case 'BANNED':
    case 'DELETED':
      return 'error';
    default:
      return 'default';
  }
}

function BilingualLabel({
  compact = false,
  title,
  subtitle,
}: {
  compact?: boolean;
  title: string;
  subtitle: string;
}) {
  return (
    <Flex align="center" gap={12} justify="space-between">
      <Typography.Text
        type="secondary"
        style={compact ? { fontSize: 12, lineHeight: 1.2 } : undefined}
      >
        {title}
      </Typography.Text>
      <Typography.Text
        type="secondary"
        style={{
          fontSize: compact ? 11 : 12,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          lineHeight: 1.2,
          marginLeft: 'auto',
        }}
      >
        {subtitle}
      </Typography.Text>
    </Flex>
  );
}

function ReadonlyValue({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex max-w-full rounded-badge border border-border bg-bg-layout px-2.5 py-1">
      <Typography.Text
        style={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 13,
          lineHeight: 1.2,
          overflowWrap: 'anywhere',
        }}
      >
        {children}
      </Typography.Text>
    </div>
  );
}

function getSectionToneStyle(tone: DetailSection['tone']) {
  switch (tone) {
    case 'editable':
      return {
        bodyClassName: 'border-info-border bg-info-bg p-4',
        gridClassName: 'grid gap-3 md:grid-cols-2 xl:grid-cols-3',
        itemClassName: 'border-info-border bg-bg-container',
        itemStyle: undefined,
        valueClassName: '',
        valueStyle: undefined,
      };
    case 'reference':
      return {
        bodyClassName: 'border-transparent p-0',
        bodyStyle: {
          backgroundColor: 'transparent',
        } satisfies CSSProperties,
        gridClassName: 'grid gap-2 md:grid-cols-2 xl:grid-cols-4',
        itemClassName: '',
        itemStyle: {
          backgroundColor: 'var(--ant-color-fill-tertiary)',
          borderColor: 'transparent',
          padding: '8px 10px',
        } satisfies CSSProperties,
        valueClassName: 'text-text-secondary',
        valueStyle: {
          fontSize: 12,
          lineHeight: 1.25,
        } satisfies CSSProperties,
      };
    case 'fixed':
    default:
      return {
        bodyClassName: 'border-border bg-bg-layout p-4',
        gridClassName: 'grid gap-3 md:grid-cols-2 xl:grid-cols-3',
        itemClassName: 'border-border bg-bg-container',
        itemStyle: undefined,
        valueClassName: '',
        valueStyle: undefined,
      };
  }
}

function DetailFieldGrid({
  gridClassName,
  items,
  itemClassName,
  itemStyle,
  valueClassName,
  valueStyle,
}: {
  gridClassName: string;
  items: readonly DetailItem[];
  itemClassName: string;
  itemStyle?: CSSProperties;
  valueClassName: string;
  valueStyle?: CSSProperties;
}) {
  return (
    <div className={gridClassName}>
      {items.map((item) => (
        <div
          key={item.key}
          className={`rounded-block border px-4 py-3 ${itemClassName}`}
          style={itemStyle}
        >
          {item.label}
          <div className={valueClassName} style={{ ...valueStyle, marginTop: 6 }}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function DetailSectionBlock({ section }: { section: DetailSection }) {
  const toneStyle = getSectionToneStyle(section.tone);

  return (
    <div className={`rounded-card border ${toneStyle.bodyClassName}`} style={toneStyle.bodyStyle}>
      <DetailFieldGrid
        gridClassName={toneStyle.gridClassName}
        items={section.items}
        itemClassName={toneStyle.itemClassName}
        itemStyle={toneStyle.itemStyle}
        valueClassName={toneStyle.valueClassName}
        valueStyle={toneStyle.valueStyle}
      />
    </div>
  );
}

function EditableSectionShell({
  children,
  editLabel,
  editing,
  errorMessage,
  formId,
  onCancel,
  onEdit,
  saveLabel,
  saving,
}: {
  children: ReactNode;
  editLabel: string;
  editing: boolean;
  errorMessage: string | null;
  formId: string;
  onCancel: () => void;
  onEdit: () => void;
  saveLabel: string;
  saving: boolean;
}) {
  return (
    <Flex vertical gap={12}>
      <Flex align="center" gap={12} justify="space-between" wrap>
        <BilingualLabel title="常用字段" subtitle="Editable Fields" />
        {editing ? (
          <Flex gap={8} wrap>
            <Button onClick={onCancel}>取消</Button>
            <Button type="primary" htmlType="submit" form={formId} loading={saving}>
              {saveLabel}
            </Button>
          </Flex>
        ) : (
          <Button icon={<EditOutlined />} onClick={onEdit} aria-label={editLabel}>
            编辑
          </Button>
        )}
      </Flex>
      {errorMessage ? <Alert type="error" showIcon title={errorMessage} /> : null}
      {children}
    </Flex>
  );
}

function EditableFormCard({
  children,
  spanClassName,
}: {
  children: ReactNode;
  spanClassName?: string;
}) {
  return (
    <div className={spanClassName}>
      <div className="rounded-block border border-info-border bg-bg-container px-4 py-3">
        {children}
      </div>
    </div>
  );
}

function buildAccountSectionGroup(detail: AdminUserDetail): DetailSectionGroup {
  return {
    editable: {
      items: [
        {
          key: 'accountStatus',
          label: <BilingualLabel title="账户状态" subtitle="Account Status" />,
          value: (
            <Tag color={getStatusTagColor(detail.account.status)}>
              {ADMIN_USER_DETAIL_ACCOUNT_STATUS_LABELS[detail.account.status]}
            </Tag>
          ),
        },
        {
          key: 'identityHint',
          label: <BilingualLabel title="身份提示" subtitle="Identity Hint" />,
          value: formatOptionalValue(detail.account.identityHint),
        },
        {
          key: 'loginName',
          label: <BilingualLabel title="登录名" subtitle="Login Name" />,
          value: formatOptionalValue(detail.account.loginName),
        },
      ],
      key: 'accountEditable',
      tone: 'editable',
    },
    fixed: {
      items: [
        {
          key: 'accountId',
          label: <BilingualLabel title="账户 ID" subtitle="Account ID" />,
          value: <ReadonlyValue>{String(detail.account.id)}</ReadonlyValue>,
        },
        {
          key: 'loginEmail',
          label: <BilingualLabel title="登录邮箱" subtitle="Login Email" />,
          value: <ReadonlyValue>{formatOptionalValue(detail.account.loginEmail)}</ReadonlyValue>,
        },
      ],
      key: 'accountFixed',
      tone: 'fixed',
    },
    reference: {
      items: [
        {
          key: 'accountCreatedAt',
          label: <BilingualLabel compact title="创建时间" subtitle="Created At" />,
          value: formatDateTime(detail.account.createdAt),
        },
        {
          key: 'accountUpdatedAt',
          label: <BilingualLabel compact title="更新时间" subtitle="Updated At" />,
          value: formatDateTime(detail.account.updatedAt),
        },
      ],
      key: 'accountMetadata',
      tone: 'reference',
    },
  };
}

function buildUserInfoSectionGroup(detail: AdminUserDetail): DetailSectionGroup {
  return {
    editable: {
      items: [
        {
          key: 'nickname',
          label: <BilingualLabel title="昵称" subtitle="Nickname" />,
          value: formatOptionalValue(detail.userInfo.nickname),
        },
        {
          key: 'userState',
          label: <BilingualLabel title="用户状态" subtitle="User State" />,
          value: (
            <Tag color={getStatusTagColor(detail.userInfo.userState)}>
              {ADMIN_USER_DETAIL_USER_STATE_LABELS[detail.userInfo.userState]}
            </Tag>
          ),
        },
        {
          key: 'accessGroup',
          label: <BilingualLabel title="访问组" subtitle="Access Group" />,
          value:
            detail.userInfo.accessGroup.length > 0 ? (
              <Flex gap={4} wrap>
                {detail.userInfo.accessGroup.map((accessGroup) => (
                  <Tag key={accessGroup} color="blue">
                    {accessGroup}
                  </Tag>
                ))}
              </Flex>
            ) : (
              '—'
            ),
        },
        {
          key: 'email',
          label: <BilingualLabel title="邮箱" subtitle="Email" />,
          value: formatOptionalValue(detail.userInfo.email),
        },
        {
          key: 'phone',
          label: <BilingualLabel title="手机号" subtitle="Phone" />,
          value: formatOptionalValue(detail.userInfo.phone),
        },
        {
          key: 'gender',
          label: <BilingualLabel title="性别" subtitle="Gender" />,
          value: ADMIN_USER_DETAIL_GENDER_LABELS[detail.userInfo.gender],
        },
        {
          key: 'birthDate',
          label: <BilingualLabel title="出生日期" subtitle="Birth Date" />,
          value: formatOptionalValue(detail.userInfo.birthDate),
        },
        {
          key: 'address',
          label: <BilingualLabel title="地址" subtitle="Address" />,
          value: formatOptionalValue(detail.userInfo.address),
        },
        {
          key: 'geographic',
          label: <BilingualLabel title="地理位置" subtitle="Geographic" />,
          value: formatOptionalValue(detail.userInfo.geographic),
        },
        {
          key: 'signature',
          label: <BilingualLabel title="个性签名" subtitle="Signature" />,
          value: formatOptionalValue(detail.userInfo.signature),
        },
        {
          key: 'tags',
          label: <BilingualLabel title="标签" subtitle="Tags" />,
          value:
            detail.userInfo.tags && detail.userInfo.tags.length > 0
              ? detail.userInfo.tags.join(' / ')
              : '—',
        },
      ],
      key: 'userProfile',
      tone: 'editable',
    },
    fixed: {
      items: [
        {
          key: 'userInfoId',
          label: <BilingualLabel title="用户信息 ID" subtitle="User Info ID" />,
          value: <ReadonlyValue>{detail.userInfo.id}</ReadonlyValue>,
        },
      ],
      key: 'userIdentity',
      tone: 'fixed',
    },
    reference: {
      items: [
        {
          key: 'notifyCount',
          label: <BilingualLabel compact title="通知数" subtitle="Notify Count" />,
          value: formatCount(detail.userInfo.notifyCount),
        },
        {
          key: 'unreadCount',
          label: <BilingualLabel compact title="未读通知数" subtitle="Unread Count" />,
          value: formatCount(detail.userInfo.unreadCount),
        },
        {
          key: 'userInfoCreatedAt',
          label: <BilingualLabel compact title="创建时间" subtitle="Created At" />,
          value: formatDateTime(detail.userInfo.createdAt),
        },
        {
          key: 'userInfoUpdatedAt',
          label: <BilingualLabel compact title="更新时间" subtitle="Updated At" />,
          value: formatDateTime(detail.userInfo.updatedAt),
        },
      ],
      key: 'userMetadata',
      tone: 'reference',
    },
  };
}

function buildStaffSectionGroup(
  detail: AdminUserDetail,
  departmentMap: ReadonlyMap<string, AdminDepartmentOption>,
): DetailSectionGroup {
  return {
    editable: {
      items: [
        {
          key: 'staffEmploymentStatus',
          label: <BilingualLabel title="在职状态" subtitle="Employment Status" />,
          value: (
            <Tag color={getStatusTagColor(detail.staff.employmentStatus)}>
              {ADMIN_USER_DETAIL_STAFF_EMPLOYMENT_STATUS_LABELS[detail.staff.employmentStatus]}
            </Tag>
          ),
        },
        {
          key: 'staffName',
          label: <BilingualLabel title="姓名" subtitle="Name" />,
          value: formatOptionalValue(detail.staff.name),
        },
        {
          key: 'staffDepartmentId',
          label: <BilingualLabel title="部门" subtitle="Department" />,
          value: getDepartmentDisplayName(detail.staff.departmentId, departmentMap),
        },
        {
          key: 'staffJobTitle',
          label: <BilingualLabel title="职务/职称" subtitle="Job Title" />,
          value: formatOptionalValue(detail.staff.jobTitle),
        },
        {
          key: 'staffRemark',
          label: <BilingualLabel title="备注" subtitle="Remark" />,
          value: formatOptionalValue(detail.staff.remark),
        },
      ],
      key: 'staffProfile',
      tone: 'editable',
    },
    fixed: {
      items: [
        {
          key: 'staffId',
          label: <BilingualLabel title="工号" subtitle="Staff ID" />,
          value: <ReadonlyValue>{detail.staff.id}</ReadonlyValue>,
        },
        {
          key: 'staffAccountId',
          label: <BilingualLabel title="关联账户 ID" subtitle="Account ID" />,
          value: <ReadonlyValue>{String(detail.staff.accountId)}</ReadonlyValue>,
        },
      ],
      key: 'staffIdentity',
      tone: 'fixed',
    },
    reference: {
      items: [
        {
          key: 'staffCreatedAt',
          label: <BilingualLabel compact title="创建时间" subtitle="Created At" />,
          value: formatDateTime(detail.staff.createdAt),
        },
        {
          key: 'staffUpdatedAt',
          label: <BilingualLabel compact title="更新时间" subtitle="Updated At" />,
          value: formatDateTime(detail.staff.updatedAt),
        },
      ],
      key: 'staffMetadata',
      tone: 'reference',
    },
  };
}

function RecentLoginList({ items }: { items: AdminUserDetail['account']['recentLoginHistory'] }) {
  if (items.length === 0) {
    return <Alert type="info" showIcon title="后端当前未返回最近登录记录。" />;
  }

  return (
    <Flex vertical gap={12}>
      {items.map((item, index) => (
        <div
          key={`${item.timestamp}-${item.ip}-${index}`}
          className="rounded-block border border-border bg-bg-layout px-4 py-3"
        >
          <Flex align="center" justify="space-between" gap={16} wrap>
            <Typography.Text strong>{formatDateTime(item.timestamp)}</Typography.Text>
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

function AccountSectionEditor({
  detail,
  errorMessage,
  formId,
  onCancel,
  onEdit,
  onSubmit,
  saving,
}: {
  detail: AdminUserDetail;
  errorMessage: string | null;
  formId: string;
  onCancel: () => void;
  onEdit: () => void;
  onSubmit: (values: AccountSectionFormValues) => Promise<void>;
  saving: boolean;
}) {
  const [form] = Form.useForm<AccountSectionFormValues>();
  const initialValues = useMemo<AccountSectionFormValues>(
    () => ({
      identityHint: detail.account.identityHint ?? undefined,
      status: detail.account.status,
    }),
    [detail.account.identityHint, detail.account.status],
  );

  return (
    <EditableSectionShell
      editLabel="编辑账户常用字段"
      editing
      errorMessage={errorMessage}
      formId={formId}
      onCancel={onCancel}
      onEdit={onEdit}
      saveLabel="保存账户常用字段"
      saving={saving}
    >
      <div className="rounded-card border border-info-border bg-info-bg p-4">
        <Form<AccountSectionFormValues>
          id={formId}
          form={form}
          layout="vertical"
          requiredMark={false}
          initialValues={initialValues}
          onFinish={onSubmit}
          disabled={saving}
          key={`${detail.account.id}-${detail.account.updatedAt}-account`}
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <EditableFormCard>
              <Form.Item<AccountSectionFormValues>
                label={<BilingualLabel title="账户状态" subtitle="Account Status" />}
                name="status"
                rules={[{ required: true, message: '请选择账户状态。' }]}
                style={{ marginBottom: 0 }}
              >
                <Radio.Group
                  optionType="button"
                  buttonStyle="solid"
                  options={ADMIN_USER_DETAIL_ACCOUNT_STATUSES.map((status) => ({
                    label: ADMIN_USER_DETAIL_ACCOUNT_STATUS_LABELS[status],
                    value: status,
                  }))}
                />
              </Form.Item>
            </EditableFormCard>
            <EditableFormCard>
              <Form.Item<AccountSectionFormValues>
                label={<BilingualLabel title="身份提示" subtitle="Identity Hint" />}
                name="identityHint"
                rules={[{ required: true, message: '请选择身份提示。' }]}
                style={{ marginBottom: 0 }}
              >
                <Radio.Group
                  optionType="button"
                  buttonStyle="solid"
                  options={ADMIN_USER_DETAIL_IDENTITY_HINTS.map((identityHint) => ({
                    label: identityHint,
                    value: identityHint,
                  }))}
                />
              </Form.Item>
            </EditableFormCard>
            <EditableFormCard>
              <Flex vertical gap={10}>
                <BilingualLabel title="登录名" subtitle="Login Name" />
                <Input value={detail.account.loginName ?? ''} disabled />
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  当前暂不支持修改。
                </Typography.Text>
              </Flex>
            </EditableFormCard>
          </div>
        </Form>
      </div>
    </EditableSectionShell>
  );
}

function AccountSectionViewer({ section, onEdit }: { section: DetailSection; onEdit: () => void }) {
  return (
    <EditableSectionShell
      editLabel="编辑账户常用字段"
      editing={false}
      errorMessage={null}
      formId="account-section-form"
      onCancel={() => undefined}
      onEdit={onEdit}
      saveLabel=""
      saving={false}
    >
      <DetailSectionBlock section={section} />
    </EditableSectionShell>
  );
}

function UserInfoSectionEditor({
  detail,
  errorMessage,
  formId,
  onCancel,
  onEdit,
  onSubmit,
  saving,
}: {
  detail: AdminUserDetail;
  errorMessage: string | null;
  formId: string;
  onCancel: () => void;
  onEdit: () => void;
  onSubmit: (values: UserInfoSectionFormValues) => Promise<void>;
  saving: boolean;
}) {
  const [form] = Form.useForm<UserInfoSectionFormValues>();
  const initialValues = useMemo<UserInfoSectionFormValues>(
    () => ({
      address: detail.userInfo.address ?? undefined,
      birthDate: toBirthDatePickerValue(detail.userInfo.birthDate),
      email: detail.userInfo.email ?? undefined,
      gender: detail.userInfo.gender,
      geographic: detail.userInfo.geographic ?? undefined,
      nickname: detail.userInfo.nickname,
      phone: detail.userInfo.phone ?? undefined,
      signature: detail.userInfo.signature ?? undefined,
      tags: detail.userInfo.tags ? [...detail.userInfo.tags] : [],
      userState: detail.userInfo.userState,
    }),
    [detail.userInfo],
  );

  return (
    <EditableSectionShell
      editLabel="编辑用户常用字段"
      editing
      errorMessage={errorMessage}
      formId={formId}
      onCancel={onCancel}
      onEdit={onEdit}
      saveLabel="保存用户常用字段"
      saving={saving}
    >
      <div className="rounded-card border border-info-border bg-info-bg p-4">
        <Form<UserInfoSectionFormValues>
          id={formId}
          form={form}
          layout="vertical"
          requiredMark={false}
          initialValues={initialValues}
          onFinish={onSubmit}
          disabled={saving}
          key={`${detail.userInfo.id}-${detail.userInfo.updatedAt}-user-info`}
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <EditableFormCard>
              <Form.Item<UserInfoSectionFormValues>
                label={<BilingualLabel title="昵称" subtitle="Nickname" />}
                name="nickname"
                rules={[
                  {
                    validator: (_, value) =>
                      normalizeRequiredTextValue(value ?? '')
                        ? Promise.resolve()
                        : Promise.reject(new Error('请输入昵称。')),
                  },
                ]}
                style={{ marginBottom: 0 }}
              >
                <Input maxLength={64} />
              </Form.Item>
            </EditableFormCard>
            <EditableFormCard>
              <Form.Item<UserInfoSectionFormValues>
                label={<BilingualLabel title="用户状态" subtitle="User State" />}
                name="userState"
                rules={[{ required: true, message: '请选择用户状态。' }]}
                style={{ marginBottom: 0 }}
              >
                <Radio.Group
                  optionType="button"
                  buttonStyle="solid"
                  options={ADMIN_USER_DETAIL_USER_STATES.map((userState) => ({
                    label: ADMIN_USER_DETAIL_USER_STATE_LABELS[userState],
                    value: userState,
                  }))}
                />
              </Form.Item>
            </EditableFormCard>
            <EditableFormCard>
              <Flex vertical gap={10}>
                <BilingualLabel title="访问组" subtitle="Access Group" />
                <Flex gap={4} wrap>
                  {detail.userInfo.accessGroup.length > 0
                    ? detail.userInfo.accessGroup.map((accessGroup) => (
                        <Tag key={accessGroup} color="blue">
                          {accessGroup}
                        </Tag>
                      ))
                    : '—'}
                </Flex>
              </Flex>
            </EditableFormCard>
            <EditableFormCard>
              <Form.Item<UserInfoSectionFormValues>
                label={<BilingualLabel title="邮箱" subtitle="Email" />}
                name="email"
                rules={[
                  {
                    validator: (_, value) => {
                      const email = normalizeOptionalTextValue(value);

                      if (!email) {
                        return Promise.resolve();
                      }

                      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
                        ? Promise.resolve()
                        : Promise.reject(new Error('请输入有效的邮箱地址。'));
                    },
                  },
                ]}
                style={{ marginBottom: 0 }}
              >
                <Input maxLength={128} />
              </Form.Item>
            </EditableFormCard>
            <EditableFormCard>
              <Form.Item<UserInfoSectionFormValues>
                label={<BilingualLabel title="手机号" subtitle="Phone" />}
                name="phone"
                style={{ marginBottom: 0 }}
              >
                <Input maxLength={32} />
              </Form.Item>
            </EditableFormCard>
            <EditableFormCard>
              <Form.Item<UserInfoSectionFormValues>
                label={<BilingualLabel title="性别" subtitle="Gender" />}
                name="gender"
                rules={[{ required: true, message: '请选择性别。' }]}
                style={{ marginBottom: 0 }}
              >
                <Radio.Group
                  optionType="button"
                  buttonStyle="solid"
                  options={ADMIN_USER_DETAIL_GENDERS.map((gender) => ({
                    label: ADMIN_USER_DETAIL_GENDER_LABELS[gender],
                    value: gender,
                  }))}
                />
              </Form.Item>
            </EditableFormCard>
            <EditableFormCard>
              <Form.Item<UserInfoSectionFormValues>
                label={<BilingualLabel title="出生日期" subtitle="Birth Date" />}
                name="birthDate"
                style={{ marginBottom: 0 }}
              >
                <DatePicker
                  allowClear
                  defaultPickerValue={DEFAULT_BIRTH_DATE_PICKER_VALUE}
                  format="YYYY-MM-DD"
                  placeholder="请选择日期"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </EditableFormCard>
            <EditableFormCard spanClassName="md:col-span-2">
              <Form.Item<UserInfoSectionFormValues>
                label={<BilingualLabel title="地址" subtitle="Address" />}
                name="address"
                style={{ marginBottom: 0 }}
              >
                <TextArea autoSize={{ minRows: 2, maxRows: 5 }} maxLength={255} />
              </Form.Item>
            </EditableFormCard>
            <EditableFormCard>
              <Form.Item<UserInfoSectionFormValues>
                label={<BilingualLabel title="地理位置" subtitle="Geographic" />}
                name="geographic"
                style={{ marginBottom: 0 }}
              >
                <Input maxLength={128} />
              </Form.Item>
            </EditableFormCard>
            <EditableFormCard spanClassName="md:col-span-2">
              <Form.Item<UserInfoSectionFormValues>
                label={<BilingualLabel title="个性签名" subtitle="Signature" />}
                name="signature"
                style={{ marginBottom: 0 }}
              >
                <TextArea autoSize={{ minRows: 2, maxRows: 4 }} maxLength={255} />
              </Form.Item>
            </EditableFormCard>
            <EditableFormCard spanClassName="md:col-span-2 xl:col-span-3">
              <Form.Item<UserInfoSectionFormValues>
                label={<BilingualLabel title="标签" subtitle="Tags" />}
                name="tags"
                style={{ marginBottom: 0 }}
              >
                <Select mode="tags" tokenSeparators={[',', '，']} open={false} />
              </Form.Item>
            </EditableFormCard>
          </div>
        </Form>
      </div>
    </EditableSectionShell>
  );
}

function UserInfoSectionViewer({
  section,
  onEdit,
}: {
  section: DetailSection;
  onEdit: () => void;
}) {
  return (
    <EditableSectionShell
      editLabel="编辑用户常用字段"
      editing={false}
      errorMessage={null}
      formId="user-info-section-form"
      onCancel={() => undefined}
      onEdit={onEdit}
      saveLabel=""
      saving={false}
    >
      <DetailSectionBlock section={section} />
    </EditableSectionShell>
  );
}

function StaffSectionEditor({
  departmentLoadErrorMessage,
  departmentOptions,
  detail,
  errorMessage,
  formId,
  onCancel,
  onEdit,
  onSubmit,
  saving,
}: {
  departmentLoadErrorMessage: string | null;
  departmentOptions: readonly AdminDepartmentOption[];
  detail: AdminUserDetail;
  errorMessage: string | null;
  formId: string;
  onCancel: () => void;
  onEdit: () => void;
  onSubmit: (values: StaffSectionFormValues) => Promise<void>;
  saving: boolean;
}) {
  const [form] = Form.useForm<StaffSectionFormValues>();
  const initialValues = useMemo<StaffSectionFormValues>(
    () => ({
      departmentId: detail.staff.departmentId ?? undefined,
      employmentStatus: detail.staff.employmentStatus,
      jobTitle: detail.staff.jobTitle ?? undefined,
      name: detail.staff.name,
      remark: detail.staff.remark ?? undefined,
    }),
    [detail.staff],
  );

  return (
    <EditableSectionShell
      editLabel="编辑 staff 常用字段"
      editing
      errorMessage={errorMessage}
      formId={formId}
      onCancel={onCancel}
      onEdit={onEdit}
      saveLabel="保存 staff 常用字段"
      saving={saving}
    >
      <div className="rounded-card border border-info-border bg-info-bg p-4">
        <Form<StaffSectionFormValues>
          id={formId}
          form={form}
          layout="vertical"
          requiredMark={false}
          initialValues={initialValues}
          onFinish={onSubmit}
          disabled={saving}
          key={`${detail.staff.id}-${detail.staff.updatedAt}-staff`}
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <EditableFormCard>
              <Form.Item<StaffSectionFormValues>
                label={<BilingualLabel title="在职状态" subtitle="Employment Status" />}
                name="employmentStatus"
                rules={[{ required: true, message: '请选择在职状态。' }]}
                style={{ marginBottom: 0 }}
              >
                <Radio.Group
                  optionType="button"
                  buttonStyle="solid"
                  options={ADMIN_USER_DETAIL_STAFF_EMPLOYMENT_STATUSES.map((employmentStatus) => ({
                    label: ADMIN_USER_DETAIL_STAFF_EMPLOYMENT_STATUS_LABELS[employmentStatus],
                    value: employmentStatus,
                  }))}
                />
              </Form.Item>
            </EditableFormCard>
            <EditableFormCard>
              <Form.Item<StaffSectionFormValues>
                label={<BilingualLabel title="姓名" subtitle="Name" />}
                name="name"
                rules={[
                  {
                    validator: (_, value) =>
                      normalizeRequiredTextValue(value ?? '')
                        ? Promise.resolve()
                        : Promise.reject(new Error('请输入姓名。')),
                  },
                ]}
                style={{ marginBottom: 0 }}
              >
                <Input maxLength={64} />
              </Form.Item>
            </EditableFormCard>
            <EditableFormCard>
              <Form.Item<StaffSectionFormValues>
                label={<BilingualLabel title="部门" subtitle="Department" />}
                name="departmentId"
                style={{ marginBottom: 0 }}
              >
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder={
                    departmentLoadErrorMessage ? '部门列表加载失败，当前不可修改' : '请选择部门'
                  }
                  disabled={Boolean(departmentLoadErrorMessage)}
                  options={departmentOptions.map((department) => ({
                    label: department.departmentName,
                    value: department.id,
                  }))}
                />
              </Form.Item>
              {departmentLoadErrorMessage ? (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {departmentLoadErrorMessage}
                </Typography.Text>
              ) : null}
            </EditableFormCard>
            <EditableFormCard>
              <Form.Item<StaffSectionFormValues>
                label={<BilingualLabel title="职务/职称" subtitle="Job Title" />}
                name="jobTitle"
                style={{ marginBottom: 0 }}
              >
                <Input maxLength={64} />
              </Form.Item>
            </EditableFormCard>
            <EditableFormCard spanClassName="md:col-span-2 xl:col-span-2">
              <Form.Item<StaffSectionFormValues>
                label={<BilingualLabel title="备注" subtitle="Remark" />}
                name="remark"
                style={{ marginBottom: 0 }}
              >
                <TextArea autoSize={{ minRows: 2, maxRows: 4 }} maxLength={255} />
              </Form.Item>
            </EditableFormCard>
          </div>
        </Form>
      </div>
    </EditableSectionShell>
  );
}

function StaffSectionViewer({ section, onEdit }: { section: DetailSection; onEdit: () => void }) {
  return (
    <EditableSectionShell
      editLabel="编辑 staff 常用字段"
      editing={false}
      errorMessage={null}
      formId="staff-section-form"
      onCancel={() => undefined}
      onEdit={onEdit}
      saveLabel=""
      saving={false}
    >
      <DetailSectionBlock section={section} />
    </EditableSectionShell>
  );
}

export function AdminUserDetailPageContent({
  accountId,
  loadDepartmentOptions,
  loadDetail,
  updateAccountSection,
  updateStaffSection,
  updateUserInfoSection,
}: AdminUserDetailPageContentProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [editingSection, setEditingSection] = useState<EditableSectionKey | null>(null);
  const [savingSection, setSavingSection] = useState<EditableSectionKey | null>(null);
  const [sectionErrors, setSectionErrors] = useState<SectionErrorState>(
    INITIAL_SECTION_ERROR_STATE,
  );
  const {
    applyAccountUpdate,
    applyStaffUpdate,
    applyUserInfoUpdate,
    errorMessage,
    hasLoaded,
    isLoading,
    result,
    retry,
  } = useAdminUserDetail(accountId, loadDetail);
  const { errorMessage: departmentLoadErrorMessage, options: departmentOptions } =
    useAdminDepartmentOptions(loadDepartmentOptions);
  const departmentMap = useMemo(
    () => new Map(departmentOptions.map((department) => [department.id, department])),
    [departmentOptions],
  );

  const accountSections = useMemo(
    () => (result ? buildAccountSectionGroup(result) : null),
    [result],
  );
  const userInfoSections = useMemo(
    () => (result ? buildUserInfoSectionGroup(result) : null),
    [result],
  );
  const staffSections = useMemo(
    () => (result ? buildStaffSectionGroup(result, departmentMap) : null),
    [departmentMap, result],
  );

  async function handleAccountSectionSubmit(values: AccountSectionFormValues) {
    if (!result || !values.identityHint) {
      return;
    }

    const hasChanged =
      values.status !== result.account.status ||
      values.identityHint !== result.account.identityHint;

    if (!hasChanged) {
      setSectionErrors((currentErrors) => ({ ...currentErrors, account: null }));
      setEditingSection(null);
      return;
    }

    setSavingSection('account');
    setSectionErrors((currentErrors) => ({ ...currentErrors, account: null }));

    try {
      const mutationResult = await updateAccountSection({
        accountId: result.account.id,
        identityHint: values.identityHint,
        status: values.status,
      });

      applyAccountUpdate(mutationResult.account);
      setEditingSection(null);
      void messageApi.success({
        content: `已更新账户 ${result.account.id} 的常用字段`,
        duration: 2,
      });
    } catch (error) {
      setSectionErrors((currentErrors) => ({
        ...currentErrors,
        account: error instanceof Error ? error.message : '账户常用字段保存失败。',
      }));
    } finally {
      setSavingSection(null);
    }
  }

  async function handleUserInfoSectionSubmit(values: UserInfoSectionFormValues) {
    if (!result) {
      return;
    }

    const normalizedNextValues = {
      address: normalizeOptionalTextValue(values.address),
      birthDate: normalizeBirthDateValue(values.birthDate),
      email: normalizeOptionalTextValue(values.email),
      gender: values.gender,
      geographic: normalizeOptionalTextValue(values.geographic),
      nickname: normalizeRequiredTextValue(values.nickname),
      phone: normalizeOptionalTextValue(values.phone),
      signature: normalizeOptionalTextValue(values.signature),
      tags: normalizeTagsValue(values.tags),
      userState: values.userState,
    };
    const normalizedCurrentValues = {
      address: normalizeOptionalTextValue(result.userInfo.address),
      birthDate: normalizeOptionalTextValue(result.userInfo.birthDate),
      email: normalizeOptionalTextValue(result.userInfo.email),
      gender: result.userInfo.gender,
      geographic: normalizeOptionalTextValue(result.userInfo.geographic),
      nickname: normalizeRequiredTextValue(result.userInfo.nickname),
      phone: normalizeOptionalTextValue(result.userInfo.phone),
      signature: normalizeOptionalTextValue(result.userInfo.signature),
      tags: normalizeTagsValue(result.userInfo.tags ?? []),
      userState: result.userInfo.userState,
    };

    const hasChanged =
      normalizedNextValues.address !== normalizedCurrentValues.address ||
      normalizedNextValues.birthDate !== normalizedCurrentValues.birthDate ||
      normalizedNextValues.email !== normalizedCurrentValues.email ||
      normalizedNextValues.gender !== normalizedCurrentValues.gender ||
      normalizedNextValues.geographic !== normalizedCurrentValues.geographic ||
      normalizedNextValues.nickname !== normalizedCurrentValues.nickname ||
      normalizedNextValues.phone !== normalizedCurrentValues.phone ||
      normalizedNextValues.signature !== normalizedCurrentValues.signature ||
      normalizedNextValues.userState !== normalizedCurrentValues.userState ||
      !areStringArraysEqual(normalizedNextValues.tags, normalizedCurrentValues.tags);

    if (!hasChanged) {
      setSectionErrors((currentErrors) => ({ ...currentErrors, userInfo: null }));
      setEditingSection(null);
      return;
    }

    setSavingSection('userInfo');
    setSectionErrors((currentErrors) => ({ ...currentErrors, userInfo: null }));

    try {
      const mutationResult = await updateUserInfoSection({
        accountId: result.account.id,
        ...normalizedNextValues,
      });

      applyUserInfoUpdate(mutationResult.userInfo);
      setEditingSection(null);
      void messageApi.success({
        content: `已更新账户 ${result.account.id} 的用户信息`,
        duration: 2,
      });
    } catch (error) {
      setSectionErrors((currentErrors) => ({
        ...currentErrors,
        userInfo: error instanceof Error ? error.message : '用户常用字段保存失败。',
      }));
    } finally {
      setSavingSection(null);
    }
  }

  async function handleStaffSectionSubmit(values: StaffSectionFormValues) {
    if (!result) {
      return;
    }

    const normalizedNextValues = {
      departmentId: normalizeOptionalTextValue(values.departmentId),
      employmentStatus: values.employmentStatus,
      jobTitle: normalizeOptionalTextValue(values.jobTitle),
      name: normalizeRequiredTextValue(values.name),
      remark: normalizeOptionalTextValue(values.remark),
    };
    const normalizedCurrentValues = {
      departmentId: normalizeOptionalTextValue(result.staff.departmentId),
      employmentStatus: result.staff.employmentStatus,
      jobTitle: normalizeOptionalTextValue(result.staff.jobTitle),
      name: normalizeRequiredTextValue(result.staff.name),
      remark: normalizeOptionalTextValue(result.staff.remark),
    };

    const hasChanged =
      normalizedNextValues.departmentId !== normalizedCurrentValues.departmentId ||
      normalizedNextValues.employmentStatus !== normalizedCurrentValues.employmentStatus ||
      normalizedNextValues.jobTitle !== normalizedCurrentValues.jobTitle ||
      normalizedNextValues.name !== normalizedCurrentValues.name ||
      normalizedNextValues.remark !== normalizedCurrentValues.remark;

    if (!hasChanged) {
      setSectionErrors((currentErrors) => ({ ...currentErrors, staff: null }));
      setEditingSection(null);
      return;
    }

    setSavingSection('staff');
    setSectionErrors((currentErrors) => ({ ...currentErrors, staff: null }));

    try {
      const mutationResult = await updateStaffSection({
        accountId: result.account.id,
        ...normalizedNextValues,
      });

      applyStaffUpdate(mutationResult.staff);
      setEditingSection(null);
      void messageApi.success({
        content: `已更新 staff ${result.staff.id} 的常用字段`,
        duration: 2,
      });
    } catch (error) {
      setSectionErrors((currentErrors) => ({
        ...currentErrors,
        staff: error instanceof Error ? error.message : 'staff 常用字段保存失败。',
      }));
    } finally {
      setSavingSection(null);
    }
  }

  function openSectionEditor(sectionKey: EditableSectionKey) {
    setSectionErrors((currentErrors) => ({
      ...currentErrors,
      [sectionKey]: null,
    }));
    setEditingSection(sectionKey);
  }

  function cancelSectionEditor(sectionKey: EditableSectionKey) {
    setSectionErrors((currentErrors) => ({
      ...currentErrors,
      [sectionKey]: null,
    }));
    setEditingSection((currentEditingSection) =>
      currentEditingSection === sectionKey ? null : currentEditingSection,
    );
  }

  return (
    <Flex vertical gap={24}>
      {messageContextHolder}

      <div className="flex flex-col gap-3">
        <Flex align="center" justify="space-between" gap={16} wrap>
          <div className="flex flex-col gap-2">
            <Flex align="center" gap={12} wrap>
              <Typography.Title level={2} style={{ marginBottom: 0 }}>
                用户详情
              </Typography.Title>
              <Typography.Text
                type="secondary"
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: 13,
                }}
              >
                User Detail
              </Typography.Text>
            </Flex>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0, maxWidth: 880 }}>
              当前已接好 `account(id)`、`userInfo(accountId)` 与 `staff(accountId)` 三块正式数据，
              常用字段支持按分区编辑与保存，关键字段和降级字段继续保持只读。
            </Typography.Paragraph>
          </div>
          <Button onClick={() => navigate({ pathname: '/admin/users', search: location.search })}>
            返回列表
          </Button>
        </Flex>
      </div>

      {!hasLoaded ? (
        <Skeleton active paragraph={{ rows: 12 }} />
      ) : errorMessage || !result || !accountSections || !userInfoSections || !staffSections ? (
        <Alert
          type="error"
          showIcon
          title="用户详情加载失败"
          description={errorMessage || '当前账户详情不可用。'}
          action={
            <Button size="small" type="link" onClick={retry}>
              重试
            </Button>
          }
        />
      ) : (
        <>
          <Card>
            <Flex align="center" gap={16} wrap>
              <Avatar size={64} src={result.userInfo.avatarUrl || undefined}>
                {result.userInfo.nickname?.trim()?.slice(0, 1) ||
                  String(result.account.id).slice(-2)}
              </Avatar>
              <Flex vertical gap={4}>
                <Flex align="center" gap={8} wrap>
                  <Typography.Title level={4} style={{ marginBottom: 0 }}>
                    {formatOptionalValue(result.userInfo.nickname)}
                  </Typography.Title>
                  <Tag color={getStatusTagColor(result.account.status)}>
                    {ADMIN_USER_DETAIL_ACCOUNT_STATUS_LABELS[result.account.status]}
                  </Tag>
                </Flex>
                <Typography.Text type="secondary">
                  账户 #{result.account.id} · {formatOptionalValue(result.account.loginName)}
                </Typography.Text>
                {result.userInfo.accessGroup.length > 0 ? (
                  <Flex gap={4} wrap>
                    {result.userInfo.accessGroup.map((accessGroup) => (
                      <Tag key={accessGroup} color="blue">
                        {accessGroup}
                      </Tag>
                    ))}
                  </Flex>
                ) : null}
              </Flex>
            </Flex>
          </Card>

          <Card title={<BilingualLabel title="账户信息" subtitle="Account" />}>
            <Flex vertical gap={20}>
              <DetailSectionBlock section={accountSections.fixed} />
              {editingSection === 'account' ? (
                <AccountSectionEditor
                  detail={result}
                  errorMessage={sectionErrors.account}
                  formId="account-section-form"
                  onCancel={() => cancelSectionEditor('account')}
                  onEdit={() => openSectionEditor('account')}
                  onSubmit={handleAccountSectionSubmit}
                  saving={savingSection === 'account'}
                />
              ) : (
                <AccountSectionViewer
                  section={accountSections.editable}
                  onEdit={() => openSectionEditor('account')}
                />
              )}
              <DetailSectionBlock section={accountSections.reference} />
            </Flex>
          </Card>

          <Card title={<BilingualLabel title="用户信息" subtitle="User Info" />}>
            <Flex vertical gap={20}>
              <DetailSectionBlock section={userInfoSections.fixed} />
              {editingSection === 'userInfo' ? (
                <UserInfoSectionEditor
                  detail={result}
                  errorMessage={sectionErrors.userInfo}
                  formId="user-info-section-form"
                  onCancel={() => cancelSectionEditor('userInfo')}
                  onEdit={() => openSectionEditor('userInfo')}
                  onSubmit={handleUserInfoSectionSubmit}
                  saving={savingSection === 'userInfo'}
                />
              ) : (
                <UserInfoSectionViewer
                  section={userInfoSections.editable}
                  onEdit={() => openSectionEditor('userInfo')}
                />
              )}
              <DetailSectionBlock section={userInfoSections.reference} />
            </Flex>
          </Card>

          <Card title={<BilingualLabel title="Staff 信息" subtitle="Staff" />}>
            <Flex vertical gap={20}>
              <DetailSectionBlock section={staffSections.fixed} />
              {editingSection === 'staff' ? (
                <StaffSectionEditor
                  departmentLoadErrorMessage={departmentLoadErrorMessage}
                  departmentOptions={departmentOptions}
                  detail={result}
                  errorMessage={sectionErrors.staff}
                  formId="staff-section-form"
                  onCancel={() => cancelSectionEditor('staff')}
                  onEdit={() => openSectionEditor('staff')}
                  onSubmit={handleStaffSectionSubmit}
                  saving={savingSection === 'staff'}
                />
              ) : (
                <StaffSectionViewer
                  section={staffSections.editable}
                  onEdit={() => openSectionEditor('staff')}
                />
              )}
              <DetailSectionBlock section={staffSections.reference} />
            </Flex>
          </Card>

          <Card title={<BilingualLabel title="最近登录" subtitle="Recent Login" />}>
            <RecentLoginList items={result.account.recentLoginHistory} />
          </Card>
        </>
      )}

      {hasLoaded && isLoading ? <Skeleton active paragraph={{ rows: 4 }} /> : null}
    </Flex>
  );
}
