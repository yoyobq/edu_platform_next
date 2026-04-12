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
  },
  error: {
    codeColor: 'var(--ant-color-error)',
  },
  neutral: {
    codeColor: 'var(--ant-color-text-quaternary)',
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
    <div className="error-block-root flex items-center justify-center overflow-hidden">
      <div className="error-block-shell flex w-full flex-col items-center text-center">
        <div className="error-block-visual relative flex w-full items-center justify-center">
          <div
            className="error-block-icon pointer-events-none absolute inset-0 flex items-center justify-center"
            style={{ color: toneStyle.codeColor }}
            aria-hidden
          >
            {icon}
          </div>
          <Flex vertical gap={6} align="center" className="error-block-content relative">
            <span
              className="error-block-status-code select-none"
              style={{ color: toneStyle.codeColor }}
            >
              {statusCode}
            </span>
            <Typography.Title
              level={4}
              style={{
                color: toneStyle.codeColor,
                fontSize: 'var(--error-block-title-font-size)',
                fontWeight: 'var(--error-block-title-font-weight)',
                letterSpacing: 'var(--error-block-title-letter-spacing)',
                marginBottom: 0,
                textTransform: 'uppercase',
              }}
            >
              {title}
            </Typography.Title>
          </Flex>
        </div>

        <Flex vertical gap={8} align="center">
          <Typography.Paragraph
            type="secondary"
            style={{
              marginBottom: 0,
              maxWidth: 'var(--error-block-description-max-width)',
              whiteSpace: 'pre-line',
            }}
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
