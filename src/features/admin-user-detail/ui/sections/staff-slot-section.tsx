import { useMemo, useState } from 'react';
import { PlusOutlined, StopOutlined } from '@ant-design/icons';
import { Alert, Button, Checkbox, Form, Input, Popconfirm, Select, Tag, Typography } from 'antd';

import type { AdminDepartmentOption } from '../../application/get-admin-department-options';
import type {
  AdminUserDetail,
  AdminUserDetailAssignableStaffSlotCode,
  AdminUserDetailIdentityPostStatus,
} from '../../application/get-admin-user-detail';
import {
  ADMIN_USER_DETAIL_ASSIGNABLE_STAFF_SLOT_CODES,
  ADMIN_USER_DETAIL_IDENTITY_POST_STATUS_LABELS,
  ADMIN_USER_DETAIL_STAFF_SLOT_LABELS,
} from '../../application/get-admin-user-detail';
import { BilingualLabel } from '../components/bilingual-label';
import { DetailSectionBlock } from '../components/detail-section-block';
import { EditableFormCard } from '../components/editable-section-shell';
import {
  formatDate,
  formatOptionalValue,
  getDepartmentDisplayName,
  normalizeOptionalTextValue,
} from '../lib/formatters';
import type { DetailSection } from '../model';

export type StaffSlotPost = AdminUserDetail['staffSlotPosts'][number];

export type AssignStaffSlotFormValues = {
  departmentId?: string;
  endAt?: string;
  isTemporary?: boolean;
  remarks?: string;
  slotCode?: AdminUserDetailAssignableStaffSlotCode;
  startAt?: string;
};

export type AssignStaffSlotCommand = {
  departmentId: string;
  endAt?: string;
  isTemporary: boolean;
  remarks?: string;
  slotCode: AdminUserDetailAssignableStaffSlotCode;
  startAt?: string;
};

function getPostStatusTagColor(status: AdminUserDetailIdentityPostStatus) {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'INACTIVE':
      return 'default';
    case 'ENDED':
    default:
      return 'default';
  }
}

function normalizeDateTimeLocalValue(value: string | undefined) {
  const normalizedValue = normalizeOptionalTextValue(value);

  if (!normalizedValue) {
    return undefined;
  }

  const date = new Date(normalizedValue);

  return Number.isNaN(date.getTime()) ? normalizedValue : date.toISOString();
}

function getScopeDisplayName(
  post: StaffSlotPost,
  departmentMap: ReadonlyMap<string, AdminDepartmentOption>,
) {
  if (post.scope.departmentId) {
    return getDepartmentDisplayName(post.scope.departmentId, departmentMap);
  }

  if (post.scope.classId) {
    return `班级 ID：${post.scope.classId}`;
  }

  if (post.scope.teachingGroupId) {
    return `教学组 ID：${post.scope.teachingGroupId}`;
  }

  return '—';
}

function getScopeRawId(post: StaffSlotPost) {
  return post.scope.departmentId ?? post.scope.classId ?? post.scope.teachingGroupId ?? '—';
}

function getSlotCodeOptions() {
  return ADMIN_USER_DETAIL_ASSIGNABLE_STAFF_SLOT_CODES.map((slotCode) => ({
    label: ADMIN_USER_DETAIL_STAFF_SLOT_LABELS[slotCode],
    value: slotCode,
  }));
}

function getStaffSlotTypeLabel(post: StaffSlotPost) {
  return post.isTemporary ? '临时任职' : '正式任职';
}

