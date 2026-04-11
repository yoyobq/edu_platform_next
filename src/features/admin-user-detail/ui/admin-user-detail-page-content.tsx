import { type CSSProperties, type ReactNode, useMemo } from 'react';
import { Alert, Avatar, Button, Card, Flex, Skeleton, Tag, Typography } from 'antd';
import { useLocation, useNavigate } from 'react-router';

import type {
  AdminUserDetail,
  AdminUserDetailAccountStatus,
  AdminUserDetailUserState,
} from '../application/get-admin-user-detail';
import {
  ADMIN_USER_DETAIL_ACCOUNT_STATUS_LABELS,
  ADMIN_USER_DETAIL_USER_STATE_LABELS,
} from '../application/get-admin-user-detail';
import {
  type AdminUserDetailLoader,
  useAdminUserDetail,
} from '../application/use-admin-user-detail';

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

function getStatusTagColor(status: AdminUserDetailAccountStatus | AdminUserDetailUserState) {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'PENDING':
      return 'processing';
    case 'INACTIVE':
      return 'default';
    case 'BANNED':
    case 'DELETED':
    case 'SUSPENDED':
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
    <Flex align="center" gap={12} justify="space-between">
      <Typography.Text
        type="secondary"
        style={compact ? { fontSize: 12, lineHeight: 1.2 } : undefined}
      >
        {title}
      </Typography.Text>
      <Typography.Text
        type="secondary"
        style={{
          fontSize: compact ? 11 : 12,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          lineHeight: 1.2,
          marginLeft: 'auto',
        }}
      >
        {subtitle}
      </Typography.Text>
    </Flex>
  );
}

function ReadonlyValue({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex max-w-full rounded-badge border border-border bg-bg-layout px-2.5 py-1">
      <Typography.Text
        style={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 13,
          lineHeight: 1.2,
          overflowWrap: 'anywhere',
        }}
      >
        {children}
      </Typography.Text>
    </div>
  );
}

