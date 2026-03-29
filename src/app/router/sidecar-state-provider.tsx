import { type ReactNode, useMemo, useState } from 'react';

import { type SidecarState, SidecarStateContext } from './sidecar-state';

export function SidecarStateProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const value = useMemo<SidecarState>(
    () => ({
      isOpen,
      close: () => setIsOpen(false),
      open: () => setIsOpen(true),
    }),
    [isOpen],
  );

  return <SidecarStateContext.Provider value={value}>{children}</SidecarStateContext.Provider>;
}