function StaffSlotViewerBlock({
  actionPostId,
  departmentMap,
  onEnd,
  post,
}: {
  actionPostId: number | null;
  departmentMap: ReadonlyMap<string, AdminDepartmentOption>;
  onEnd: (post: StaffSlotPost) => Promise<void>;
  post: StaffSlotPost;
}) {
  const section: DetailSection = {
    items: [
      {
        key: 'slot',
        label: <BilingualLabel compact title="Slot" subtitle="Slot Type" />,
        value: (
          <div className="flex flex-col gap-0.5">
            <span>{ADMIN_USER_DETAIL_STAFF_SLOT_LABELS[post.slotCode]}</span>
            <Typography.Text type="secondary" style={{ fontSize: 'var(--ant-font-size-sm)' }}>
              {post.slotCode}
            </Typography.Text>
          </div>
        ),
      },
      {
        key: 'status',
        label: <BilingualLabel compact title="状态" subtitle="Status" />,
        value: (
          <Tag color={getPostStatusTagColor(post.status)} style={{ margin: 0 }}>
            {ADMIN_USER_DETAIL_IDENTITY_POST_STATUS_LABELS[post.status]}
          </Tag>
        ),
      },
      {
        key: 'scope',
        label: <BilingualLabel compact title="服务对象" subtitle="Assignment Scope" />,
        value: (
          <div className="flex flex-col gap-0.5">
            <span>{getScopeDisplayName(post, departmentMap)}</span>
            <Typography.Text type="secondary" style={{ fontSize: 'var(--ant-font-size-sm)' }}>
              {getScopeRawId(post)}
            </Typography.Text>
          </div>
        ),
      },
      {
        key: 'period',
        label: <BilingualLabel compact title="任职时间" subtitle="Period" />,
        value: (
          <div className="flex items-center gap-2">
            <span>{post.startAt ? formatDate(post.startAt) : '—'}</span>
            <Typography.Text type="secondary">至</Typography.Text>
            <span>{post.endAt ? formatDate(post.endAt) : '长期'}</span>
          </div>
        ),
      },
      {
        key: 'assignmentType',
        label: <BilingualLabel compact title="任职性质" subtitle="Assignment Type" />,
        value: (
          <Tag color={post.isTemporary ? 'orange' : 'blue'} style={{ margin: 0 }}>
            {getStaffSlotTypeLabel(post)}
          </Tag>
        ),
      },
      {
        key: 'remarks',
        label: <BilingualLabel compact title="备注" subtitle="Remark" />,
        value: (
          <Typography.Text
            ellipsis={post.remarks ? { tooltip: post.remarks } : false}
            type="secondary"
            style={{ maxWidth: 320, fontSize: 'var(--ant-font-size-sm)' }}
          >
            {formatOptionalValue(post.remarks)}
          </Typography.Text>
        ),
      },
    ],
    key: `slot-${post.id}`,
    tone: 'editable',
  };

  return (
    <div className="rounded-block border border-border p-4 transition-colors duration-150 hover:bg-fill-hover">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <DetailSectionBlock section={section} />
          </div>
          <Popconfirm
            title="确认结束该任职？"
            okText="结束"
            cancelText="取消"
            okButtonProps={{
              danger: true,
              loading: actionPostId === post.id,
              'data-testid': `staff-slot-end-confirm-${post.id}`,
            }}
            onConfirm={() => onEnd(post)}
          >
            <Button
              danger
              size="small"
              icon={<StopOutlined />}
              loading={actionPostId === post.id}
              aria-label={`结束 ${post.id}`}
            >
              结束任职
            </Button>
          </Popconfirm>
        </div>
      </div>
    </div>
  );
}