function getSectionToneStyle(tone: DetailSection['tone']) {
  switch (tone) {
    case 'editable':
      return {
        bodyClassName: 'border-info-border bg-info-bg p-4',
        gridClassName: 'grid gap-3 md:grid-cols-2 xl:grid-cols-3',
        itemClassName: 'border-info-border bg-bg-container',
        itemStyle: undefined,
        valueClassName: '',
        valueStyle: undefined,
      };
    case 'reference':
      return {
        bodyClassName: 'border-transparent p-0',
        bodyStyle: {
          backgroundColor: 'transparent',
        } satisfies CSSProperties,
        gridClassName: 'grid gap-2 md:grid-cols-2 xl:grid-cols-4',
        itemClassName: '',
        itemStyle: {
          backgroundColor: 'var(--ant-color-fill-tertiary)',
          borderColor: 'transparent',
          padding: '8px 10px',
        } satisfies CSSProperties,
        valueClassName: 'text-text-secondary',
        valueStyle: {
          fontSize: 12,
          lineHeight: 1.25,
        } satisfies CSSProperties,
      };
    case 'fixed':
    default:
      return {
        bodyClassName: 'border-border bg-bg-layout p-4',
        gridClassName: 'grid gap-3 md:grid-cols-2 xl:grid-cols-3',
        itemClassName: 'border-border bg-bg-container',
        itemStyle: undefined,
        valueClassName: '',
        valueStyle: undefined,
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
  itemStyle?: React.CSSProperties;
  valueClassName: string;
  valueStyle?: React.CSSProperties;
}) {
  return (
    <div className={gridClassName}>
      {items.map((item) => (
        <div
          key={item.key}
          className={`rounded-block border px-4 py-3 ${itemClassName}`}
          style={itemStyle}
        >
          {item.label}
          <div className={valueClassName} style={{ ...valueStyle, marginTop: 6 }}>
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
    <div className={`rounded-card border ${toneStyle.bodyClassName}`} style={toneStyle.bodyStyle}>
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

function DetailSectionList({ sections }: { sections: readonly DetailSection[] }) {
  return (
    <Flex vertical gap={20}>
      {sections.map((section) => (
        <div key={section.key}>
          <DetailSectionBlock section={section} />
        </div>
      ))}
    </Flex>
  );
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

function buildAccountSections(detail: AdminUserDetail): readonly DetailSection[] {
  return [
    {
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
    {
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
    {
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
  ];
}

function buildUserInfoSections(detail: AdminUserDetail): readonly DetailSection[] {
  return [
    {
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
    {
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
          value:
            detail.userInfo.accessGroup.length > 0 ? (
              <Flex gap={4} wrap>
                {detail.userInfo.accessGroup.map((accessGroup) => (
                  <Tag key={accessGroup} color="blue">
                    {accessGroup}
                  </Tag>
                ))}
              </Flex>
            ) : (
              '—'
            ),
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
          value: detail.userInfo.gender,
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
          value: formatOptionalValue(detail.userInfo.geographic),
        },
        {
          key: 'signature',
          label: <BilingualLabel title="个性签名" subtitle="Signature" />,
          value: formatOptionalValue(detail.userInfo.signature),
        },
        {
          key: 'tags',
          label: <BilingualLabel title="标签" subtitle="Tags" />,
          value:
            detail.userInfo.tags && detail.userInfo.tags.length > 0
              ? detail.userInfo.tags.join(' / ')
              : '—',
        },
      ],
      key: 'userProfile',
      tone: 'editable',
    },
    {
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
  ];
}

export function AdminUserDetailPageContent({
  accountId,
  loadDetail,
}: {
  accountId: number;
  loadDetail: AdminUserDetailLoader;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { errorMessage, hasLoaded, isLoading, result, retry } = useAdminUserDetail(
    accountId,
    loadDetail,
  );

  const accountSections = useMemo(() => (result ? buildAccountSections(result) : []), [result]);
  const userInfoSections = useMemo(() => (result ? buildUserInfoSections(result) : []), [result]);

  return (
    <Flex vertical gap={24}>
      <div className="flex flex-col gap-3">
        <Flex align="center" justify="space-between" gap={16} wrap>
          <div className="flex flex-col gap-2">
            <Flex align="center" gap={12} wrap>
              <Typography.Title level={2} style={{ marginBottom: 0 }}>
                用户详情
              </Typography.Title>
              <Typography.Text
                type="secondary"
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: 13,
                }}
              >
                User Detail
              </Typography.Text>
              <Tag color="processing">示例页面</Tag>
            </Flex>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0, maxWidth: 880 }}>
              当前先接好 `account(id)` 与 `userInfo(accountId)` 两块正式数据，把 staff
              区域预留出来，后续再接完整 identity 详情。
            </Typography.Paragraph>
          </div>
          <Button onClick={() => navigate({ pathname: '/admin/users', search: location.search })}>
            返回列表
          </Button>
        </Flex>
      </div>

      {!hasLoaded ? (
        <Skeleton active paragraph={{ rows: 12 }} />
      ) : errorMessage || !result ? (
        <Alert
          type="error"
          showIcon
          message="用户详情加载失败"
          description={errorMessage || '当前账户详情不可用。'}
          action={
            <Button size="small" type="link" onClick={retry}>
              重试
            </Button>
          }
        />
      ) : (
        <>
          <Card>
            <Flex align="center" gap={16} wrap>
              <Avatar size={64} src={result.userInfo.avatarUrl || undefined}>
                {result.userInfo.nickname?.trim()?.slice(0, 1) ||
                  String(result.account.id).slice(-2)}
              </Avatar>
              <Flex vertical gap={4}>
                <Flex align="center" gap={8} wrap>
                  <Typography.Title level={4} style={{ marginBottom: 0 }}>
                    {formatOptionalValue(result.userInfo.nickname)}
                  </Typography.Title>
                  <Tag color={getStatusTagColor(result.account.status)}>
                    {ADMIN_USER_DETAIL_ACCOUNT_STATUS_LABELS[result.account.status]}
                  </Tag>
                </Flex>
                <Typography.Text type="secondary">
                  账户 #{result.account.id} · {formatOptionalValue(result.account.loginName)}
                </Typography.Text>
                {result.userInfo.accessGroup.length > 0 ? (
                  <Flex gap={4} wrap>
                    {result.userInfo.accessGroup.map((accessGroup) => (
                      <Tag key={accessGroup} color="blue">
                        {accessGroup}
                      </Tag>
                    ))}
                  </Flex>
                ) : null}
              </Flex>
            </Flex>
          </Card>

          <Card title={<BilingualLabel title="账户信息" subtitle="Account" />}>
            <DetailSectionList sections={accountSections} />
          </Card>

          <Card title={<BilingualLabel title="用户信息" subtitle="User Info" />}>
            <DetailSectionList sections={userInfoSections} />
          </Card>

          <Card title={<BilingualLabel title="Staff 信息" subtitle="Staff" />}>
            <Alert
              type="info"
              showIcon
              message="该区域已预留"
              description="当前示例页先不接 staff 详情查询；后续后端补齐 identity / staff 读取能力后，再把工号、姓名、职务、部门、在职状态接进来。"
            />
          </Card>

          <Card title={<BilingualLabel title="最近登录" subtitle="Recent Login" />}>
            <RecentLoginList items={result.account.recentLoginHistory} />
          </Card>
        </>
      )}

      {hasLoaded && isLoading ? <Skeleton active paragraph={{ rows: 4 }} /> : null}
    </Flex>
  );
}
