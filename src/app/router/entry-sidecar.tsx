import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { Bubble, Sender } from '@ant-design/x';
import type { SenderRef } from '@ant-design/x/es/sender';
import { Alert, Button, Card, Divider, Drawer, Typography } from 'antd';
import { useNavigate } from 'react-router';

import {
  type CollaborationAvailability,
  type SessionMessage,
  useCollaborationSession,
} from './collaboration-session';
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

function getDefaultMessages(
  availability: ReturnType<typeof getAvailabilityViewState>,
): SessionMessage[] {
  if (availability.isReadonly) {
    return [
      {
        id: 'system-readonly',
        role: 'system' as const,
        content: '当前入口已切换为只读模式。你可以先查看已有内容，新的输入会在恢复后开放。',
      },
    ];
  }

  return [
    {
      id: 'system-welcome',
      role: 'system' as const,
      content: '请问你要做什么？',
    },
  ];
}

function getAvailabilityViewState(availability: CollaborationAvailability) {
  return {
    isAvailable: availability === 'available',
    isDegraded: availability === 'degraded',
    isReadonly: availability === 'readonly',
    isUnavailable: availability === 'unavailable',
  };
}

export function EntrySidecar() {
  const { close, isOpen, reportMeasuredWidth } = useSidecarState();
  const { session, submitQuery } = useCollaborationSession();
  const navigate = useNavigate();
  const [draft, setDraft] = useState('');
  const panelRef = useRef<HTMLDivElement | null>(null);
  const senderRef = useRef<SenderRef | null>(null);
  const sidecarZIndex = readZIndexToken('--z-index-sidecar-container', 1100);
  const availabilityView = getAvailabilityViewState(session.availability);
  const { band: sidecarWidthBand, width: sidecarWidth } = useWidthBand(
    panelRef,
    [{ max: 440, value: 'compact' }],
    'comfortable',
  );
  const visibleMessages =
    session.messages.length > 0 ? session.messages : getDefaultMessages(availabilityView);

  const closeSidecar = useCallback(() => {
    close();
  }, [close]);

  useEffect(() => {
    reportMeasuredWidth(sidecarWidth);
  }, [reportMeasuredWidth, sidecarWidth]);

  useEffect(() => {
    const drawerWrapper = panelRef.current?.closest('.ant-drawer-content-wrapper');

    if (!drawerWrapper) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (!entry) {
        return;
      }

      reportMeasuredWidth(entry.contentRect.width);
    });

    observer.observe(drawerWrapper);

    return () => {
      observer.disconnect();
    };
  }, [isOpen, reportMeasuredWidth]);

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
      mask={false}
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
        wrapper: { pointerEvents: 'none', width: 'clamp(360px, 36vw, 560px)', maxWidth: '100vw' },
        section: { pointerEvents: 'auto' },
        body: { paddingTop: 16, display: 'flex', flexDirection: 'column' },
      }}
    >
      <div
        ref={panelRef}
        className="flex h-full w-full flex-col space-y-4"
        data-sidecar-width-band={sidecarWidthBand}
        style={{ '--layout-sidecar-width': `${Math.round(sidecarWidth)}px` } as CSSProperties}
      >
        {availabilityView.isUnavailable ? (
          <Alert type="info" showIcon title="增强入口暂未连接，你仍可正常使用项目功能。" />
        ) : availabilityView.isDegraded ? (
          <Alert
            type="warning"
            showIcon
            title="增强入口当前已降级，复杂协作会优先回退到本地入口。"
          />
        ) : availabilityView.isReadonly ? (
          <Alert type="info" showIcon title="当前入口为只读模式，你仍可查看已有内容。" />
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
              {availabilityView.isReadonly
                ? '当前入口暂不接收新输入。你仍可浏览已有记录，待入口恢复后再继续。'
                : availabilityView.isUnavailable
                  ? '增强入口暂未连接。你仍可输入目标页面名称，先查看相关入口卡片，再进入对应页面。'
                  : availabilityView.isDegraded
                    ? '增强入口当前不稳定。你仍可输入目标页面名称或操作意图，我会优先给出本地入口。'
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
            disabled={availabilityView.isReadonly}
            onSubmit={(message) => {
              submitQuery(message);
              setDraft('');
            }}
            placeholder={
              availabilityView.isReadonly
                ? '当前为只读模式'
                : availabilityView.isUnavailable
                  ? '输入你想去的页面名称'
                  : availabilityView.isDegraded
                    ? '输入目标页面名称或操作意图'
                    : '告诉我你想查看什么，或想完成什么'
            }
          />
        </div>
      </div>
    </Drawer>
  );
}
