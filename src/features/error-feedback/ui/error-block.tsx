// src/features/error-feedback/ui/error-block.tsx

import { Button, Flex, Typography } from 'antd';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';

type ErrorBlockAction = {
  label: string;
  to?: string;
  onClick?: () => void;
};

type ErrorBlockProps = {
  /** 状态码，用于主视觉数字展示 */
  statusCode: number | string;
  /** 主标题 */
  title: string;
  /** 说明文案 */
  description: ReactNode;
  /** 图标 / 图形插槽 */
  icon: ReactNode;
  /** 色调：决定状态码数字和边框颜色 */
  tone: 'warning' | 'error' | 'neutral';
  /** 操作按钮列表 */
  actions?: ErrorBlockAction[];
};

const TONE_STYLES = {
  warning: {
    codeColor: 'var(--ant-color-warning)',
    borderColor: 'var(--ant-color-warning-border)',
  },
  error: {
    codeColor: 'var(--ant-color-error)',
    borderColor: 'var(--ant-color-error-border)',
  },
  neutral: {
    codeColor: 'var(--ant-color-text-quaternary)',
    borderColor: 'var(--ant-color-border)',
  },
};

export function ErrorBlock({
  statusCode,
  title,
  description,
  icon,
  tone,
  actions,
}: ErrorBlockProps) {
  const navigate = useNavigate();
  const toneStyle = TONE_STYLES[tone];

  return (
    <div className="flex min-h-[60vh] items-center justify-center overflow-hidden">
      <div className="flex w-full max-w-xl flex-col items-center gap-6 px-6 py-10 text-center">
        <div className="relative flex min-h-[220px] w-full items-center justify-center">
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            style={{ color: toneStyle.codeColor, opacity: 0.08, fontSize: 180 }}
            aria-hidden
          >
            {icon}
          </div>
          <Flex vertical gap={6} align="center" className="relative z-10">
            <span
              className="select-none text-[96px] font-black leading-none tracking-[-0.06em] sm:text-[128px]"
              style={{ color: toneStyle.codeColor }}
            >
              {statusCode}
            </span>
            <div className="text-base font-semibold uppercase tracking-[0.4em]">
              <Typography.Text strong style={{ color: toneStyle.codeColor }}>
                {title}
              </Typography.Text>
            </div>
          </Flex>
        </div>

        <Flex vertical gap={8} align="center">
          <Typography.Paragraph
            type="secondary"
            style={{ marginBottom: 0, maxWidth: 420, whiteSpace: 'pre-line' }}
          >
            {description}
          </Typography.Paragraph>
        </Flex>

        {actions && actions.length > 0 ? (
          <Flex gap={12} wrap justify="center">
            {actions.map((action, index) => (
              <Button
                key={action.to ?? action.label}
                type={index === 0 ? 'primary' : 'default'}
                onClick={() => {
                  if (action.onClick) {
                    action.onClick();
                    return;
                  }

                  if (action.to) {
                    navigate(action.to);
                  }
                }}
              >
                {action.label}
              </Button>
            ))}
          </Flex>
        ) : null}
      </div>
    </div>
  );
}
