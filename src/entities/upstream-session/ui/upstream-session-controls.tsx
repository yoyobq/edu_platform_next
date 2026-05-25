// src/entities/upstream-session/ui/upstream-session-controls.tsx

import { Button } from 'antd';
import type { ReactNode } from 'react';

type UpstreamSessionControlsProps = {
  disabled?: boolean;
  extra?: ReactNode;
  onClear: () => void;
  onRelogin: () => void;
};

export function UpstreamSessionControls({
  disabled = false,
  extra,
  onClear,
  onRelogin,
}: UpstreamSessionControlsProps) {
  return (
    <>
      {extra}
      <Button disabled={disabled} onClick={onClear}>
        清理 upstream token
      </Button>
      <Button disabled={disabled} onClick={onRelogin}>
        重新登录 upstream
      </Button>
    </>
  );
}
