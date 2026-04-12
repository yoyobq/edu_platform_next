/* eslint-disable react-refresh/only-export-components -- section files intentionally colocate viewer/editor with UI-only section builders */

import { useMemo } from 'react';
import { Flex, Form, Input, Radio, Tag, Typography } from 'antd';

import type { AuthAccessGroup } from '@/shared/auth-access';

import type { AdminUserDetail } from '../../application/get-admin-user-detail';
import {
  ADMIN_USER_DETAIL_ACCOUNT_STATUS_LABELS,
  ADMIN_USER_DETAIL_ACCOUNT_STATUSES,
  ADMIN_USER_DETAIL_IDENTITY_HINTS,
  type AdminUserDetailAccountStatus,
  type AdminUserDetailIdentityHint,
} from '../../application/get-admin-user-detail';
import { isAdminUserDetailIdentityHintAllowed } from '../../application/update-admin-user-detail-sections';
import { BilingualLabel } from '../components/bilingual-label';
import { DetailSectionBlock, ReadonlyValue } from '../components/detail-section-block';
import { EditableFormCard, EditableSectionShell } from '../components/editable-section-shell';
import { formatDateTime, formatOptionalValue } from '../lib/formatters';
import { getStatusTagColor } from '../lib/status-tag';
import type { DetailSection, DetailSectionGroup } from '../model';

export type AccountSectionFormValues = {
  identityHint?: AdminUserDetailIdentityHint;
  status: AdminUserDetailAccountStatus;
};

function buildIdentityHintOptions(accessGroup: readonly AuthAccessGroup[]) {
  return ADMIN_USER_DETAIL_IDENTITY_HINTS.map((identityHint) => ({
    disabled: !isAdminUserDetailIdentityHintAllowed(accessGroup, identityHint),
    label: identityHint,
    value: identityHint,
  }));
}

export function buildAccountSectionGroup(detail: AdminUserDetail): DetailSectionGroup {
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

export function AccountSectionEditor({
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

export function AccountSectionViewer({
  section,
  onEdit,
}: {
  section: DetailSection;
  onEdit: () => void;
}) {
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
