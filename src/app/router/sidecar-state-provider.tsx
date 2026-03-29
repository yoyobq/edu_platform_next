import { type ReactNode, useMemo, useState } from 'react';

import { type SidecarState, SidecarStateContext } from './sidecar-state';

const MOCK_AI_AVAILABILITY = 'unavailable' as const;

export function SidecarStateProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const value = useMemo<SidecarState>(
    () => ({
      availability: MOCK_AI_AVAILABILITY,
      isOpen,
      close: () => setIsOpen(false),
      open: () => setIsOpen(true),
    }),
    [isOpen],
  );

  return <SidecarStateContext.Provider value={value}>{children}</SidecarStateContext.Provider>;
}
