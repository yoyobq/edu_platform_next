import { useRef } from 'react';
import { Sender } from '@ant-design/x';
import { Divider, Drawer, Typography } from 'antd';

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
  const { close, isOpen } = useSidecarState();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const sidecarZIndex = readZIndexToken('--z-index-sidecar-container', 1100);

  return (
    <Drawer
      open={isOpen}
      title={
        <div className="flex items-center gap-2">
          <span className="text-lg">✨</span>
          <span>Assistant</span>
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
          const focusTarget = panelRef.current?.querySelector<HTMLElement>('textarea, input');
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
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          The assistant is an enhancement layer. Closing it must not break the main workflow.
        </Typography.Paragraph>

        <Divider style={{ marginBlock: 0 }} />

        <div className="flex-1 overflow-y-auto">
          <div className="flex h-full items-center justify-center">
            <Typography.Text type="secondary">Conversation space...</Typography.Text>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-bg-container p-4 shadow-sm">
          <Sender placeholder="Ask or draft here" />
        </div>
      </div>
    </Drawer>
  );
}
