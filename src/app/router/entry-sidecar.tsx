import { type CSSProperties, useCallback, useRef, useState } from 'react';
import { Bubble, Sender } from '@ant-design/x';
import type { SenderRef } from '@ant-design/x/es/sender';
import { Alert, Button, Card, Divider, Drawer, Typography } from 'antd';
import { useNavigate } from 'react-router';

import { useCollaborationSession } from './collaboration-session';
import { useRegisterKeyboardShortcut } from './keyboard-shortcut-stack';
import { useSidecarState } from './sidecar-state';
import { useWidthBand } from './use-width-band';

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

export function EntrySidecar() {
  const { close, isOpen } = useSidecarState();
  const { session, submitQuery } = useCollaborationSession();
  const navigate = useNavigate();
  const [draft, setDraft] = useState('');
  const panelRef = useRef<HTMLDivElement | null>(null);
  const senderRef = useRef<SenderRef | null>(null);
  const sidecarZIndex = readZIndexToken('--z-index-sidecar-container', 1100);
  const isUnavailable = session.availability === 'unavailable';
  const { band: sidecarWidthBand, width: sidecarWidth } = useWidthBand(
    panelRef,
    [{ max: 440, value: 'compact' }],
    'comfortable',
  );
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

  const closeSidecar = useCallback(() => {
    close();
  }, [close]);

  useRegisterKeyboardShortcut(
    {
      key: 'Escape',
      priority: 'sidecar',
      handler: closeSidecar,
    },
    isOpen,
  );

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
          senderRef.current?.inputElement?.focus();
        });
      }}
      keyboard={false}
      destroyOnHidden={false}
      zIndex={sidecarZIndex}
      styles={{
        body: { paddingTop: 16, display: 'flex', flexDirection: 'column' },
      }}
    >
      <div
        ref={panelRef}
        className="flex h-full flex-col space-y-4"
        data-sidecar-width-band={sidecarWidthBand}
        style={{ '--layout-sidecar-width': `${Math.round(sidecarWidth)}px` } as CSSProperties}
      >
        {isUnavailable ? (
          <Alert type="info" showIcon title="智能入口暂未开启，你仍可正常使用项目功能。" />
        ) : (
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            这里是语义入口与协作层。关闭后，不影响主业务操作。
          </Typography.Paragraph>
        )}

        <Divider style={{ marginBlock: 0 }} />

        <div className="flex-1 overflow-y-auto">
          <div
            className="flex h-full flex-col justify-center"
            style={{ gap: sidecarWidthBand === 'compact' ? 12 : 16 }}
          >
            {visibleMessages.map((message) => {
              return (
                <div
                  key={message.id}
                  className={message.role === 'user' ? 'ml-auto' : undefined}
                  style={{ maxWidth: sidecarWidthBand === 'compact' ? '100%' : '85%' }}
                >
                  <Bubble
                    placement={message.role === 'user' ? 'end' : 'start'}
                    content={message.content}
                  />

                  {message.cards && message.cards.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {message.cards.map((card) => (
                        <div key={card.id} className="transition-shadow hover:shadow-sm">
                          <Card
                            hoverable
                            size="small"
                            onClick={() => {
                              navigate(card.to);
                            }}
                            styles={{
                              body: { padding: '8px 12px' },
                            }}
                            style={{
                              boxShadow: 'none',
                              borderColor: 'var(--ant-color-border-secondary)',
                            }}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <Typography.Text strong style={{ fontSize: 13 }}>
                                  {card.title}
                                </Typography.Text>
                                {card.description ? (
                                  <Typography.Paragraph
                                    type="secondary"
                                    style={{ margin: 0, fontSize: 12 }}
                                    ellipsis={{ rows: 1 }}
                                  >
                                    {card.description}
                                  </Typography.Paragraph>
                                ) : null}
                              </div>

                              <Button
                                aria-label={`进入${card.title}`}
                                size="small"
                                type="text"
                                style={{ padding: '0 4px', fontSize: 12 }}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  navigate(card.to);
                                }}
                              >
                                进入
                              </Button>
                            </div>
                          </Card>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
            <Typography.Text type="secondary">
              {isUnavailable
                ? '智能入口暂未连接。你仍可输入目标页面名称，先查看相关入口卡片，再进入对应页面。'
                : '你可以直接描述目标，我会帮你找到页面、整理信息或起草下一步。'}
            </Typography.Text>
          </div>
        </div>

        <div
          className="rounded-2xl border border-border bg-bg-container shadow-sm"
          style={{ padding: sidecarWidthBand === 'compact' ? 12 : 16 }}
        >
          <Sender
            ref={senderRef}
            value={draft}
            onChange={(value) => setDraft(value)}
            onSubmit={(message) => {
              submitQuery(message);
              setDraft('');
            }}
            placeholder={
              isUnavailable ? '输入你想去的页面名称' : '告诉我你想查看什么，或想完成什么'
            }
          />
        </div>
      </div>
    </Drawer>
  );
}
