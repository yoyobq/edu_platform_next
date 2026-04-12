import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  CloseOutlined,
  EditOutlined,
  LeftOutlined,
  LockOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Avatar,
  Button,
  Card,
  DatePicker,
  Flex,
  Form,
  Input,
  type InputRef,
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
  AdminUserDetailIdentityHint,
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
  UpdateAdminUserDetailAccountSectionCommand,
  UpdateAdminUserDetailAccountSectionResult,
  UpdateAdminUserDetailStaffSectionInput,
  UpdateAdminUserDetailStaffSectionResult,
  UpdateAdminUserDetailUserInfoSectionInput,
  UpdateAdminUserDetailUserInfoSectionResult,
} from '../application/update-admin-user-detail-sections';
import {
  assertAdminUserDetailIdentityHintAllowed,
  isAdminUserDetailIdentityHintAllowed,
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
const EDITABLE_ACCESS_GROUPS = [
  'ADMIN',
  'STAFF',
  'GUEST',
] as const satisfies readonly AuthAccessGroup[];

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
    input: UpdateAdminUserDetailAccountSectionCommand,
  ) => Promise<UpdateAdminUserDetailAccountSectionResult>;
  updateStaffSection: (
    input: UpdateAdminUserDetailStaffSectionInput,
  ) => Promise<UpdateAdminUserDetailStaffSectionResult>;
  updateUserInfoSection: (
    input: UpdateAdminUserDetailUserInfoSectionInput,
  ) => Promise<UpdateAdminUserDetailUserInfoSectionResult>;
};

type AccountSectionFormValues = {
  identityHint?: AdminUserDetailIdentityHint;
  status: AdminUserDetailAccountStatus;
};

