import { type Key, type ReactNode, useMemo } from 'react';
import { Alert, Empty, Flex, Input, Space, Table, Tag, Typography } from 'antd';

import type { AdminUserListItem } from '@/entities/admin-user';

function renderOptionalText(value: string | null | undefined) {
  return value ? value : <span className="text-text-quaternary">—</span>;
}

function getStatusTagColor(status: string) {
  if (status === 'ACTIVE') {
    return 'green';
  }

  if (status === 'PENDING') {
    return 'gold';
  }

  if (status === 'SUSPENDED' || status === 'INACTIVE') {
    return 'orange';
  }

  if (status === 'BANNED' || status === 'DELETED') {
    return 'red';
  }

  return 'blue';
}

function getAccessGroupTagColor(group: string) {
  if (group === 'ADMIN') {
    return 'purple';
  }

  if (group === 'STAFF') {
    return 'blue';
  }

  if (group === 'STUDENT') {
    return 'green';
  }

  if (group === 'GUEST') {
    return 'default';
  }

  return 'cyan';
}

function getAllIdentityTags(record: AdminUserListItem) {
  return record.userInfo.accessGroup;
}

export function VerificationAccountPickerTable({
  action,
  currentList,
  currentPage,
  emptyDescription,
  errorMessage,
  getIdentityTags = getAllIdentityTags,
  isLoading,
  onPageChange,
  onQueryChange,
  onSearch,
  onSelectionChange,
  pageSize,
  query,
  searchPlaceholder,
  selectedAccountIds,
  selectedSummary = null,
  selectionMode,
  totalCount,
}: {
  action: ReactNode;
  currentList: readonly AdminUserListItem[];
  currentPage: number;
  emptyDescription: string;
  errorMessage: string | null;
  getIdentityTags?: (record: AdminUserListItem) => readonly string[];
  isLoading: boolean;
  onPageChange: (page: number, pageSize: number) => void;
  onQueryChange: (query: string) => void;
  onSearch: (query: string) => void;
  onSelectionChange: (selectedRowKeys: readonly Key[]) => void;
  pageSize: number;
  query: string;
  searchPlaceholder: string;
  selectedAccountIds: readonly number[];
  selectedSummary?: ReactNode;
  selectionMode: 'multiple' | 'single';
  totalCount: number;
}) {
  const columns = useMemo(
    () => [
      {
        dataIndex: ['account', 'id'],
        key: 'id',
        render: (value: number) => <span className="font-mono text-sm">#{value}</span>,
        title: '账号 ID',
        width: 110,
      },
      {
        dataIndex: ['account', 'loginEmail'],
        key: 'loginEmail',
        render: (value: string | null) => (
          <Typography.Text copyable={Boolean(value)}>{renderOptionalText(value)}</Typography.Text>
        ),
        title: '登陆邮箱',
        width: 240,
      },
      {
        dataIndex: ['userInfo', 'nickname'],
        key: 'nickname',
        render: (value: string | null) => (
          <span className="font-medium">{renderOptionalText(value)}</span>
        ),
        title: 'nickname',
        width: 180,
      },
      {
        dataIndex: ['account', 'loginName'],
        key: 'loginName',
        render: (value: string | null) => (
          <span className="font-mono text-sm text-text-secondary">{renderOptionalText(value)}</span>
        ),
        title: 'loginName',
        width: 180,
      },
      {
        dataIndex: ['userInfo', 'accessGroup'],
        key: 'accessGroup',
        render: (_value: readonly string[], record: AdminUserListItem) => (
          <Space wrap size={4}>
            {getIdentityTags(record).map((group) => (
              <Tag key={group} color={getAccessGroupTagColor(group)} style={{ margin: 0 }}>
                {group}
              </Tag>
            ))}
          </Space>
        ),
        title: '访问组',
        width: 180,
      },
      {
        dataIndex: ['account', 'status'],
        key: 'status',
        render: (value: string) => (
          <Tag color={getStatusTagColor(value)} style={{ margin: 0 }}>
            {value}
          </Tag>
        ),
        title: '状态',
        width: 120,
      },
    ],
    [getIdentityTags],
  );

  const rowSelection = useMemo(
    () => ({
      selectedRowKeys: [...selectedAccountIds],
      type: selectionMode === 'single' ? ('radio' as const) : ('checkbox' as const),
      onChange: (nextSelectedRowKeys: Key[]) => {
        onSelectionChange(nextSelectedRowKeys);
      },
    }),
    [onSelectionChange, selectedAccountIds, selectionMode],
  );

  return (
    <Flex vertical gap={16}>
      <Flex gap={12} justify="space-between" wrap>
        <Input.Search
          allowClear
          enterButton="搜索"
          placeholder={searchPlaceholder}
          style={{ maxWidth: 420 }}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onSearch={onSearch}
        />
        <Space wrap>
          {selectedSummary ? (
            <Typography.Text type="secondary">{selectedSummary}</Typography.Text>
          ) : null}
          {action}
        </Space>
      </Flex>

      {errorMessage ? <Alert showIcon type="error" title={errorMessage} /> : null}

      <div className="verification-issuance-user-table">
        <Table<AdminUserListItem>
          rowKey={(record) => record.account.id}
          columns={columns}
          dataSource={[...currentList]}
          loading={isLoading}
          rowSelection={rowSelection}
          scroll={{ x: 1010 }}
          pagination={{
            current: currentPage,
            className: 'px-4 py-3 m-0',
            pageSize,
            placement: ['bottomCenter'],
            pageSizeOptions: [10, 20, 50, 100],
            showSizeChanger: true,
            size: 'small',
            total: totalCount,
          }}
          locale={{
            emptyText: (
              <Empty description={emptyDescription} image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ),
          }}
          onChange={(pagination) => {
            onPageChange(pagination.current ?? 1, pagination.pageSize ?? pageSize);
          }}
        />
      </div>

      <style>{`
        .verification-issuance-user-table .ant-table-thead > tr > th {
          background: transparent;
          color: var(--ant-color-text-secondary);
          font-size: var(--ant-font-size-sm);
          font-weight: 600;
          padding: 12px 16px;
        }

        .verification-issuance-user-table .ant-table-tbody > tr > td {
          padding: 12px 16px;
        }

        .verification-issuance-user-table .ant-table-row:hover > td {
          background-color: var(--ant-color-fill-tertiary) !important;
        }
      `}</style>
    </Flex>
  );
}
