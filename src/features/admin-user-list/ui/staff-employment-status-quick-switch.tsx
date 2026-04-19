import { useMemo, useState } from 'react';
import { CaretDownOutlined } from '@ant-design/icons';
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

const STATUS_COLORS: Record<AdminUserEmploymentStatus, string> = {
  ACTIVE: 'success',
  LEFT: 'default',
  SUSPENDED: 'warning',
};

export function StaffEmploymentStatusQuickSwitch({
  disabled = false,
  updating = false,
  value,
  onChange,
}: StaffEmploymentStatusQuickSwitchProps) {
  const [open, setOpen] = useState(false);

  const popoverContent = useMemo(
    () => (
      <div className="flex w-40 flex-col gap-2 p-1">
        <Typography.Text
          type="secondary"
          style={{
            paddingInline: 8,
            paddingBlock: 4,
            fontSize: 'var(--ant-font-size-sm)',
            fontWeight: 500,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          切换在职状态
        </Typography.Text>
        <div className="flex flex-col gap-1">
          {ADMIN_USER_EMPLOYMENT_STATUSES.map((status) => {
            const isActive = status === value;

            return (
              <div
                key={status}
                className={`rounded-md px-2 transition-colors duration-150 ${
                  isActive ? 'bg-fill-hover font-medium' : 'hover:bg-fill-hover'
                }`}
              >
                <Button
                  type="text"
                  block
                  style={{ height: 'auto', padding: 0, textAlign: 'left' }}
                  onClick={() => {
                    if (isActive || updating) {
                      return;
                    }

                    setOpen(false);
                    void onChange(status);
                  }}
                >
                  <div className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      <Tag
                        color={STATUS_COLORS[status]}
                        style={{
                          margin: 0,
                          border: 'none',
                          paddingInline: 6,
                          transform: 'scale(0.9)',
                        }}
                      >
                        {ADMIN_USER_EMPLOYMENT_STATUS_LABELS[status]}
                      </Tag>
                    </div>
                    {isActive && (
                      <div className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_4px_rgba(24,144,255,0.5)]" />
                    )}
                  </div>
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    ),
    [onChange, updating, value],
  );

  return (
    <Popover
      trigger="click"
      open={open}
      placement="bottomLeft"
      content={popoverContent}
      classNames={{ root: 'p-0' }}
      onOpenChange={(nextOpen) => {
        if (updating || disabled) {
          return;
        }

        setOpen(nextOpen);
      }}
    >
      <div
        className={`group flex w-fit cursor-pointer items-center gap-1.5 rounded-badge border border-transparent px-1.5 py-0.5 transition-all duration-200 hover:border-border hover:bg-fill-hover ${
          updating ? 'opacity-70 grayscale pointer-events-none' : ''
        } ${disabled ? 'cursor-not-allowed opacity-50 grayscale pointer-events-none' : ''}`}
      >
        <Tag
          color={STATUS_COLORS[value]}
          style={{ margin: 0, border: 'none', paddingInline: 8, fontWeight: 500 }}
        >
          {ADMIN_USER_EMPLOYMENT_STATUS_LABELS[value]}
        </Tag>
        <CaretDownOutlined className="text-[10px] text-text-secondary opacity-40 transition-opacity duration-200 group-hover:opacity-100" />
      </div>
    </Popover>
  );
}