type UserInfoSectionFormValues = {
  accessGroup: AuthAccessGroup[];
  address?: string;
  birthDate?: Dayjs | null;
  email?: string;
  gender: AdminUserDetailGender;
  geographicCity?: string;
  geographicProvince?: string;
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

function hasLockedAccessGroup(accessGroup: readonly AuthAccessGroup[]) {
  return accessGroup.includes('REGISTRANT');
}

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

function parseGeographicValue(
  value:
    | {
        city: string | null;
        province: string | null;
      }
    | string
    | null
    | undefined,
) {
  if (!value) {
    return {
      city: null,
      province: null,
    };
  }

  if (typeof value === 'object') {
    return {
      city: typeof value.city === 'string' && value.city.trim() ? value.city.trim() : null,
      province:
        typeof value.province === 'string' && value.province.trim() ? value.province.trim() : null,
    };
  }

  try {
    const parsedValue = JSON.parse(value) as { city?: unknown; province?: unknown };

    return {
      city:
        typeof parsedValue.city === 'string' && parsedValue.city.trim()
          ? parsedValue.city.trim()
          : null,
      province:
        typeof parsedValue.province === 'string' && parsedValue.province.trim()
          ? parsedValue.province.trim()
          : null,
    };
  } catch {
    return {
      city: null,
      province: value.trim() || null,
    };
  }
}

function buildGeographicInput(value: { city?: string | null; province?: string | null }) {
  const city = normalizeOptionalTextValue(value.city);
  const province = normalizeOptionalTextValue(value.province);

  if (!city && !province) {
    return null;
  }

  return {
    ...(province ? { province } : {}),
    ...(city ? { city } : {}),
  };
}

function formatGeographicValue(
  value:
    | {
        city: string | null;
        province: string | null;
      }
    | string
    | null
    | undefined,
) {
  const parsedValue = parseGeographicValue(value);

  return [parsedValue.province, parsedValue.city].filter(Boolean).join(' / ') || '—';
}

function normalizeAccessGroupValue(accessGroup: readonly AuthAccessGroup[]) {
  return Array.from(new Set(accessGroup));
}

function toggleEditableAccessGroup(
  currentValue: readonly AuthAccessGroup[],
  targetValue: (typeof EDITABLE_ACCESS_GROUPS)[number],
) {
  const nextValueSet = new Set(currentValue);
  const hasTargetValue = nextValueSet.has(targetValue);

  if (hasTargetValue) {
    nextValueSet.delete(targetValue);
    return normalizeAccessGroupValue(Array.from(nextValueSet));
  }

  if (targetValue === 'GUEST') {
    nextValueSet.delete('ADMIN');
    nextValueSet.delete('STAFF');
    nextValueSet.add('GUEST');
    return normalizeAccessGroupValue(Array.from(nextValueSet));
  }

  nextValueSet.delete('GUEST');
  nextValueSet.add(targetValue);

  return normalizeAccessGroupValue(Array.from(nextValueSet));
}

function buildIdentityHintOptions(accessGroup: readonly AuthAccessGroup[]) {
  return ADMIN_USER_DETAIL_IDENTITY_HINTS.map((identityHint) => ({
    disabled: !isAdminUserDetailIdentityHintAllowed(accessGroup, identityHint),
    label: identityHint,
    value: identityHint,
  }));
}

function getAccessGroupTagTone(
  accessGroup: (typeof EDITABLE_ACCESS_GROUPS)[number],
  checked: boolean,
) {
  if (!checked) {
    return {
      backgroundColor: '#f5f5f5',
      borderColor: '#d9d9d9',
      color: '#8c8c8c',
    } satisfies CSSProperties;
  }

  switch (accessGroup) {
    case 'ADMIN':
      return {
        backgroundColor: '#fff1f0',
        borderColor: '#ffb3b3',
        color: '#b42318',
      } satisfies CSSProperties;
    case 'STAFF':
      return {
        backgroundColor: '#e6f4ff',
        borderColor: '#91caff',
        color: '#0958d9',
      } satisfies CSSProperties;
    case 'GUEST':
    default:
      return {
        backgroundColor: '#f6ffed',
        borderColor: '#b7eb8f',
        color: '#389e0d',
      } satisfies CSSProperties;
  }
}

function AccessGroupTagGroup({
  disabled = false,
  onToggle,
  value,
}: {
  disabled?: boolean;
  onToggle?: (nextValue: AuthAccessGroup[]) => void;
  value: readonly AuthAccessGroup[];
}) {
  const normalizedValue = normalizeAccessGroupValue(value);

  return (
    <Flex gap={8} wrap>
      {EDITABLE_ACCESS_GROUPS.map((accessGroup) => {
        const checked = normalizedValue.includes(accessGroup);
        const toneStyle = getAccessGroupTagTone(accessGroup, checked);

        return (
          <Tag.CheckableTag
            key={accessGroup}
            aria-pressed={checked}
            checked={checked}
            data-testid={`access-group-tag-${accessGroup}`}
            onChange={() => {
              if (disabled) {
                return;
              }

              onToggle?.(toggleEditableAccessGroup(normalizedValue, accessGroup));
            }}
            style={{
              ...toneStyle,
              borderWidth: 1,
              borderStyle: 'solid',
              cursor: onToggle && !disabled ? 'pointer' : 'default',
              opacity: disabled ? 0.72 : 1,
              marginInlineEnd: 0,
              userSelect: 'none',
            }}
          >
            {accessGroup}
          </Tag.CheckableTag>
        );
      })}
    </Flex>
  );
}

function AccessGroupDisplayTags({ value }: { value: readonly AuthAccessGroup[] }) {
  if (value.length === 0) {
    return '—';
  }

  return (
    <Flex gap={4} wrap>
      {value.map((accessGroup) => (
        <Tag key={accessGroup} color={accessGroup === 'REGISTRANT' ? 'gold' : 'blue'}>
          {accessGroup}
        </Tag>
      ))}
    </Flex>
  );
}

function UserTagsDisplay({ value }: { value: readonly string[] | null | undefined }) {
  const normalizedValue = normalizeTagsValue(value ?? []);

  if (normalizedValue.length === 0) {
    return '—';
  }

  return (
    <Flex gap={6} wrap>
      {normalizedValue.map((tag) => (
        <Tag key={tag} color="cyan">
          {tag}
        </Tag>
      ))}
    </Flex>
  );
}

function UserTagsEditor({
  disabled = false,
  onChange,
  value,
}: {
  disabled?: boolean;
  onChange?: (nextValue: string[]) => void;
  value?: readonly string[];
}) {
  const normalizedValue = normalizeTagsValue(value ?? []);
  const [draftValue, setDraftValue] = useState('');
  const [isInputVisible, setIsInputVisible] = useState(false);
  const inputRef = useRef<InputRef | null>(null);

  const pendingTags = normalizeTagsValue(draftValue.split(/[,\n，]+/));
  const hasPendingTags = pendingTags.length > 0;

  useEffect(() => {
    if (isInputVisible) {
      inputRef.current?.focus();
    }
  }, [isInputVisible]);

  function openInput() {
    if (disabled) {
      return;
    }

    setIsInputVisible(true);
  }

  function closeInput() {
    setDraftValue('');
    setIsInputVisible(false);
  }

  function handleAddTags() {
    if (disabled) {
      return;
    }

    if (!hasPendingTags) {
      closeInput();
      return;
    }

    onChange?.(normalizeTagsValue([...normalizedValue, ...pendingTags]));
    closeInput();
  }

  function handleRemoveTag(tagToRemove: string) {
    if (disabled) {
      return;
    }

    onChange?.(normalizedValue.filter((tag) => tag !== tagToRemove));
  }

  return (
    <Flex align="center" gap={8} wrap>
      {normalizedValue.map((tag) => (
        <Tag
          key={tag}
          style={{
            alignItems: 'center',
            display: 'inline-flex',
            gap: 2,
            marginInlineEnd: 0,
            paddingInlineEnd: 4,
          }}
        >
          {tag}
          <Button
            aria-label={`删除标签 ${tag}`}
            disabled={disabled}
            icon={<CloseOutlined />}
            onClick={() => handleRemoveTag(tag)}
            size="small"
            type="text"
            style={{
              color: 'var(--ant-color-text-secondary)',
              height: 18,
              minWidth: 18,
              paddingInline: 0,
            }}
          />
        </Tag>
      ))}
      {isInputVisible ? (
        <Input
          aria-label="标签输入"
          disabled={disabled}
          maxLength={32}
          onBlur={handleAddTags}
          onChange={(event) => setDraftValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              closeInput();
            }
          }}
          onPressEnter={(event) => {
            event.preventDefault();
            handleAddTags();
          }}
          placeholder="输入标签"
          ref={inputRef}
          size="small"
          style={{ width: 140 }}
          value={draftValue}
        />
      ) : (
        <Button
          aria-label="新增标签"
          disabled={disabled}
          icon={<PlusOutlined />}
          onClick={openInput}
          shape="circle"
          size="small"
          type="dashed"
        />
      )}
    </Flex>
  );
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
    <Flex align="center" gap={8} wrap="wrap">
      <Typography.Text
        type="secondary"
        style={compact ? { fontSize: 12, lineHeight: 1.2 } : { fontWeight: 500 }}
      >
        {title}
      </Typography.Text>
      <Typography.Text
        type="secondary"
        style={{
          fontSize: compact ? 11 : 12,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          lineHeight: 1.2,
          opacity: 0.6,
        }}
      >
        {subtitle}
      </Typography.Text>
    </Flex>
  );
}

