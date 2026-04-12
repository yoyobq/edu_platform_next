import { type Key, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Empty,
  Flex,
  Input,
  message,
  Popover,
  Select,
  Skeleton,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { FilterValue, SorterResult, TablePaginationConfig } from 'antd/es/table/interface';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';

import { AUTH_ACCESS_GROUPS, type AuthAccessGroup } from '@/shared/auth-access';

import {
  ADMIN_USER_ACCOUNT_STATUS_LABELS,
  ADMIN_USER_ACCOUNT_STATUSES,
  ADMIN_USER_EMPLOYMENT_STATUS_LABELS,
  ADMIN_USER_EMPLOYMENT_STATUSES,
  ADMIN_USER_SORT_FIELDS,
  type AdminUserAccountStatus,
  type AdminUserEmploymentStatus,
  type AdminUserListItem,
  type AdminUserListQuery,
  type AdminUserSortField,
  type AdminUserSortOrder,
  DEFAULT_ADMIN_USER_LIST_QUERY,
  normalizeAdminUserListQuery,
} from '../application/get-admin-users';
import type {
  UpdateAdminUserAccountStatusInput,
  UpdateAdminUserAccountStatusResult,
} from '../application/update-admin-user-account-status';
import type {
  UpdateAdminUserStaffEmploymentStatusInput,
  UpdateAdminUserStaffEmploymentStatusResult,
} from '../application/update-admin-user-staff-employment-status';
import { type AdminUserListLoader, useAdminUserList } from '../application/use-admin-user-list';

import { AccountStatusQuickSwitch } from './account-status-quick-switch';
import { StaffEmploymentStatusQuickSwitch } from './staff-employment-status-quick-switch';

type HasStaffFilterValue = 'true' | 'false';
type AdminUserAccountStatusUpdater = (
  input: UpdateAdminUserAccountStatusInput,
) => Promise<UpdateAdminUserAccountStatusResult>;
type AdminUserStaffEmploymentStatusUpdater = (
  input: UpdateAdminUserStaffEmploymentStatusInput,
) => Promise<UpdateAdminUserStaffEmploymentStatusResult>;

type AdminUserListPageContentProps = {
  loadUsers: AdminUserListLoader;
  updateAccountStatus: AdminUserAccountStatusUpdater;
  updateStaffEmploymentStatus: AdminUserStaffEmploymentStatusUpdater;
};

const DEFAULT_QUERY = DEFAULT_ADMIN_USER_LIST_QUERY;

const ACCOUNT_STATUS_OPTIONS = ADMIN_USER_ACCOUNT_STATUSES.map((status) => ({
  label: ADMIN_USER_ACCOUNT_STATUS_LABELS[status],
  value: status,
}));

const ACCESS_GROUP_OPTIONS = AUTH_ACCESS_GROUPS.map((accessGroup) => ({
  label: accessGroup,
  value: accessGroup,
}));

const ACCOUNT_STATUS_BULK_OPTIONS = ADMIN_USER_ACCOUNT_STATUSES.map((status) => ({
  label: ADMIN_USER_ACCOUNT_STATUS_LABELS[status],
  value: status,
}));

function formatDateTimeToMinute(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function toSorterOrder(sortOrder: AdminUserSortOrder): 'ascend' | 'descend' {
  return sortOrder === 'ASC' ? 'ascend' : 'descend';
}

function fromSorterOrder(value: 'ascend' | 'descend' | null | undefined): AdminUserSortOrder {
  return value === 'ascend' ? 'ASC' : 'DESC';
}

function normalizeHasStaff(value: HasStaffFilterValue): boolean {
  return value === 'true';
}

function resolveFilterSummary(criteria: AdminUserListQuery) {
  const parts: string[] = [];

  if (criteria.query) {
    parts.push(`搜索“${criteria.query}”`);
  }

  if (criteria.status) {
    parts.push(`状态 ${ADMIN_USER_ACCOUNT_STATUS_LABELS[criteria.status]}`);
  }

  if (criteria.accessGroups && criteria.accessGroups.length > 0) {
    parts.push(`访问组 ${criteria.accessGroups.join(', ')}`);
  }

  if (criteria.hasStaff === true) {
    parts.push('仅看 staff');
  } else if (criteria.hasStaff === false) {
    parts.push('仅看无 staff');
  }

  return parts.length > 0 ? parts.join(' · ') : '当前显示全部用户';
}

function isSortField(value: unknown): value is AdminUserSortField {
  return ADMIN_USER_SORT_FIELDS.includes(value as AdminUserSortField);
}

function parseHasStaffSearchParam(value: string | null): boolean | undefined {
  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return undefined;
}

function parseAccessGroupsSearchParams(searchParams: URLSearchParams): readonly AuthAccessGroup[] {
  return searchParams
    .getAll('accessGroup')
    .filter((value): value is AuthAccessGroup =>
      AUTH_ACCESS_GROUPS.includes(value as AuthAccessGroup),
    );
}

function buildAdminUserListSearchParams(criteria: AdminUserListQuery) {
  const normalizedCriteria = normalizeAdminUserListQuery({
    ...DEFAULT_QUERY,
    ...criteria,
  });
  const nextSearchParams = new URLSearchParams();

  if (normalizedCriteria.query) {
    nextSearchParams.set('query', normalizedCriteria.query);
  }

  if (normalizedCriteria.status) {
    nextSearchParams.set('status', normalizedCriteria.status);
  }

  for (const accessGroup of normalizedCriteria.accessGroups ?? []) {
    nextSearchParams.append('accessGroup', accessGroup);
  }

  nextSearchParams.set('hasStaff', normalizedCriteria.hasStaff === false ? 'false' : 'true');
  nextSearchParams.set('limit', String(normalizedCriteria.limit ?? DEFAULT_QUERY.limit));
  nextSearchParams.set('page', String(normalizedCriteria.page ?? DEFAULT_QUERY.page));
  nextSearchParams.set('sortBy', normalizedCriteria.sortBy ?? DEFAULT_QUERY.sortBy);
  nextSearchParams.set('sortOrder', normalizedCriteria.sortOrder ?? DEFAULT_QUERY.sortOrder);

  return nextSearchParams;
}

function parseAdminUserListQuery(searchParams: URLSearchParams): AdminUserListQuery {
  return normalizeAdminUserListQuery({
    ...DEFAULT_QUERY,
    accessGroups: parseAccessGroupsSearchParams(searchParams),
    hasStaff: parseHasStaffSearchParam(searchParams.get('hasStaff')) ?? DEFAULT_QUERY.hasStaff,
    limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : DEFAULT_QUERY.limit,
    page: searchParams.get('page') ? Number(searchParams.get('page')) : DEFAULT_QUERY.page,
    query: searchParams.get('query') ?? undefined,
    sortBy: (searchParams.get('sortBy') as AdminUserSortField | null) ?? DEFAULT_QUERY.sortBy,
    sortOrder:
      (searchParams.get('sortOrder') as AdminUserSortOrder | null) ?? DEFAULT_QUERY.sortOrder,
    status: searchParams.get('status') as AdminUserAccountStatus | undefined,
  });
}

function AdminUserListTableSkeleton() {
  const gridTemplate = '44px 110px 140px 160px 220px 160px 160px 168px';
  const rows = [
    { idW: 68, staffIdW: 88, nameW: 96, tagsCount: 2 as const, hasStaff: true },
    { idW: 52, staffIdW: 56, nameW: 72, tagsCount: 1 as const, hasStaff: false },
    { idW: 76, staffIdW: 104, nameW: 80, tagsCount: 2 as const, hasStaff: true },
    { idW: 60, staffIdW: 64, nameW: 64, tagsCount: 1 as const, hasStaff: false },
    { idW: 84, staffIdW: 72, nameW: 88, tagsCount: 1 as const, hasStaff: false },
    { idW: 56, staffIdW: 80, nameW: 76, tagsCount: 2 as const, hasStaff: true },
    { idW: 72, staffIdW: 96, nameW: 84, tagsCount: 1 as const, hasStaff: true },
  ];

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ minWidth: 1100 }}>
        {/* 列头行 */}
        <div
          className="grid items-center border-b border-border px-4 py-3"
          style={{
            background: 'var(--ant-color-fill-quaternary)',
            gridTemplateColumns: gridTemplate,
          }}
        >
          <div />
          {['账户 ID', '工号', '姓名', '访问组', '账户状态', '在职状态', '创建时间'].map(
            (label) => (
              <span
                key={label}
                style={{ color: 'var(--ant-color-text-secondary)', fontSize: 13, fontWeight: 600 }}
              >
                {label}
              </span>
            ),
          )}
        </div>

        {/* 数据行 */}
        {rows.map((row, i) => (
          <div
            key={i}
            className="grid items-center border-b border-border px-4 py-3 last:border-b-0"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            {/* 勾选框占位 */}
            <div>
              <div
                style={{
                  background: 'var(--ant-color-fill-secondary)',
                  borderRadius: 2,
                  height: 16,
                  width: 16,
                }}
              />
            </div>
            {/* 账户 ID */}
            <div>
              <Skeleton.Button active size="small" style={{ width: row.idW, height: 18 }} />
            </div>
            {/* 工号 */}
            <div>
              {row.hasStaff ? (
                <Skeleton.Button active size="small" style={{ width: row.staffIdW, height: 18 }} />
              ) : (
                <span style={{ color: 'var(--ant-color-text-quaternary)' }}>—</span>
              )}
            </div>
            {/* 姓名 */}
            <div>
              {row.hasStaff ? (
                <Skeleton.Button active size="small" style={{ width: row.nameW, height: 18 }} />
              ) : (
                <span style={{ color: 'var(--ant-color-text-quaternary)' }}>—</span>
              )}
            </div>
            {/* 访问组 */}
            <div className="flex gap-1">
              {Array.from({ length: row.tagsCount }).map((_, ti) => (
                <Skeleton.Button
                  key={ti}
                  active
                  size="small"
                  shape="round"
                  style={{ width: 44, height: 22 }}
                />
              ))}
            </div>
            {/* 账户状态 */}
            <div>
              <Skeleton.Button active size="small" style={{ width: 100, height: 26 }} />
            </div>
            {/* 在职状态 */}
            <div>
              {row.hasStaff ? (
                <Skeleton.Button active size="small" style={{ width: 100, height: 26 }} />
              ) : (
                <span style={{ color: 'var(--ant-color-text-quaternary)' }}>—</span>
              )}
            </div>
            {/* 创建时间 */}
            <div>
              <Skeleton.Button active size="small" style={{ width: 120, height: 18 }} />
            </div>
          </div>
        ))}

        {/* 分页行占位 */}
        <div className="flex items-center justify-center border-t border-border px-4 py-2">
          <Skeleton.Button active size="small" style={{ width: 200, height: 24 }} />
        </div>
      </div>
    </div>
  );
}

