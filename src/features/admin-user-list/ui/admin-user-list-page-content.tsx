import { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Empty,
  Flex,
  Input,
  Select,
  Skeleton,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { FilterValue, SorterResult, TablePaginationConfig } from 'antd/es/table/interface';

import { AUTH_ACCESS_GROUPS, type AuthAccessGroup } from '@/shared/auth-access';

import {
  ADMIN_USER_ACCOUNT_STATUSES,
  ADMIN_USER_SORT_FIELDS,
  type AdminUserAccountStatus,
  type AdminUserListItem,
  type AdminUserListQuery,
  type AdminUserSortField,
  type AdminUserSortOrder,
  DEFAULT_ADMIN_USER_LIST_QUERY,
} from '../application/get-admin-users';
import { useAdminUserList } from '../application/use-admin-user-list';

type HasStaffFilterValue = 'all' | 'true' | 'false';

const DEFAULT_QUERY = DEFAULT_ADMIN_USER_LIST_QUERY;

const ACCOUNT_STATUS_OPTIONS = ADMIN_USER_ACCOUNT_STATUSES.map((status) => ({
  label: status,
  value: status,
}));

const ACCESS_GROUP_OPTIONS = AUTH_ACCESS_GROUPS.map((accessGroup) => ({
  label: accessGroup,
  value: accessGroup,
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

function toStatusColor(status: string) {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'PENDING':
      return 'processing';
    case 'INACTIVE':
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

function toSorterOrder(sortOrder: AdminUserSortOrder): 'ascend' | 'descend' {
  return sortOrder === 'ASC' ? 'ascend' : 'descend';
}

function fromSorterOrder(value: 'ascend' | 'descend' | null | undefined): AdminUserSortOrder {
  return value === 'ascend' ? 'ASC' : 'DESC';
}

function normalizeHasStaff(value: HasStaffFilterValue): boolean | undefined {
  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return undefined;
}

function resolveFilterSummary(criteria: AdminUserListQuery) {
  const parts: string[] = [];

  if (criteria.query) {
    parts.push(`搜索“${criteria.query}”`);
  }

  if (criteria.status) {
    parts.push(`状态 ${criteria.status}`);
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

export function AdminUserListPageContent() {
  const [draftQuery, setDraftQuery] = useState('');
  const [draftStatus, setDraftStatus] = useState<AdminUserAccountStatus | undefined>(undefined);
  const [draftAccessGroups, setDraftAccessGroups] = useState<readonly AuthAccessGroup[]>([]);
  const [draftHasStaff, setDraftHasStaff] = useState<HasStaffFilterValue>('all');
  const [criteria, setCriteria] = useState<AdminUserListQuery>(DEFAULT_QUERY);
  const { errorMessage, hasLoaded, isLoading, result, retry } = useAdminUserList(criteria);

  const filterSummary = useMemo(() => resolveFilterSummary(criteria), [criteria]);
  const totalCount = result?.total ?? 0;
  const currentPage = result?.current ?? criteria.page ?? DEFAULT_QUERY.page;
  const pageSize = result?.pageSize ?? criteria.limit ?? DEFAULT_QUERY.limit;

  const columns = useMemo(
    () => [
      {
        dataIndex: ['account', 'id'],
        key: 'id',
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
        width: 120,
        render: (value: string) => <Tag color={toStatusColor(value)}>{value}</Tag>,
      },
      {
        dataIndex: ['account', 'createdAt'],
        key: 'createdAt',
        title: '创建时间',
        width: 168,
        render: (value: string) => formatDateTimeToMinute(value),
      },
    ],
    [criteria.sortBy, criteria.sortOrder],
  );

  function applyFilters() {
    setCriteria((currentCriteria) => ({
      ...currentCriteria,
      accessGroups: draftAccessGroups.length > 0 ? draftAccessGroups : undefined,
      hasStaff: normalizeHasStaff(draftHasStaff),
      page: 1,
      query: draftQuery.trim() || undefined,
      status: draftStatus,
    }));
  }

  function resetFilters() {
    setDraftQuery('');
    setDraftStatus(undefined);
    setDraftAccessGroups([]);
    setDraftHasStaff('all');
    setCriteria(DEFAULT_QUERY);
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

    setCriteria((currentCriteria) => ({
      ...currentCriteria,
      limit: pagination.pageSize ?? currentCriteria.limit ?? DEFAULT_QUERY.limit,
      page: pagination.current ?? currentCriteria.page ?? DEFAULT_QUERY.page,
      sortBy: nextSortBy,
      sortOrder: nextSortOrder,
    }));
  }

  return (
    <Flex vertical gap={24}>
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
                { label: '全部用户', value: 'all' },
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