function ReadonlyValue({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <LockOutlined style={{ fontSize: 11, color: 'var(--ant-color-text-quaternary)' }} />
      <span
        className="font-mono text-sm font-medium"
        style={{ letterSpacing: '-0.01em', color: 'var(--ant-color-text)' }}
      >
        {children}
      </span>
    </div>
  );
}

function getSectionToneStyle(tone: DetailSection['tone']) {
  switch (tone) {
    case 'editable':
      return {
        bodyClassName: '',
        gridClassName: 'grid gap-x-6 gap-y-6 md:grid-cols-2 xl:grid-cols-3',
        itemClassName: '',
        itemStyle: undefined,
        valueClassName: 'text-sm font-medium',
        valueStyle: undefined,
      };
    case 'reference':
      return {
        bodyClassName: 'border-t border-border pt-4',
        bodyStyle: undefined,
        gridClassName: 'grid gap-x-6 gap-y-3 md:grid-cols-2 xl:grid-cols-4',
        itemClassName: '',
        itemStyle: undefined,
        valueClassName: 'text-xs font-mono',
        valueStyle: { color: 'var(--ant-color-text-secondary)' } as CSSProperties,
      };
    case 'fixed':
    default:
      return {
        bodyClassName: '',
        gridClassName: 'grid gap-x-6 gap-y-4 md:grid-cols-2',
        itemClassName: '',
        itemStyle: undefined,
        valueClassName: 'text-sm font-medium',
        valueStyle: { color: 'var(--ant-color-text)' } as CSSProperties,
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
        <div key={item.key} className={`flex flex-col gap-1.5 ${itemClassName}`} style={itemStyle}>
          <div className="text-xs text-text-secondary">{item.label}</div>
          <div className={valueClassName} style={valueStyle}>
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
    <div className={toneStyle.bodyClassName} style={toneStyle.bodyStyle}>
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
      <Flex align="center" gap={8} justify="flex-end">
        {editing ? (
          <Flex gap={8}>
            <Button onClick={onCancel}>取消</Button>
            <Button type="primary" htmlType="submit" form={formId} loading={saving}>
              {saveLabel}
            </Button>
          </Flex>
        ) : (
          <Button icon={<EditOutlined />} onClick={onEdit} aria-label={editLabel} size="small">
            编辑
          </Button>
        )}
      </Flex>
      {errorMessage ? <Alert type="error" showIcon message={errorMessage} /> : null}
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
      <div className="flex h-full flex-col justify-start">{children}</div>
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
          value: <AccessGroupDisplayTags value={detail.userInfo.accessGroup} />,
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
          value: formatGeographicValue(detail.userInfo.geographic),
        },
        {
          key: 'signature',
          label: <BilingualLabel title="个性签名" subtitle="Signature" />,
          value: formatOptionalValue(detail.userInfo.signature),
        },
        {
          key: 'tags',
          label: <BilingualLabel title="标签" subtitle="Tags" />,
          value: <UserTagsDisplay value={detail.userInfo.tags} />,
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
    return <Alert type="info" showIcon message="后端当前未返回最近登录记录。" />;
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

function SkeletonBar({ height, width }: { height: number; width: number | string }) {
  return (
    <div style={{ width, maxWidth: '100%' }}>
      <Skeleton.Button active size="small" style={{ width: '100%', height }} />
    </div>
  );
}

function DetailFieldSkeleton({
  labelWidth,
  valueWidth,
}: {
  labelWidth: number;
  valueWidth: number | string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <SkeletonBar height={12} width={labelWidth} />
      <SkeletonBar height={18} width={valueWidth} />
    </div>
  );
}

function DetailCardSkeleton({
  editableFields,
  fixedFields,
  referenceFields,
  titleWidth,
  minHeight,
}: {
  editableFields: readonly { labelWidth: number; valueWidth: number | string }[];
  fixedFields: readonly { labelWidth: number; valueWidth: number | string }[];
  referenceFields: readonly { labelWidth: number; valueWidth: number | string }[];
  titleWidth: number;
  minHeight: number;
}) {
  return (
    <div className="rounded-card shadow-card">
      <Card
        title={
          <Flex align="center" gap={8} wrap="wrap">
            <SkeletonBar height={16} width={titleWidth} />
            <SkeletonBar height={12} width={96} />
          </Flex>
        }
        styles={{ body: { minHeight, padding: 24 } }}
      >
        <Flex vertical gap={24}>
          <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
            {fixedFields.map((field, index) => (
              <DetailFieldSkeleton
                key={`fixed-${titleWidth}-${index}`}
                labelWidth={field.labelWidth}
                valueWidth={field.valueWidth}
              />
            ))}
          </div>

          <div className="rounded-block border border-border p-4">
            <Flex align="center" gap={8} justify="flex-end">
              <SkeletonBar height={28} width={60} />
            </Flex>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {editableFields.map((field, index) => (
                <DetailFieldSkeleton
                  key={`editable-${titleWidth}-${index}`}
                  labelWidth={field.labelWidth}
                  valueWidth={field.valueWidth}
                />
              ))}
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <div className="grid gap-x-6 gap-y-3 md:grid-cols-2 xl:grid-cols-4">
              {referenceFields.map((field, index) => (
                <DetailFieldSkeleton
                  key={`reference-${titleWidth}-${index}`}
                  labelWidth={field.labelWidth}
                  valueWidth={field.valueWidth}
                />
              ))}
            </div>
          </div>
        </Flex>
      </Card>
    </div>
  );
}

function SidebarCardSkeleton({
  minHeight,
  rows,
  titleWidth,
}: {
  minHeight: number;
  rows: number;
  titleWidth: number;
}) {
  return (
    <div className="rounded-card shadow-card">
      <Card
        title={<SkeletonBar height={16} width={titleWidth} />}
        styles={{ body: { minHeight, padding: 16 } }}
      >
        <div className="flex flex-col gap-4">
          {Array.from({ length: rows }, (_, index) => (
            <div key={`${titleWidth}-${index}`} className="flex flex-col gap-2">
              <SkeletonBar height={12} width={index % 2 === 0 ? 72 : 88} />
              <SkeletonBar
                height={18}
                width={index === rows - 1 ? '58%' : index % 2 === 0 ? '72%' : '86%'}
              />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function AdminUserDetailLoadingSkeleton() {
  return (
    <>
      <div
        className="rounded-block border border-border bg-bg-container p-6 shadow-card"
        style={{ minHeight: 164 }}
      >
        <Flex align="start" gap={24}>
          <Skeleton.Avatar active shape="circle" size={72} />
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <Flex align="center" gap={8} wrap>
              <SkeletonBar height={28} width={180} />
              <SkeletonBar height={24} width={72} />
              <SkeletonBar height={24} width={92} />
            </Flex>

            <div className="grid grid-cols-2 gap-x-6 gap-y-3 xl:grid-cols-4">
              <DetailFieldSkeleton labelWidth={56} valueWidth={84} />
              <DetailFieldSkeleton labelWidth={40} valueWidth={96} />
              <DetailFieldSkeleton labelWidth={48} valueWidth={132} />
              <DetailFieldSkeleton labelWidth={56} valueWidth={88} />
            </div>

            <Flex gap={6} wrap>
              <SkeletonBar height={22} width={68} />
              <SkeletonBar height={22} width={78} />
              <SkeletonBar height={22} width={62} />
            </Flex>
          </div>
        </Flex>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <DetailCardSkeleton
            minHeight={360}
            titleWidth={124}
            fixedFields={[
              { labelWidth: 68, valueWidth: '54%' },
              { labelWidth: 64, valueWidth: '44%' },
              { labelWidth: 56, valueWidth: '62%' },
              { labelWidth: 72, valueWidth: '48%' },
            ]}
            editableFields={[
              { labelWidth: 72, valueWidth: '78%' },
              { labelWidth: 66, valueWidth: '70%' },
              { labelWidth: 60, valueWidth: '64%' },
            ]}
            referenceFields={[
              { labelWidth: 64, valueWidth: '72%' },
              { labelWidth: 48, valueWidth: '58%' },
              { labelWidth: 72, valueWidth: '68%' },
              { labelWidth: 56, valueWidth: '52%' },
            ]}
          />

          <DetailCardSkeleton
            minHeight={456}
            titleWidth={136}
            fixedFields={[
              { labelWidth: 56, valueWidth: '48%' },
              { labelWidth: 68, valueWidth: '60%' },
              { labelWidth: 52, valueWidth: '72%' },
              { labelWidth: 64, valueWidth: '54%' },
            ]}
            editableFields={[
              { labelWidth: 52, valueWidth: '66%' },
              { labelWidth: 62, valueWidth: '74%' },
              { labelWidth: 64, valueWidth: '82%' },
              { labelWidth: 48, valueWidth: '58%' },
              { labelWidth: 40, valueWidth: '52%' },
              { labelWidth: 60, valueWidth: '88%' },
            ]}
            referenceFields={[
              { labelWidth: 64, valueWidth: '68%' },
              { labelWidth: 60, valueWidth: '52%' },
              { labelWidth: 56, valueWidth: '62%' },
              { labelWidth: 72, valueWidth: '46%' },
            ]}
          />

          <DetailCardSkeleton
            minHeight={372}
            titleWidth={148}
            fixedFields={[
              { labelWidth: 52, valueWidth: '56%' },
              { labelWidth: 64, valueWidth: '44%' },
              { labelWidth: 56, valueWidth: '58%' },
              { labelWidth: 68, valueWidth: '50%' },
            ]}
            editableFields={[
              { labelWidth: 62, valueWidth: '70%' },
              { labelWidth: 54, valueWidth: '76%' },
              { labelWidth: 60, valueWidth: '64%' },
              { labelWidth: 48, valueWidth: '86%' },
            ]}
            referenceFields={[
              { labelWidth: 56, valueWidth: '60%' },
              { labelWidth: 68, valueWidth: '54%' },
              { labelWidth: 52, valueWidth: '66%' },
              { labelWidth: 64, valueWidth: '48%' },
            ]}
          />
        </div>

        <div className="flex flex-col gap-6">
          <SidebarCardSkeleton minHeight={248} rows={5} titleWidth={82} />
          <SidebarCardSkeleton minHeight={272} rows={4} titleWidth={116} />
        </div>
      </div>
    </>
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
  const identityHintOptions = useMemo(
    () => buildIdentityHintOptions(detail.userInfo.accessGroup),
    [detail.userInfo.accessGroup],
  );
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
        <div className="grid gap-4 md:grid-cols-2">
          <EditableFormCard spanClassName="md:col-span-2">
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
          <EditableFormCard spanClassName="md:col-span-2">
            <Form.Item<AccountSectionFormValues>
              label={<BilingualLabel title="身份提示" subtitle="Identity Hint" />}
              name="identityHint"
              rules={[{ required: true, message: '请选择身份提示。' }]}
              style={{ marginBottom: 0 }}
            >
              <Radio.Group optionType="button" buttonStyle="solid" options={identityHintOptions} />
            </Form.Item>
          </EditableFormCard>
          <EditableFormCard>
            <Flex vertical gap={8}>
              <BilingualLabel title="登录名" subtitle="Login Name" />
              <Input value={detail.account.loginName ?? ''} disabled />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                当前暂不支持修改。
              </Typography.Text>
            </Flex>
          </EditableFormCard>
        </div>
      </Form>
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
  const isAccessGroupLocked = hasLockedAccessGroup(detail.userInfo.accessGroup);
  const [accessGroupValue, setAccessGroupValue] = useState<AuthAccessGroup[]>([
    ...detail.userInfo.accessGroup,
  ]);
  const geographicValue = useMemo(
    () => parseGeographicValue(detail.userInfo.geographic),
    [detail.userInfo.geographic],
  );
  const initialValues = useMemo<UserInfoSectionFormValues>(
    () => ({
      accessGroup: [...detail.userInfo.accessGroup],
      address: detail.userInfo.address ?? undefined,
      birthDate: toBirthDatePickerValue(detail.userInfo.birthDate),
      email: detail.userInfo.email ?? undefined,
      gender: detail.userInfo.gender,
      geographicCity: geographicValue.city ?? undefined,
      geographicProvince: geographicValue.province ?? undefined,
      nickname: detail.userInfo.nickname,
      phone: detail.userInfo.phone ?? undefined,
      signature: detail.userInfo.signature ?? undefined,
      tags: detail.userInfo.tags ? [...detail.userInfo.tags] : [],
      userState: detail.userInfo.userState,
    }),
    [detail.userInfo, geographicValue.city, geographicValue.province],
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
      <Form<UserInfoSectionFormValues>
        id={formId}
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={initialValues}
        onFinish={(values) => onSubmit({ ...values, accessGroup: accessGroupValue })}
        disabled={saving}
        key={`${detail.userInfo.id}-${detail.userInfo.updatedAt}-user-info`}
      >
        <div className="grid gap-4 md:grid-cols-2">
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
          <EditableFormCard spanClassName="md:col-span-2">
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
          <EditableFormCard spanClassName="md:col-span-2">
            <Form.Item<UserInfoSectionFormValues>
              label={<BilingualLabel title="访问组" subtitle="Access Group" />}
              style={{ marginBottom: 0 }}
            >
              {isAccessGroupLocked ? (
                <Flex vertical gap={8}>
                  <AccessGroupDisplayTags value={accessGroupValue} />
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    当前含 REGISTRANT，前端不支持修改访问组。
                  </Typography.Text>
                </Flex>
              ) : (
                <AccessGroupTagGroup value={accessGroupValue} onToggle={setAccessGroupValue} />
              )}
            </Form.Item>
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
          <EditableFormCard spanClassName="md:col-span-2">
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
              label={<BilingualLabel title="省/州" subtitle="Province" />}
              name="geographicProvince"
              style={{ marginBottom: 0 }}
            >
              <Input maxLength={128} />
            </Form.Item>
          </EditableFormCard>
          <EditableFormCard>
            <Form.Item<UserInfoSectionFormValues>
              label={<BilingualLabel title="城市" subtitle="City" />}
              name="geographicCity"
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
          <EditableFormCard spanClassName="md:col-span-2">
            <Form.Item<UserInfoSectionFormValues>
              label={<BilingualLabel title="标签" subtitle="Tags" />}
              name="tags"
              style={{ marginBottom: 0 }}
            >
              <UserTagsEditor />
            </Form.Item>
          </EditableFormCard>
        </div>
      </Form>
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
        <div className="grid gap-4 md:grid-cols-2">
          <EditableFormCard spanClassName="md:col-span-2">
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
          <EditableFormCard spanClassName="md:col-span-2">
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

    try {
      assertAdminUserDetailIdentityHintAllowed(result.userInfo.accessGroup, values.identityHint);
    } catch (error) {
      setSectionErrors((currentErrors) => ({
        ...currentErrors,
        account: error instanceof Error ? error.message : '身份提示校验失败。',
      }));
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
        accessGroup: result.userInfo.accessGroup,
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

    const isAccessGroupLocked = hasLockedAccessGroup(result.userInfo.accessGroup);
    const normalizedCurrentAccessGroup = normalizeAccessGroupValue(result.userInfo.accessGroup);
    const normalizedNextAccessGroup = normalizeAccessGroupValue(values.accessGroup);
    const shouldUpdateAccessGroup =
      !isAccessGroupLocked &&
      !areStringArraysEqual(normalizedNextAccessGroup, normalizedCurrentAccessGroup);
    const normalizedNextValues = {
      accessGroup: shouldUpdateAccessGroup ? normalizedNextAccessGroup : undefined,
      address: normalizeOptionalTextValue(values.address),
      birthDate: normalizeBirthDateValue(values.birthDate),
      email: normalizeOptionalTextValue(values.email),
      gender: values.gender,
      geographic: buildGeographicInput({
        city: values.geographicCity,
        province: values.geographicProvince,
      }),
      nickname: normalizeRequiredTextValue(values.nickname),
      phone: normalizeOptionalTextValue(values.phone),
      signature: normalizeOptionalTextValue(values.signature),
      tags: normalizeTagsValue(values.tags),
      userState: values.userState,
    };
    const normalizedCurrentGeographic = buildGeographicInput(
      parseGeographicValue(result.userInfo.geographic),
    );
    const normalizedCurrentValues = {
      address: normalizeOptionalTextValue(result.userInfo.address),
      birthDate: normalizeOptionalTextValue(result.userInfo.birthDate),
      email: normalizeOptionalTextValue(result.userInfo.email),
      gender: result.userInfo.gender,
      nickname: normalizeRequiredTextValue(result.userInfo.nickname),
      phone: normalizeOptionalTextValue(result.userInfo.phone),
      signature: normalizeOptionalTextValue(result.userInfo.signature),
      tags: normalizeTagsValue(result.userInfo.tags ?? []),
      userState: result.userInfo.userState,
    };

    const hasChanged =
      shouldUpdateAccessGroup ||
      normalizedNextValues.address !== normalizedCurrentValues.address ||
      normalizedNextValues.birthDate !== normalizedCurrentValues.birthDate ||
      normalizedNextValues.email !== normalizedCurrentValues.email ||
      normalizedNextValues.gender !== normalizedCurrentValues.gender ||
      JSON.stringify(normalizedNextValues.geographic) !==
        JSON.stringify(normalizedCurrentGeographic) ||
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

      applyAccountUpdate(mutationResult.account);
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
    <div className="mx-auto flex max-w-350 flex-col gap-6 pb-6">
      {messageContextHolder}

      {/* Top Bar — 返回 + 页面标题 */}
      <Flex align="center" gap={12}>
        <Button
          type="text"
          icon={<LeftOutlined />}
          onClick={() => navigate({ pathname: '/admin/users', search: location.search })}
        >
          用户列表
        </Button>
      </Flex>

      {/* Profile Header */}
      {result ? (
        <div className="rounded-block border border-border bg-bg-container p-6 shadow-card">
          <Flex gap={24} align="start">
            {/* Avatar */}
            <div className="relative shrink-0">
              <Avatar
                size={72}
                src={result.userInfo.avatarUrl || undefined}
                style={{
                  border: '3px solid var(--ant-color-bg-container)',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                {result.userInfo.nickname?.trim()?.slice(0, 1) ||
                  String(result.account.id).slice(-2)}
              </Avatar>
              <div
                className={`absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full ${
                  result.account.status === 'ACTIVE' ? 'bg-success' : 'bg-fill-secondary'
                }`}
                style={{ border: '3px solid var(--ant-color-bg-container)' }}
                title={result.account.status}
              />
            </div>

            {/* Identity Info */}
            <div className="flex min-w-0 flex-1 flex-col gap-4">
              {/* Row 1: Name + Status */}
              <Flex align="center" gap={8} wrap>
                <Typography.Title level={3} style={{ margin: 0 }}>
                  {formatOptionalValue(result.userInfo.nickname)}
                </Typography.Title>
                <Tag color={getStatusTagColor(result.account.status)}>
                  {ADMIN_USER_DETAIL_ACCOUNT_STATUS_LABELS[result.account.status]}
                </Tag>
                {result.staff?.id && (
                  <Tag color={getStatusTagColor(result.staff.employmentStatus)}>
                    {
                      ADMIN_USER_DETAIL_STAFF_EMPLOYMENT_STATUS_LABELS[
                        result.staff.employmentStatus
                      ]
                    }
                  </Tag>
                )}
              </Flex>

              {/* Row 2: Key identifiers with labels */}
              <div className="grid gap-x-6 gap-y-2 grid-cols-2 xl:grid-cols-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-text-secondary">账户 ID</span>
                  <span className="font-mono text-sm">{result.account.id}</span>
                </div>
                {result.staff?.id && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-text-secondary">工号</span>
                    <span className="font-mono text-sm">{result.staff.id}</span>
                  </div>
                )}
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-text-secondary">登录名</span>
                  <span className="text-sm">{formatOptionalValue(result.account.loginName)}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-text-secondary">身份提示</span>
                  <span className="text-sm">
                    {formatOptionalValue(result.account.identityHint)}
                  </span>
                </div>
              </div>

              {/* Row 3: Access Group Tags */}
              <Flex gap={4} wrap>
                {result.userInfo.accessGroup.map((group) => (
                  <Tag
                    key={group}
                    color={group === 'REGISTRANT' ? 'gold' : 'blue'}
                    style={{ margin: 0 }}
                  >
                    {group}
                  </Tag>
                ))}
              </Flex>
            </div>
          </Flex>
        </div>
      ) : null}

      {!hasLoaded ? (
        <AdminUserDetailLoadingSkeleton />
      ) : errorMessage || !result || !accountSections || !userInfoSections || !staffSections ? (
        <Alert
          type="error"
          showIcon
          message="无法加载用户详情"
          description={errorMessage || '账户信息获取失败'}
          action={
            <Button size="small" type="primary" onClick={retry}>
              立即重试
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main content - Left Column (2/3) */}
          <div className="flex flex-col gap-6 lg:col-span-2">
            {/* Account Section */}
            <div className="rounded-card shadow-card">
              <Card
                styles={{ body: { padding: 24 } }}
                title={<BilingualLabel title="账户配置" subtitle="Account Settings" />}
              >
                <Flex vertical gap={24}>
                  <DetailSectionBlock section={accountSections.fixed} />
                  <div
                    className={`rounded-block border border-border transition-colors duration-150 ${
                      editingSection === 'account'
                        ? 'bg-fill-secondary p-6'
                        : 'p-4 hover:bg-fill-hover'
                    }`}
                  >
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
                  </div>
                  <DetailSectionBlock section={accountSections.reference} />
                </Flex>
              </Card>
            </div>

            {/* User Info Section */}
            <div className="rounded-card shadow-card">
              <Card
                styles={{ body: { padding: 24 } }}
                title={<BilingualLabel title="个人背景" subtitle="Personal Profile" />}
              >
                <Flex vertical gap={24}>
                  <DetailSectionBlock section={userInfoSections.fixed} />
                  <div
                    className={`rounded-block border border-border transition-colors duration-150 ${
                      editingSection === 'userInfo'
                        ? 'bg-fill-secondary p-6'
                        : 'p-4 hover:bg-fill-hover'
                    }`}
                  >
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
                  </div>
                  <DetailSectionBlock section={userInfoSections.reference} />
                </Flex>
              </Card>
            </div>

            {/* Staff Info Section */}
            <div className="rounded-card shadow-card">
              <Card
                styles={{ body: { padding: 24 } }}
                title={<BilingualLabel title="Staff 职业信息" subtitle="Staff Identity" />}
              >
                <Flex vertical gap={24}>
                  <DetailSectionBlock section={staffSections.fixed} />
                  <div
                    className={`rounded-block border border-border transition-colors duration-150 ${
                      editingSection === 'staff'
                        ? 'bg-fill-secondary p-6'
                        : 'p-4 hover:bg-fill-hover'
                    }`}
                  >
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
                  </div>
                  <DetailSectionBlock section={staffSections.reference} />
                </Flex>
              </Card>
            </div>
          </div>

          {/* Sidebar - Right Column (1/3) */}
          <div className="flex flex-col gap-6">
            {/* 快速识别卡 — 运营人员滚动主内容时侧边常驻可见的关键信息 */}
            <div className="rounded-card shadow-card">
              <Card title="快速识别" styles={{ body: { padding: 16 } }}>
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-text-secondary">账户状态</span>
                      <div>
                        <Tag color={getStatusTagColor(result.account.status)}>
                          {ADMIN_USER_DETAIL_ACCOUNT_STATUS_LABELS[result.account.status]}
                        </Tag>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-text-secondary">在职状态</span>
                      <div>
                        <Tag color={getStatusTagColor(result.staff.employmentStatus)}>
                          {
                            ADMIN_USER_DETAIL_STAFF_EMPLOYMENT_STATUS_LABELS[
                              result.staff.employmentStatus
                            ]
                          }
                        </Tag>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-border pt-4 flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-text-secondary">登录邮箱</span>
                      <span
                        className="font-mono text-xs"
                        style={{ wordBreak: 'break-all', color: 'var(--ant-color-text)' }}
                      >
                        {result.account.loginEmail || '—'}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-text-secondary">联系邮箱</span>
                      <span className="text-sm" style={{ wordBreak: 'break-all' }}>
                        {result.userInfo.email || '—'}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-text-secondary">手机号</span>
                      <span className="font-mono text-sm">{result.userInfo.phone || '—'}</span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            <div className="rounded-card shadow-card">
              <Card
                title={<BilingualLabel title="最近登录" subtitle="Recent Activity" />}
                styles={{ body: { padding: '12px 12px 16px' } }}
              >
                <RecentLoginList items={result.account.recentLoginHistory} />
              </Card>
            </div>
          </div>
        </div>
      )}

      {hasLoaded && isLoading && (
        <div className="fixed right-8" style={{ top: '6rem' }} data-layer="top-control-bar-level">
          <div
            className="rounded-card shadow-card"
            style={{ borderColor: 'color-mix(in srgb, var(--ant-color-primary) 20%, transparent)' }}
          >
            <Card styles={{ body: { padding: 12 } }}>
              <Flex align="center" gap={8}>
                <Skeleton.Avatar active size="small" />
                <span className="text-xs font-medium text-primary">正在刷新数据...</span>
              </Flex>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