export function StaffSlotSection({
  actionPostId,
  assigning,
  departmentLoadErrorMessage,
  departmentMap,
  departmentOptions,
  detail,
  errorMessage,
  onAssign,
  onEnd,
}: {
  actionPostId: number | null;
  assigning: boolean;
  departmentLoadErrorMessage: string | null;
  departmentMap: ReadonlyMap<string, AdminDepartmentOption>;
  departmentOptions: readonly AdminDepartmentOption[];
  detail: AdminUserDetail;
  errorMessage: string | null;
  onAssign: (input: AssignStaffSlotCommand) => Promise<void>;
  onEnd: (post: StaffSlotPost) => Promise<void>;
}) {
  const [form] = Form.useForm<AssignStaffSlotFormValues>();
  const [adding, setAdding] = useState(false);
  const selectableDepartments = useMemo(
    () => departmentOptions.filter((department) => department.id && department.isEnabled),
    [departmentOptions],
  );
  const isLeftStaff = detail.staff.employmentStatus === 'LEFT';
  const addDisabled = isLeftStaff || Boolean(departmentLoadErrorMessage);

  async function handleAssign(values: AssignStaffSlotFormValues) {
    if (!values.slotCode || !values.departmentId) {
      return;
    }

    await onAssign({
      departmentId: values.departmentId,
      endAt: normalizeDateTimeLocalValue(values.endAt),
      isTemporary: values.isTemporary === true,
      remarks: normalizeOptionalTextValue(values.remarks) ?? undefined,
      slotCode: values.slotCode,
      startAt: normalizeDateTimeLocalValue(values.startAt),
    });
    form.resetFields();
    setAdding(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        {detail.staffSlotPosts.map((post) => (
          <StaffSlotViewerBlock
            key={post.id}
            post={post}
            departmentMap={departmentMap}
            onEnd={onEnd}
            actionPostId={actionPostId}
          />
        ))}

        {detail.staffSlotPosts.length === 0 && !adding && (
          <div className="rounded-block border border-dashed border-border p-8 text-center">
            <Typography.Text type="secondary">暂无 Staff Slot 职务</Typography.Text>
          </div>
        )}
      </div>

      {!adding ? (
        <div className="flex justify-center">
          <Button
            icon={<PlusOutlined />}
            disabled={addDisabled}
            onClick={() => setAdding(true)}
            title={isLeftStaff ? '已离职 staff 不能新增 slot' : undefined}
            data-testid="staff-slot-add-button"
          >
            添加 Staff Slot 职务
          </Button>
        </div>
      ) : (
        <div className="rounded-block border border-border bg-fill-secondary p-6">
          <div className="mb-6 flex items-center justify-between">
            <BilingualLabel title="新增 Staff Slot 职务" subtitle="Add Staff Slot" />
            <Button
              size="small"
              onClick={() => {
                form.resetFields();
                setAdding(false);
              }}
            >
              取消
            </Button>
          </div>

          <Form<AssignStaffSlotFormValues>
            form={form}
            layout="vertical"
            requiredMark={false}
            initialValues={{ isTemporary: false }}
            onFinish={handleAssign}
            disabled={assigning}
          >
            <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
              <EditableFormCard>
                <Form.Item<AssignStaffSlotFormValues>
                  label={<BilingualLabel compact title="Slot" subtitle="Slot Type" />}
                  name="slotCode"
                  rules={[{ required: true, message: '请选择 slot。' }]}
                  style={{ marginBottom: 0 }}
                >
                  <Select
                    data-testid="staff-slot-code-select"
                    placeholder="请选择 slot"
                    options={getSlotCodeOptions()}
                  />
                </Form.Item>
              </EditableFormCard>
              <EditableFormCard>
                <Form.Item<AssignStaffSlotFormValues>
                  label={<BilingualLabel compact title="服务对象" subtitle="Assignment Scope" />}
                  name="departmentId"
                  rules={[{ required: true, message: '请选择服务对象。' }]}
                  style={{ marginBottom: 0 }}
                >
                  <Select
                    data-testid="staff-slot-department-select"
                    showSearch
                    optionFilterProp="label"
                    placeholder="请选择服务对象"
                    options={selectableDepartments.map((department) => ({
                      label: department.departmentName,
                      value: department.id,
                    }))}
                  />
                </Form.Item>
              </EditableFormCard>
              <EditableFormCard>
                <Form.Item<AssignStaffSlotFormValues>
                  label={<BilingualLabel compact title="开始时间" subtitle="Start At" />}
                  name="startAt"
                  style={{ marginBottom: 0 }}
                >
                  <Input type="datetime-local" />
                </Form.Item>
              </EditableFormCard>
              <EditableFormCard>
                <Form.Item<AssignStaffSlotFormValues>
                  label={<BilingualLabel compact title="结束时间" subtitle="End At" />}
                  name="endAt"
                  style={{ marginBottom: 0 }}
                >
                  <Input type="datetime-local" />
                </Form.Item>
              </EditableFormCard>
              <EditableFormCard>
                <Form.Item<AssignStaffSlotFormValues>
                  label={<BilingualLabel compact title="临时任职" subtitle="Is Temporary" />}
                  name="isTemporary"
                  valuePropName="checked"
                  style={{ marginBottom: 0 }}
                >
                  <Checkbox>是</Checkbox>
                </Form.Item>
              </EditableFormCard>
              <div className="md:col-span-2">
                <EditableFormCard>
                  <Form.Item<AssignStaffSlotFormValues>
                    label={<BilingualLabel compact title="备注" subtitle="Remark" />}
                    name="remarks"
                    style={{ marginBottom: 0 }}
                  >
                    <Input maxLength={255} />
                  </Form.Item>
                </EditableFormCard>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                onClick={() => {
                  form.resetFields();
                  setAdding(false);
                }}
              >
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={assigning}>
                保存任职
              </Button>
            </div>
          </Form>
        </div>
      )}

      {errorMessage ? <Alert type="error" showIcon title={errorMessage} /> : null}

      {isLeftStaff ? <Alert type="warning" showIcon title="已离职 staff 不能新增 slot。" /> : null}
      {detail.staff.employmentStatus === 'SUSPENDED' ? (
        <Alert
          type="info"
          showIcon
          title="当前 staff 已停用；新增任职事实后，binding 会收敛为 INACTIVE。"
        />
      ) : null}
      {departmentLoadErrorMessage ? (
        <Alert
          type="warning"
          showIcon
          title="部门列表加载失败，暂不能新增部门类 slot。"
          description={departmentLoadErrorMessage}
        />
      ) : null}
    </div>
  );
}
