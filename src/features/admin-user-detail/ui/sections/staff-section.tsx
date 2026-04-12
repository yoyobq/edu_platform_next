/* eslint-disable react-refresh/only-export-components -- section files intentionally colocate viewer/editor with UI-only section builders */

import { useMemo } from 'react';
import { Form, Input, Radio, Select, Tag, Typography } from 'antd';

import { WHITE_HOUSE_DEPARTMENT_OPTION_ID } from '@/shared/department';

import type { AdminDepartmentOption } from '../../application/get-admin-department-options';
import type { AdminUserDetail } from '../../application/get-admin-user-detail';
import {
  ADMIN_USER_DETAIL_STAFF_EMPLOYMENT_STATUS_LABELS,
  ADMIN_USER_DETAIL_STAFF_EMPLOYMENT_STATUSES,
  type AdminUserDetailStaffEmploymentStatus,
} from '../../application/get-admin-user-detail';
import { BilingualLabel } from '../components/bilingual-label';
import { DetailSectionBlock, ReadonlyValue } from '../components/detail-section-block';
import { EditableFormCard, EditableSectionShell } from '../components/editable-section-shell';
import {
  formatDateTime,
  formatOptionalValue,
  getDepartmentDisplayName,
  normalizeRequiredTextValue,
} from '../lib/formatters';
import { getStatusTagColor } from '../lib/status-tag';
import type { DetailSection, DetailSectionGroup } from '../model';

const { TextArea } = Input;

export type StaffSectionFormValues = {
  departmentId?: string;
  employmentStatus: AdminUserDetailStaffEmploymentStatus;
  jobTitle?: string;
  name: string;
  remark?: string;
};

export function buildStaffSectionGroup(
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

export function StaffSectionEditor({
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
      departmentId: detail.staff.departmentId ?? WHITE_HOUSE_DEPARTMENT_OPTION_ID,
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
              <Typography.Text type="secondary" style={{ fontSize: 'var(--ant-font-size-sm)' }}>
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

export function StaffSectionViewer({
  section,
  onEdit,
}: {
  section: DetailSection;
  onEdit: () => void;
}) {
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
