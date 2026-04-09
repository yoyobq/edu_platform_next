// src/app/providers/nav-capability-provider.tsx

import { type ReactNode, useMemo, useState } from 'react';

import { NavCapabilityContext, type NavCapabilityState, type NavMode } from './nav-capability';

export function NavCapabilityProvider({ children }: { children: ReactNode }) {
  const [mode, setModeRaw] = useState<NavMode>('none');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const value = useMemo<NavCapabilityState>(
    () => ({
      mode,
      isDrawerOpen,
      setMode: (newMode) => {
        setModeRaw(newMode);
        if (newMode !== 'rail') {
          setIsDrawerOpen(false);
        }
      },
      openDrawer: () => {
        if (mode === 'rail') {
          setIsDrawerOpen(true);
        }
      },
      closeDrawer: () => setIsDrawerOpen(false),
      pinToFull: () => {
        setModeRaw('full');
        setIsDrawerOpen(false);
      },
    }),
    [mode, isDrawerOpen],
  );

  return <NavCapabilityContext.Provider value={value}>{children}</NavCapabilityContext.Provider>;
}
