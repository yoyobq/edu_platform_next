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
import { Link, useLocation, useSearchParams } from 'react-router';

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
            className="font-medium"
            to={{ pathname: `/admin/users/${value}`, search: location.search }}
          >
            {value}
          </Link>
        ),
        sortOrder: criteria.sortBy === 'id' ? toSorterOrder(criteria.sortOrder ?? 'DESC') : null,
        sorter: true,
        title: '账户 ID',
        width: 104,
      },
      {
        dataIndex: ['staff', 'id'],
        key: 'staffId',
        title: '工号',
        width: 140,
        render: (_value: string | null, record: AdminUserListItem) => record.staff?.id || '—',
      },
      {
        dataIndex: ['staff', 'name'],
        key: 'staffName',
        title: '姓名',
        width: 160,
        render: (_value: string | null, record: AdminUserListItem) => record.staff?.name || '—',
      },
      {
        dataIndex: ['userInfo', 'accessGroup'],
        key: 'accessGroup',
        title: '访问组',
        width: 220,
        render: (value: readonly AuthAccessGroup[]) => (
          <Flex gap={4} wrap>
            {value.map((accessGroup) => (
              <Tag key={accessGroup} color="blue">
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
        width: 196,
        render: (value: AdminUserAccountStatus, record: AdminUserListItem) => (
          <AccountStatusQuickSwitch
            accountId={record.account.id}
            value={value}
            updating={updatingAccountStatusIds.includes(record.account.id)}
            disabled={
              isAnyStatusUpdateRunning && !updatingAccountStatusIds.includes(record.account.id)
            }
            onChange={(nextStatus) => handleStatusChange(record, nextStatus)}
          />
        ),
      },
      {
        dataIndex: ['staff', 'employmentStatus'],
        key: 'staffEmploymentStatus',
        title: '在职状态',
        width: 172,
        render: (_value: AdminUserEmploymentStatus | null, record: AdminUserListItem) =>
          record.staff ? (
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
          ) : (
            '—'
          ),
      },
      {
        dataIndex: ['account', 'createdAt'],
        key: 'createdAt',
        title: '创建时间',
        width: 168,
        render: (value: string) => formatDateTimeToMinute(value),
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
    <Flex vertical gap={24}>
      {messageContextHolder}
      <div className="flex flex-col gap-3">
        <Flex align="center" justify="space-between" gap={16} wrap>
          <Typography.Title level={2} style={{ marginBottom: 0 }}>
            用户管理
          </Typography.Title>
          <Tag color="processing">正式 admin 页面</Tag>
        </Flex>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0, maxWidth: 840 }}>
          当前列表直接消费后端 `adminUsers(...)` 聚合查询，先保留最适合扫读与筛选的字段，把
          细节型信息留给后续详情页。
        </Typography.Paragraph>
      </div>

      <Card>
        <Flex vertical gap={16}>
          <Flex align="center" justify="space-between" gap={16} wrap>
            <Flex vertical gap={4}>
              <Typography.Title level={4} style={{ marginBottom: 0 }}>
                筛选条件
              </Typography.Title>
              <Typography.Text type="secondary">{filterSummary}</Typography.Text>
            </Flex>
            <Tag color="blue">共 {totalCount} 人</Tag>
          </Flex>

          <div className="grid gap-4 xl:grid-cols-4">
            <Input.Search
              allowClear
              placeholder="搜索登录名、邮箱、昵称或 staff 姓名"
              value={draftQuery}
              onChange={(event) => setDraftQuery(event.target.value)}
              onSearch={applyFilters}
            />
            <Select<AdminUserAccountStatus | undefined>
              allowClear
              placeholder="账户状态"
              options={ACCOUNT_STATUS_OPTIONS}
              value={draftStatus}
              onChange={(value) => setDraftStatus(value)}
            />
            <Select<AuthAccessGroup[]>
              allowClear
              mode="multiple"
              placeholder="访问组"
              options={ACCESS_GROUP_OPTIONS}
              value={[...draftAccessGroups]}
              onChange={(value) => setDraftAccessGroups(value)}
            />
            <Select<HasStaffFilterValue>
              options={[
                { label: '仅看 staff', value: 'true' },
                { label: '仅看无 staff', value: 'false' },
              ]}
              value={draftHasStaff}
              onChange={(value) => setDraftHasStaff(value)}
            />
          </div>

          <Flex gap={12} wrap>
            <Button type="primary" onClick={applyFilters}>
              应用筛选
            </Button>
            <Button onClick={resetFilters}>重置条件</Button>
          </Flex>
        </Flex>
      </Card>

      <Card
        title="用户列表"
        extra={
          <Typography.Text type="secondary">
            第 {currentPage} 页 / 每页 {pageSize} 条
          </Typography.Text>
        }
      >
        {accountStatusUpdateErrorMessage ? (
          <Alert
            type="error"
            showIcon
            closable
            message="账户状态更新失败"
            description={accountStatusUpdateErrorMessage}
            style={{ marginBottom: 16 }}
            onClose={() => setAccountStatusUpdateErrorMessage(null)}
          />
        ) : null}
        {staffEmploymentStatusUpdateErrorMessage ? (
          <Alert
            type="error"
            showIcon
            closable
            message="在职状态更新失败"
            description={staffEmploymentStatusUpdateErrorMessage}
            style={{ marginBottom: 16 }}
            onClose={() => setStaffEmploymentStatusUpdateErrorMessage(null)}
          />
        ) : null}
        <div className="mb-4 rounded-block border border-border bg-bg-layout px-4 py-3">
          <Flex align="center" justify="space-between" gap={16} wrap>
            <Flex vertical gap={2}>
              <Typography.Text strong>批量操作</Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                当前页已选 {selectedCount} 项，可直接批量修改账户状态或在职状态。
              </Typography.Text>
            </Flex>
            <Flex gap={8} wrap>
              <BulkActionPopover
                actionLabel="批量改账户状态"
                count={selectedCount}
                disabled={selectedCount === 0 || isAnyStatusUpdateRunning}
                loading={updatingAccountStatusIds.length > 0}
                options={ACCOUNT_STATUS_BULK_OPTIONS}
                summary={`将对当前页选中的 ${selectedCount} 个用户生效。`}
                onSelect={handleBatchAccountStatusChange}
              />
              <BulkActionPopover
                actionLabel="批量改在职状态"
                count={selectedCount}
                disabled={!canBulkUpdateStaff || isAnyStatusUpdateRunning}
                loading={updatingStaffEmploymentStatusIds.length > 0}
                options={ADMIN_USER_EMPLOYMENT_STATUSES.map((status) => ({
                  label: ADMIN_USER_EMPLOYMENT_STATUS_LABELS[status],
                  value: status,
                }))}
                summary={
                  canBulkUpdateStaff
                    ? `将对当前页选中的 ${selectedCount} 个 staff 生效。`
                    : '仅当当前选择全部为 staff 时可批量修改在职状态。'
                }
                onSelect={handleBatchStaffEmploymentStatusChange}
              />
              <Button
                onClick={clearSelection}
                disabled={selectedCount === 0 || isAnyStatusUpdateRunning}
              >
                清空选择
              </Button>
            </Flex>
          </Flex>
        </div>
        {errorMessage ? (
          <Alert
            type="error"
            showIcon
            title="用户列表加载失败"
            description={errorMessage}
            action={
              <Button size="small" type="link" onClick={retry}>
                重试
              </Button>
            }
          />
        ) : !hasLoaded ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : (
          <Table<AdminUserListItem>
            rowKey={(record) => record.account.id}
            columns={columns}
            dataSource={result?.list ? [...result.list] : []}
            loading={isLoading}
            onChange={handleTableChange}
            rowSelection={rowSelection}
            pagination={{
              current: currentPage,
              pageSize,
              showSizeChanger: true,
              total: totalCount,
            }}
            locale={{
              emptyText: <Empty description="当前筛选条件下没有匹配用户。" />,
            }}
          />
        )}
      </Card>
    </Flex>
  );
}
