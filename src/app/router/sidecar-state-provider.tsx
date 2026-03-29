import { type ReactNode, useMemo, useState } from 'react';

import { type SidecarState, SidecarStateContext } from './sidecar-state';

const DEFAULT_SIDECAR_WIDTH = 512;

export function SidecarStateProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [measuredWidth, setMeasuredWidth] = useState(DEFAULT_SIDECAR_WIDTH);

  const value = useMemo<SidecarState>(
    () => ({
      isOpen,
      measuredWidth,
      close: () => setIsOpen(false),
      open: () => setIsOpen(true),
      reportMeasuredWidth: (width) => {
        if (!Number.isFinite(width) || width <= 0) {
          return;
        }

        setMeasuredWidth(Math.round(width));
      },
    }),
    [isOpen, measuredWidth],
  );

  return <SidecarStateContext.Provider value={value}>{children}</SidecarStateContext.Provider>;
}
