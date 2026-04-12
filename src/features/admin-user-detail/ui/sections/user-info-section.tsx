/* eslint-disable react-refresh/only-export-components -- section files intentionally colocate viewer/editor with UI-only section builders */

import { useMemo, useState } from 'react';
import { DatePicker, Flex, Form, Input, Radio, Tag, Typography } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';

import type { AuthAccessGroup } from '@/shared/auth-access';

import type { AdminUserDetail } from '../../application/get-admin-user-detail';
import {
  ADMIN_USER_DETAIL_GENDER_LABELS,
  ADMIN_USER_DETAIL_GENDERS,
  ADMIN_USER_DETAIL_USER_STATE_LABELS,
  ADMIN_USER_DETAIL_USER_STATES,
  type AdminUserDetailGender,
  type AdminUserDetailUserState,
} from '../../application/get-admin-user-detail';
import { AccessGroupDisplayTags, AccessGroupTagGroup } from '../components/access-group-tags';
import { BilingualLabel } from '../components/bilingual-label';
import { DetailSectionBlock, ReadonlyValue } from '../components/detail-section-block';
import { EditableFormCard, EditableSectionShell } from '../components/editable-section-shell';
import { UserTagsDisplay, UserTagsEditor } from '../components/user-tags';
import { hasLockedAccessGroup } from '../lib/access-group';
import {
  formatCount,
  formatDateTime,
  formatOptionalValue,
  normalizeOptionalTextValue,
  normalizeRequiredTextValue,
  toBirthDatePickerValue,
} from '../lib/formatters';
import { formatGeographicValue, parseGeographicValue } from '../lib/geographic';
import { getStatusTagColor } from '../lib/status-tag';
import type { DetailSection, DetailSectionGroup } from '../model';

const { TextArea } = Input;
const DEFAULT_BIRTH_DATE_PICKER_VALUE = dayjs('1984-01-01');

export type UserInfoSectionFormValues = {
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

export function buildUserInfoSectionGroup(detail: AdminUserDetail): DetailSectionGroup {
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

export function UserInfoSectionEditor({
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

export function UserInfoSectionViewer({
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
