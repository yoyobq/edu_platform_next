import { type CSSProperties, useMemo, useState } from 'react';
import { EditOutlined } from '@ant-design/icons';
import { Button, Popover, Tag, Typography } from 'antd';

import {
  ADMIN_USER_ACCOUNT_STATUS_LABELS,
  ADMIN_USER_ACCOUNT_STATUSES,
  type AdminUserAccountStatus,
} from '../application/get-admin-users';

type AccountStatusQuickSwitchProps = {
  accountId: number;
  disabled?: boolean;
  updating?: boolean;
  value: AdminUserAccountStatus;
  onChange: (nextStatus: AdminUserAccountStatus) => Promise<void> | void;
};

type StatusTone = {
  activeButtonStyle: CSSProperties;
  tagColor: string;
};

const STATUS_TONES: Record<AdminUserAccountStatus, StatusTone> = {
  ACTIVE: {
    activeButtonStyle: {
      backgroundColor: '#f0f9eb',
      borderColor: '#a9d18e',
      color: '#1f6f43',
    },
    tagColor: 'success',
  },
  BANNED: {
    activeButtonStyle: {
      backgroundColor: '#fff1f0',
      borderColor: '#ffb3b3',
      color: '#b42318',
    },
    tagColor: 'error',
  },
  DELETED: {
    activeButtonStyle: {
      backgroundColor: '#fff1f0',
      borderColor: '#ffb3b3',
      color: '#b42318',
    },
    tagColor: 'error',
  },
  INACTIVE: {
    activeButtonStyle: {
      backgroundColor: '#f5f5f5',
      borderColor: '#d9d9d9',
      color: '#595959',
    },
    tagColor: 'default',
  },
  PENDING: {
    activeButtonStyle: {
      backgroundColor: '#e6f4ff',
      borderColor: '#91caff',
      color: '#0958d9',
    },
    tagColor: 'processing',
  },
  SUSPENDED: {
    activeButtonStyle: {
      backgroundColor: '#fff7e6',
      borderColor: '#ffd591',
      color: '#ad6800',
    },
    tagColor: 'warning',
  },
};

const IDLE_OPTION_BUTTON_STYLE: CSSProperties = {
  backgroundColor: '#fafafa',
  borderColor: '#d9d9d9',
  color: '#595959',
};

export function AccountStatusQuickSwitch({
  accountId,
  disabled = false,
  updating = false,
  value,
  onChange,
}: AccountStatusQuickSwitchProps) {
  const [open, setOpen] = useState(false);
  const activeTone = STATUS_TONES[value];

  const popoverContent = useMemo(
    () => (
      <div className="flex max-w-64 flex-col gap-3">
        <Typography.Text strong>切换账户状态</Typography.Text>
        <div className="flex flex-wrap gap-2">
          {ADMIN_USER_ACCOUNT_STATUSES.map((status) => {
            const isActive = status === value;

            return (
              <Button
                key={status}
                size="small"
                data-testid={`account-status-option-${accountId}-${status}`}
                aria-pressed={isActive}
                style={isActive ? STATUS_TONES[status].activeButtonStyle : IDLE_OPTION_BUTTON_STYLE}
                onClick={() => {
                  if (isActive || updating) {
                    return;
                  }

                  setOpen(false);
                  void onChange(status);
                }}
              >
                {ADMIN_USER_ACCOUNT_STATUS_LABELS[status]}
              </Button>
            );
          })}
        </div>
      </div>
    ),
    [accountId, onChange, updating, value],
  );

  return (
    <div className="flex items-center gap-2">
      <Tag color={activeTone.tagColor} style={{ marginInlineEnd: 0 }}>
        {ADMIN_USER_ACCOUNT_STATUS_LABELS[value]}
      </Tag>
      <Popover
        trigger="click"
        open={open}
        placement="bottomLeft"
        content={popoverContent}
        onOpenChange={(nextOpen) => {
          if (updating) {
            return;
          }

          setOpen(nextOpen);
        }}
      >
        <Button
          type="text"
          shape="circle"
          size="small"
          loading={updating}
          disabled={disabled}
          icon={<EditOutlined />}
          aria-label={`修改账户 ${accountId} 状态`}
          data-testid={`account-status-trigger-${accountId}`}
        />
      </Popover>
    </div>
  );
}
