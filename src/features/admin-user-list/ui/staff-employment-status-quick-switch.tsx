import { type CSSProperties, useMemo, useState } from 'react';
import { EditOutlined } from '@ant-design/icons';
import { Button, Popover, Tag, Typography } from 'antd';

import {
  ADMIN_USER_EMPLOYMENT_STATUS_LABELS,
  ADMIN_USER_EMPLOYMENT_STATUSES,
  type AdminUserEmploymentStatus,
} from '../application/get-admin-users';

type StaffEmploymentStatusQuickSwitchProps = {
  accountId: number;
  disabled?: boolean;
  updating?: boolean;
  value: AdminUserEmploymentStatus;
  onChange: (nextStatus: AdminUserEmploymentStatus) => Promise<void> | void;
};

type StatusTone = {
  activeButtonStyle: CSSProperties;
  tagColor: string;
};

const STATUS_TONES: Record<AdminUserEmploymentStatus, StatusTone> = {
  ACTIVE: {
    activeButtonStyle: {
      backgroundColor: '#f0f9eb',
      borderColor: '#a9d18e',
      color: '#1f6f43',
    },
    tagColor: 'success',
  },
  LEFT: {
    activeButtonStyle: {
      backgroundColor: '#f5f5f5',
      borderColor: '#d9d9d9',
      color: '#595959',
    },
    tagColor: 'default',
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

export function StaffEmploymentStatusQuickSwitch({
  accountId,
  disabled = false,
  updating = false,
  value,
  onChange,
}: StaffEmploymentStatusQuickSwitchProps) {
  const [open, setOpen] = useState(false);
  const activeTone = STATUS_TONES[value];

  const popoverContent = useMemo(
    () => (
      <div className="flex max-w-64 flex-col gap-3">
        <Typography.Text strong>切换在职状态</Typography.Text>
        <div className="flex flex-wrap gap-2">
          {ADMIN_USER_EMPLOYMENT_STATUSES.map((status) => {
            const isActive = status === value;

            return (
              <Button
                key={status}
                size="small"
                data-testid={`staff-employment-status-option-${accountId}-${status}`}
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
                {ADMIN_USER_EMPLOYMENT_STATUS_LABELS[status]}
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
        {ADMIN_USER_EMPLOYMENT_STATUS_LABELS[value]}
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
          aria-label={`修改账户 ${accountId} 在职状态`}
          data-testid={`staff-employment-status-trigger-${accountId}`}
        />
      </Popover>
    </div>
  );
}
