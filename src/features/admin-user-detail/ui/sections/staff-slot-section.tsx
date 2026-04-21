import { useMemo, useState } from 'react';
import { PlusOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Checkbox,
  Form,
  Input,
  Popconfirm,
  Select,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';

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
import {
  formatDateTime,
  formatOptionalValue,
  getDepartmentDisplayName,
  normalizeOptionalTextValue,
} from '../lib/formatters';

type StaffSlotPost = AdminUserDetail['staffSlotPosts'][number];

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
  const columns = useMemo<ColumnsType<StaffSlotPost>>(
    () => [
      {
        dataIndex: 'slotCode',
        key: 'slotCode',
        title: 'Slot',
        render: (slotCode: StaffSlotPost['slotCode']) => (
          <div className="flex flex-col gap-0.5">
            <span>{ADMIN_USER_DETAIL_STAFF_SLOT_LABELS[slotCode]}</span>
            <Typography.Text type="secondary" style={{ fontSize: 'var(--ant-font-size-sm)' }}>
              {slotCode}
            </Typography.Text>
          </div>
        ),
      },
      {
        key: 'scope',
        title: 'Scope',
        render: (_, post) => (
          <div className="flex flex-col gap-0.5">
            <span>{getScopeDisplayName(post, departmentMap)}</span>
            <Typography.Text type="secondary" style={{ fontSize: 'var(--ant-font-size-sm)' }}>
              {getScopeRawId(post)}
            </Typography.Text>
          </div>
        ),
      },
      {
        dataIndex: 'status',
        key: 'status',
        title: '状态',
        render: (status: StaffSlotPost['status']) => (
          <Tag color={getPostStatusTagColor(status)} style={{ margin: 0 }}>
            {ADMIN_USER_DETAIL_IDENTITY_POST_STATUS_LABELS[status]}
          </Tag>
        ),
      },
      {
        key: 'period',
        title: '任职时间',
        render: (_, post) => (
          <div className="flex flex-col gap-0.5">
            <span>{post.startAt ? formatDateTime(post.startAt) : '—'}</span>
            <Typography.Text type="secondary" style={{ fontSize: 'var(--ant-font-size-sm)' }}>
              至 {post.endAt ? formatDateTime(post.endAt) : '未设定'}
            </Typography.Text>
          </div>
        ),
      },
      {
        key: 'meta',
        title: '备注',
        render: (_, post) => (
          <div className="flex flex-col gap-0.5">
            <span>{post.isTemporary ? '临时任职' : '正式任职'}</span>
            <Typography.Text
              ellipsis={post.remarks ? { tooltip: post.remarks } : false}
              type="secondary"
              style={{ maxWidth: 180, fontSize: 'var(--ant-font-size-sm)' }}
            >
              {formatOptionalValue(post.remarks)}
            </Typography.Text>
          </div>
        ),
      },
      {
        key: 'action',
        title: '操作',
        width: 96,
        render: (_, post) => (
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
              loading={actionPostId === post.id}
              aria-label={`结束 ${post.id}`}
            >
              结束
            </Button>
          </Popconfirm>
        ),
      },
    ],
    [actionPostId, departmentMap, onEnd],
  );

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
    <div className="rounded-block border border-border p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Typography.Text strong>
            <BilingualLabel title="Staff Slot 任职" subtitle="Staff Slot Posts" />
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 'var(--ant-font-size-sm)' }}>
            当前任职事实，不包含历史结束记录。
          </Typography.Text>
        </div>
        <Button
          icon={<PlusOutlined />}
          disabled={addDisabled}
          onClick={() => setAdding(true)}
          title={isLeftStaff ? '已离职 staff 不能新增 slot' : undefined}
          data-testid="staff-slot-add-button"
        >
          添加任职
        </Button>
      </div>

      {errorMessage ? (
        <div className="mb-4">
          <Alert type="error" showIcon title={errorMessage} />
        </div>
      ) : null}
      {isLeftStaff ? (
        <div className="mb-4">
          <Alert type="warning" showIcon title="已离职 staff 不能新增 slot。" />
        </div>
      ) : null}
      {detail.staff.employmentStatus === 'SUSPENDED' ? (
        <div className="mb-4">
          <Alert
            type="info"
            showIcon
            title="当前 staff 已停用；新增任职事实后，binding 会收敛为 INACTIVE。"
          />
        </div>
      ) : null}
      {departmentLoadErrorMessage ? (
        <div className="mb-4">
          <Alert
            type="warning"
            showIcon
            title="部门列表加载失败，暂不能新增部门类 slot。"
            description={departmentLoadErrorMessage}
          />
        </div>
      ) : null}

      <Table<StaffSlotPost>
        size="small"
        rowKey="id"
        columns={columns}
        dataSource={[...detail.staffSlotPosts]}
        pagination={false}
        locale={{ emptyText: '暂无当前 Staff Slot 任职' }}
      />

      {adding ? (
        <div className="mt-4 rounded-block border border-border bg-fill-secondary p-4">
          <Form<AssignStaffSlotFormValues>
            form={form}
            layout="vertical"
            requiredMark={false}
            initialValues={{ isTemporary: false }}
            onFinish={handleAssign}
            disabled={assigning}
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Form.Item<AssignStaffSlotFormValues>
                label="Slot"
                name="slotCode"
                rules={[{ required: true, message: '请选择 slot。' }]}
              >
                <Select
                  data-testid="staff-slot-code-select"
                  placeholder="请选择 slot"
                  options={getSlotCodeOptions()}
                />
              </Form.Item>
              <Form.Item<AssignStaffSlotFormValues>
                label="部门"
                name="departmentId"
                rules={[{ required: true, message: '请选择部门。' }]}
              >
                <Select
                  data-testid="staff-slot-department-select"
                  showSearch
                  optionFilterProp="label"
                  placeholder="请选择部门"
                  options={selectableDepartments.map((department) => ({
                    label: department.departmentName,
                    value: department.id,
                  }))}
                />
              </Form.Item>
              <Form.Item<AssignStaffSlotFormValues> label="开始时间" name="startAt">
                <Input type="datetime-local" />
              </Form.Item>
              <Form.Item<AssignStaffSlotFormValues> label="结束时间" name="endAt">
                <Input type="datetime-local" />
              </Form.Item>
              <Form.Item<AssignStaffSlotFormValues>
                label="临时任职"
                name="isTemporary"
                valuePropName="checked"
              >
                <Checkbox>是</Checkbox>
              </Form.Item>
              <div className="md:col-span-2 xl:col-span-3">
                <Form.Item<AssignStaffSlotFormValues> label="备注" name="remarks">
                  <Input maxLength={255} />
                </Form.Item>
              </div>
            </div>
            <div className="flex justify-end gap-2">
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
      ) : null}
    </div>
  );
}
