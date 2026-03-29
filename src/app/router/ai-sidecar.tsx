import { useRef } from 'react';
import { Bubble, Sender } from '@ant-design/x';
import { Alert, Divider, Drawer, Typography } from 'antd';

import { useSidecarSession } from './sidecar-session';
import { useSidecarState } from './sidecar-state';

function readZIndexToken(tokenName: string, fallbackValue: number): number {
  if (typeof window === 'undefined') {
    return fallbackValue;
  }

  const tokenValue = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue(tokenName)
    .trim();
  const parsedValue = Number.parseInt(tokenValue, 10);

  return Number.isNaN(parsedValue) ? fallbackValue : parsedValue;
}

export function AiSidecar() {
  const { availability, close, isOpen } = useSidecarState();
  const { session, setQuery, submitQuery } = useSidecarSession();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const sidecarZIndex = readZIndexToken('--z-index-sidecar-container', 1100);
  const isUnavailable = availability === 'unavailable';
  const visibleMessages =
    session.messages.length > 0
      ? session.messages
      : [
          {
            id: 'system-welcome',
            role: 'system' as const,
            content: '请问你要做什么？',
          },
        ];

  return (
    <Drawer
      open={isOpen}
      title={
        <div className="flex items-center gap-2">
          <span className="text-lg">✨</span>
          <span>从这里开始</span>
        </div>
      }
      placement="right"
      size="large"
      onClose={close}
      afterOpenChange={(nextOpen) => {
        if (!nextOpen) {
          return;
        }

        window.requestAnimationFrame(() => {
          const focusTarget = panelRef.current?.querySelector<HTMLElement>(
            'textarea:not([disabled]), input:not([disabled]), button',
          );
          focusTarget?.focus();
        });
      }}
      keyboard
      destroyOnHidden={false}
      zIndex={sidecarZIndex}
      styles={{
        body: { paddingTop: 16, display: 'flex', flexDirection: 'column' },
      }}
    >
      <div ref={panelRef} className="flex h-full flex-col space-y-4">
        {isUnavailable ? (
          <Alert type="info" showIcon title="智能入口暂未开启，你仍可正常使用项目功能。" />
        ) : (
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            这里是语义入口与协作层。关闭后，不影响主业务操作。
          </Typography.Paragraph>
        )}

        <Divider style={{ marginBlock: 0 }} />

        <div className="flex-1 overflow-y-auto">
          <div className="flex h-full flex-col justify-center gap-4">
            {visibleMessages.map((message) => (
              <div
                key={message.id}
                className={message.role === 'user' ? 'ml-auto max-w-[85%]' : 'max-w-[85%]'}
              >
                <Bubble
                  placement={message.role === 'user' ? 'end' : 'start'}
                  content={message.content}
                />
              </div>
            ))}
            <Typography.Text type="secondary">
              {isUnavailable
                ? '智能入口暂未连接。你仍可输入目标页面名称，先查看相关入口卡片，再进入对应页面。'
                : '你可以直接描述目标，我会帮你找到页面、整理信息或起草下一步。'}
            </Typography.Text>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-bg-container p-4 shadow-sm">
          <Sender
            value={session.query}
            onChange={(value) => setQuery(value)}
            onSubmit={(message) =>
              submitQuery({
                message,
                mode: isUnavailable ? 'local' : 'ai',
              })
            }
            placeholder={
              isUnavailable ? '输入你想去的页面名称' : '告诉我你想查看什么，或想完成什么'
            }
          />
        </div>
      </div>
    </Drawer>
  );
}