function BulkActionPopover<T extends string>({
  actionLabel,
  count,
  disabled = false,
  loading = false,
  onSelect,
  options,
  summary,
}: {
  actionLabel: string;
  count: number;
  disabled?: boolean;
  loading?: boolean;
  onSelect: (value: T) => void;
  options: readonly { label: string; value: T }[];
  summary: string;
}) {
  const content = (
    <div className="flex max-w-72 flex-col gap-3">
      <Typography.Text strong>{actionLabel}</Typography.Text>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {summary}
      </Typography.Text>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Button
            key={option.value}
            size="small"
            disabled={loading}
            onClick={() => onSelect(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );

  return (
    <Popover trigger="click" placement="bottomLeft" content={content}>
      <Button disabled={disabled} loading={loading}>
        {actionLabel}
        {count > 0 ? ` (${count})` : ''}
      </Button>
    </Popover>
  );
}

export function AdminUserListPageContent({
  loadUsers,
  updateAccountStatus,
  updateStaffEmploymentStatus,
}: AdminUserListPageContentProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const criteria = useMemo(() => parseAdminUserListQuery(searchParams), [searchParams]);
  const [messageApi, messageContextHolder] = message.useMessage();
  const [draftQuery, setDraftQuery] = useState('');
  const [draftStatus, setDraftStatus] = useState<AdminUserAccountStatus | undefined>(undefined);
  const [draftAccessGroups, setDraftAccessGroups] = useState<readonly AuthAccessGroup[]>([]);
  const [draftHasStaff, setDraftHasStaff] = useState<HasStaffFilterValue>('true');
  const [accountStatusUpdateErrorMessage, setAccountStatusUpdateErrorMessage] = useState<
    string | null
  >(null);
  const [staffEmploymentStatusUpdateErrorMessage, setStaffEmploymentStatusUpdateErrorMessage] =
    useState<string | null>(null);
  const [selectedAccountIds, setSelectedAccountIds] = useState<readonly number[]>([]);
  const [updatingAccountStatusIds, setUpdatingAccountStatusIds] = useState<readonly number[]>([]);
  const [updatingStaffEmploymentStatusIds, setUpdatingStaffEmploymentStatusIds] = useState<
    readonly number[]
  >([]);
  const {
    applyAccountStatusUpdate,
    applyStaffEmploymentStatusUpdate,
    errorMessage,
    hasLoaded,
    isLoading,
    result,
    retry,
  } = useAdminUserList(criteria, loadUsers);

  const filterSummary = useMemo(() => resolveFilterSummary(criteria), [criteria]);
  const totalCount = result?.total ?? 0;
  const currentPage = result?.current ?? criteria.page ?? DEFAULT_QUERY.page;
  const pageSize = result?.pageSize ?? criteria.limit ?? DEFAULT_QUERY.limit;
  const currentList = useMemo(() => result?.list ?? [], [result]);
  const selectedAccountIdSet = useMemo(() => new Set(selectedAccountIds), [selectedAccountIds]);
  const selectedRecords = useMemo(
    () => currentList.filter((item) => selectedAccountIdSet.has(item.account.id)),
    [currentList, selectedAccountIdSet],
  );
  const selectedCount = selectedRecords.length;
  const canBulkUpdateStaff =
    selectedCount > 0 && selectedRecords.every((record) => record.staff !== null);
  const isAnyStatusUpdateRunning =
    updatingAccountStatusIds.length > 0 || updatingStaffEmploymentStatusIds.length > 0;

  useEffect(() => {
    const availableIds = new Set(currentList.map((item) => item.account.id));
    setSelectedAccountIds((currentSelectedAccountIds) =>
      currentSelectedAccountIds.filter((accountId) => availableIds.has(accountId)),
    );
  }, [currentList]);

  useEffect(() => {
    setDraftQuery(criteria.query ?? '');
    setDraftStatus(criteria.status);
    setDraftAccessGroups(criteria.accessGroups ?? []);
    setDraftHasStaff(criteria.hasStaff === false ? 'false' : 'true');
  }, [criteria]);

  const clearSelection = useCallback(() => {
    setSelectedAccountIds([]);
  }, []);

  const commitAccountStatusChange = useCallback(
    async (accountIds: readonly number[], nextStatus: AdminUserAccountStatus) => {
      if (accountIds.length === 0) {
        return false;
      }

      setAccountStatusUpdateErrorMessage(null);
      setUpdatingAccountStatusIds(accountIds);

      try {
        const mutationResult = await updateAccountStatus({
          accountIds,
          status: nextStatus,
        });
        applyAccountStatusUpdate(accountIds, mutationResult.accounts[0]?.status ?? nextStatus);
        void messageApi.success({
          content:
            accountIds.length === 1
              ? `已将账户 ${accountIds[0]} 更新为${ADMIN_USER_ACCOUNT_STATUS_LABELS[nextStatus]}`
              : `已将 ${accountIds.length} 个账户更新为${ADMIN_USER_ACCOUNT_STATUS_LABELS[nextStatus]}`,
          duration: 2,
        });
        return true;
      } catch (error) {
        setAccountStatusUpdateErrorMessage(
          error instanceof Error ? error.message : '账户状态更新失败。',
        );
        return false;
      } finally {
        setUpdatingAccountStatusIds([]);
      }
    },
    [applyAccountStatusUpdate, messageApi, updateAccountStatus],
  );

  const commitStaffEmploymentStatusChange = useCallback(
    async (records: readonly AdminUserListItem[], nextStatus: AdminUserEmploymentStatus) => {
      const staffRecords = records.filter((record) => record.staff);

      if (staffRecords.length === 0) {
        return false;
      }

      const accountIds = staffRecords.map((record) => record.account.id);

      setStaffEmploymentStatusUpdateErrorMessage(null);
      setUpdatingStaffEmploymentStatusIds(accountIds);

      try {
        const mutationResult = await updateStaffEmploymentStatus({
          accountIds,
          employmentStatus: nextStatus,
        });
        applyStaffEmploymentStatusUpdate(
          accountIds,
          mutationResult.staffs[0]?.employmentStatus ?? nextStatus,
        );
        void messageApi.success({
          content:
            staffRecords.length === 1
              ? `已将 staff ${staffRecords[0].staff?.id} 更新为${ADMIN_USER_EMPLOYMENT_STATUS_LABELS[nextStatus]}`
              : `已将 ${staffRecords.length} 个 staff 更新为${ADMIN_USER_EMPLOYMENT_STATUS_LABELS[nextStatus]}`,
          duration: 2,
        });
        return true;
      } catch (error) {
        setStaffEmploymentStatusUpdateErrorMessage(
          error instanceof Error ? error.message : '在职状态更新失败。',
        );
        return false;
      } finally {
        setUpdatingStaffEmploymentStatusIds([]);
      }
    },
    [applyStaffEmploymentStatusUpdate, messageApi, updateStaffEmploymentStatus],
  );

  const handleStatusChange = useCallback(
    async (record: AdminUserListItem, nextStatus: AdminUserAccountStatus) => {
      if (record.account.status === nextStatus) {
        return;
      }

      await commitAccountStatusChange([record.account.id], nextStatus);
    },
    [commitAccountStatusChange],
  );

  const handleStaffEmploymentStatusChange = useCallback(
    async (record: AdminUserListItem, nextStatus: AdminUserEmploymentStatus) => {
      if (!record.staff || record.staff.employmentStatus === nextStatus) {
        return;
      }

      await commitStaffEmploymentStatusChange([record], nextStatus);
    },
    [commitStaffEmploymentStatusChange],
  );

  const handleBatchAccountStatusChange = useCallback(
    async (nextStatus: AdminUserAccountStatus) => {
      const isUpdated = await commitAccountStatusChange(selectedAccountIds, nextStatus);

      if (isUpdated) {
        clearSelection();
      }
    },
    [clearSelection, commitAccountStatusChange, selectedAccountIds],
  );

  const handleBatchStaffEmploymentStatusChange = useCallback(
    async (nextStatus: AdminUserEmploymentStatus) => {
      const isUpdated = await commitStaffEmploymentStatusChange(selectedRecords, nextStatus);

      if (isUpdated) {
        clearSelection();
      }
    },
    [clearSelection, commitStaffEmploymentStatusChange, selectedRecords],
  );

  const columns = useMemo(
    () => [
      {
        dataIndex: ['account', 'id'],
        key: 'id',
        render: (value: number) => (
          <Link
            className="font-mono text-[13px] font-medium text-link hover:underline"
            to={{ pathname: `/admin/users/${value}`, search: location.search }}
            onClick={(e) => e.stopPropagation()}
          >
            #{value}
          </Link>
        ),
        sortOrder: criteria.sortBy === 'id' ? toSorterOrder(criteria.sortOrder ?? 'DESC') : null,
        sorter: true,
        title: '账户 ID',
        width: 110,
      },
      {
        dataIndex: ['staff', 'id'],
        key: 'staffId',
        title: '工号',
        width: 140,
        render: (_value: string | null, record: AdminUserListItem) => (
          <span className="font-mono text-[13px] text-text-secondary">
            {record.staff?.id || '—'}
          </span>
        ),
      },
      {
        dataIndex: ['staff', 'name'],
        key: 'staffName',
        title: '姓名',
        width: 160,
        render: (_value: string | null, record: AdminUserListItem) => (
          <span className="font-medium">{record.staff?.name || '—'}</span>
        ),
      },
      {
        dataIndex: ['userInfo', 'accessGroup'],
        key: 'accessGroup',
        title: '访问组',
        width: 220,
        render: (value: readonly AuthAccessGroup[]) => (
          <Flex gap={4} wrap>
            {value.map((accessGroup) => (
              <Tag
                key={accessGroup}
                style={{
                  margin: 0,
                  border: 'none',
                  background: 'var(--ant-color-primary-bg)',
                  padding: '0 8px',
                  color: 'var(--ant-color-primary)',
                }}
              >
                {accessGroup}
              </Tag>
            ))}
          </Flex>
        ),
      },
      {
        dataIndex: ['account', 'status'],
        key: 'status',
        title: '账户状态',
        width: 160,
        render: (value: AdminUserAccountStatus, record: AdminUserListItem) => (
          <div onClick={(e) => e.stopPropagation()} className="inline-block">
            <AccountStatusQuickSwitch
              accountId={record.account.id}
              value={value}
              updating={updatingAccountStatusIds.includes(record.account.id)}
              disabled={
                isAnyStatusUpdateRunning && !updatingAccountStatusIds.includes(record.account.id)
              }
              onChange={(nextStatus) => handleStatusChange(record, nextStatus)}
            />
          </div>
        ),
      },
      {
        dataIndex: ['staff', 'employmentStatus'],
        key: 'staffEmploymentStatus',
        title: '在职状态',
        width: 160,
        render: (_value: AdminUserEmploymentStatus | null, record: AdminUserListItem) =>
          record.staff ? (
            <div onClick={(e) => e.stopPropagation()} className="inline-block">
              <StaffEmploymentStatusQuickSwitch
                accountId={record.account.id}
                value={record.staff.employmentStatus}
                updating={updatingStaffEmploymentStatusIds.includes(record.account.id)}
                disabled={
                  isAnyStatusUpdateRunning &&
                  !updatingStaffEmploymentStatusIds.includes(record.account.id)
                }
                onChange={(nextStatus) => handleStaffEmploymentStatusChange(record, nextStatus)}
              />
            </div>
          ) : (
            <span className="text-text-quaternary">—</span>
          ),
      },
      {
        dataIndex: ['account', 'createdAt'],
        key: 'createdAt',
        title: '创建时间',
        width: 168,
        render: (value: string) => (
          <span className="text-xs text-text-secondary">{formatDateTimeToMinute(value)}</span>
        ),
      },
    ],
    [
      criteria.sortBy,
      criteria.sortOrder,
      handleStaffEmploymentStatusChange,
      handleStatusChange,
      isAnyStatusUpdateRunning,
      location.search,
      updatingAccountStatusIds,
      updatingStaffEmploymentStatusIds,
    ],
  );

  const rowSelection = useMemo(
    () => ({
      selectedRowKeys: [...selectedAccountIds],
      onChange: (nextSelectedRowKeys: Key[]) => {
        setSelectedAccountIds(nextSelectedRowKeys.map((key) => Number(key)));
      },
    }),
    [selectedAccountIds],
  );

  function applyFilters() {
    clearSelection();
    setSearchParams(
      buildAdminUserListSearchParams({
        ...criteria,
        accessGroups: draftAccessGroups.length > 0 ? draftAccessGroups : undefined,
        hasStaff: normalizeHasStaff(draftHasStaff),
        page: 1,
        query: draftQuery.trim() || undefined,
        status: draftStatus,
      }),
    );
  }

  function resetFilters() {
    clearSelection();
    setDraftQuery('');
    setDraftStatus(undefined);
    setDraftAccessGroups([]);
    setDraftHasStaff('true');
    setSearchParams(buildAdminUserListSearchParams(DEFAULT_QUERY));
  }

  function handleTableChange(
    pagination: TablePaginationConfig,
    _filters: Record<string, FilterValue | null>,
    sorter: SorterResult<AdminUserListItem> | SorterResult<AdminUserListItem>[],
  ) {
    const normalizedSorter = Array.isArray(sorter) ? sorter[0] : sorter;
    const nextSortKey =
      (typeof normalizedSorter?.columnKey === 'string' ? normalizedSorter.columnKey : undefined) ??
      (typeof normalizedSorter?.field === 'string' ? normalizedSorter.field : undefined);
    const nextSortBy = isSortField(nextSortKey)
      ? nextSortKey
      : (criteria.sortBy ?? DEFAULT_QUERY.sortBy);
    const nextSortOrder = normalizedSorter?.order
      ? fromSorterOrder(normalizedSorter.order)
      : (criteria.sortOrder ?? DEFAULT_QUERY.sortOrder);

    clearSelection();
    setSearchParams(
      buildAdminUserListSearchParams({
        ...criteria,
        limit: pagination.pageSize ?? criteria.limit ?? DEFAULT_QUERY.limit,
        page: pagination.current ?? criteria.page ?? DEFAULT_QUERY.page,
        sortBy: nextSortBy,
        sortOrder: nextSortOrder,
      }),
    );
  }

  return (
    <div className="relative flex flex-col gap-6 min-h-[calc(100vh-120px)]">
      {messageContextHolder}

      {/* Header Section */}
      <div className="flex flex-col gap-1">
        <Flex align="center" gap={12}>
          <Typography.Title level={2} style={{ marginBottom: 0 }}>
            用户管理
          </Typography.Title>
          <Tag
            style={{
              margin: 0,
              border: 'none',
              background: 'var(--ant-color-fill-secondary)',
              padding: '0 8px',
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--ant-color-text-secondary)',
            }}
          >
            User Management
          </Tag>
        </Flex>
        <Typography.Paragraph
          type="secondary"
          style={{ marginBottom: 0, maxWidth: '42rem', fontSize: 13 }}
        >
          管理系统内的所有账户及其关联的 Staff 身份信息。
        </Typography.Paragraph>
      </div>

      {/* Filters Area */}
      <div className="rounded-card shadow-card transition-shadow duration-200 hover:shadow-card-hover">
        <Card>
          <Flex vertical gap={16}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
              <div className="xl:col-span-2">
                <Input.Search
                  allowClear
                  placeholder="搜索登录名、邮箱、昵称或工号..."
                  value={draftQuery}
                  onChange={(event) => setDraftQuery(event.target.value)}
                  onSearch={applyFilters}
                />
              </div>
              <Select<AdminUserAccountStatus | undefined>
                allowClear
                placeholder="账户状态"
                options={ACCOUNT_STATUS_OPTIONS}
                value={draftStatus}
                style={{ width: '100%' }}
                onChange={(value) => setDraftStatus(value)}
              />
              <Select<AuthAccessGroup[]>
                allowClear
                mode="multiple"
                maxTagCount="responsive"
                placeholder="访问组"
                options={ACCESS_GROUP_OPTIONS}
                value={[...draftAccessGroups]}
                style={{ width: '100%' }}
                onChange={(value) => setDraftAccessGroups(value)}
              />
              <Select<HasStaffFilterValue>
                options={[
                  { label: '全部用户类型', value: 'true' }, // Placeholder adjustment if logic allows
                  { label: '仅看 Staff', value: 'true' },
                  { label: '非 Staff 用户', value: 'false' },
                ]}
                value={draftHasStaff}
                style={{ width: '100%' }}
                onChange={(value) => setDraftHasStaff(value)}
              />
            </div>

            <Flex align="center" justify="space-between">
              <Typography.Text type="secondary" style={{ fontSize: 12, fontStyle: 'italic' }}>
                {filterSummary}
              </Typography.Text>
              <Flex gap={8}>
                <Button
                  onClick={resetFilters}
                  size="small"
                  type="text"
                  style={{ color: 'var(--ant-color-text-secondary)' }}
                >
                  重置
                </Button>
                <Button
                  type="primary"
                  onClick={applyFilters}
                  size="small"
                  style={{ paddingInline: 16 }}
                >
                  执行筛选
                </Button>
              </Flex>
            </Flex>
          </Flex>
        </Card>
      </div>

      {/* Table Area */}
      <div className="rounded-card shadow-card">
        <Card
          styles={{ body: { padding: 0 } }}
          title={
            <Flex align="center" gap={8}>
              <span className="text-sm font-semibold">用户列表</span>
              <Tag
                style={{
                  margin: 0,
                  border: 'none',
                  background: 'var(--ant-color-primary-bg)',
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--ant-color-primary)',
                  padding: '0 8px',
                }}
              >
                {totalCount}
              </Tag>
            </Flex>
          }
        >
          {accountStatusUpdateErrorMessage && (
            <div className="px-4 pt-4">
              <Alert
                type="error"
                showIcon
                closable
                message={accountStatusUpdateErrorMessage}
                onClose={() => setAccountStatusUpdateErrorMessage(null)}
              />
            </div>
          )}
          {staffEmploymentStatusUpdateErrorMessage && (
            <div className="px-4 pt-4">
              <Alert
                type="error"
                showIcon
                closable
                message={staffEmploymentStatusUpdateErrorMessage}
                onClose={() => setStaffEmploymentStatusUpdateErrorMessage(null)}
              />
            </div>
          )}

          <div>
            {errorMessage ? (
              <div className="p-6 text-center">
                <Alert
                  type="error"
                  showIcon
                  message="用户列表加载失败"
                  description={errorMessage}
                  action={
                    <Button size="small" type="primary" onClick={retry}>
                      重试
                    </Button>
                  }
                />
              </div>
            ) : !hasLoaded ? (
              <AdminUserListTableSkeleton />
            ) : (
              <div className="admin-user-table">
                <Table<AdminUserListItem>
                  rowKey={(record) => record.account.id}
                  columns={columns}
                  dataSource={result?.list ? [...result.list] : []}
                  loading={isLoading}
                  onChange={handleTableChange}
                  rowSelection={rowSelection}
                  onRow={(record) => ({
                    onClick: () => {
                      navigate({
                        pathname: `/admin/users/${record.account.id}`,
                        search: location.search,
                      });
                    },
                    style: { cursor: 'pointer' },
                  })}
                  pagination={{
                    current: currentPage,
                    pageSize,
                    showSizeChanger: true,
                    total: totalCount,
                    size: 'small',
                    className: 'px-4 py-3 m-0',
                    position: ['bottomCenter'],
                  }}
                  locale={{
                    emptyText: (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未找到匹配的用户" />
                    ),
                  }}
                />
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Floating Action Bar */}
      <div
        className={`fixed bottom-8 left-1/2 z-50 -translate-x-1/2 transition-all duration-300 ease-in-out ${
          selectedCount > 0
            ? 'translate-y-0 opacity-100'
            : 'translate-y-20 opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-4 rounded-full border border-border bg-bg-container/90 p-2 pl-4 shadow-surface backdrop-blur-md dark:border-white/10 dark:bg-gray-900/90">
          <div className="flex items-center gap-2 pr-2 border-r border-border dark:border-white/10">
            <span className="text-xs font-bold text-text">已选择</span>
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-black text-white">
              {selectedCount}
            </div>
          </div>

          <div className="flex items-center gap-2 py-1">
            <BulkActionPopover
              actionLabel="修改账户状态"
              count={selectedCount}
              disabled={isAnyStatusUpdateRunning}
              loading={updatingAccountStatusIds.length > 0}
              options={ACCOUNT_STATUS_BULK_OPTIONS}
              summary={`将对选中的 ${selectedCount} 个账户进行状态更新`}
              onSelect={handleBatchAccountStatusChange}
            />
            <BulkActionPopover
              actionLabel="修改在职状态"
              count={selectedCount}
              disabled={!canBulkUpdateStaff || isAnyStatusUpdateRunning}
              loading={updatingStaffEmploymentStatusIds.length > 0}
              options={ADMIN_USER_EMPLOYMENT_STATUSES.map((status) => ({
                label: ADMIN_USER_EMPLOYMENT_STATUS_LABELS[status],
                value: status,
              }))}
              summary={
                canBulkUpdateStaff
                  ? `将对选中的 ${selectedCount} 个 staff 进行状态更新`
                  : '仅当选择均为 staff 时可用'
              }
              onSelect={handleBatchStaffEmploymentStatusChange}
            />
            <Button type="text" onClick={clearSelection}>
              取消选择
            </Button>
          </div>
        </div>
      </div>

      <style>{`
        .admin-user-table .ant-table-thead > tr > th {
          background: transparent;
          font-size: 12px;
          color: var(--ant-color-text-secondary);
          font-weight: 600;
          padding: 12px 16px;
        }
        .admin-user-table .ant-table-tbody > tr > td {
          padding: 12px 16px;
        }
        .admin-user-table .ant-table-row:hover > td {
          background-color: var(--ant-color-fill-tertiary) !important;
        }
      `}</style>
    </div>
  );
}
