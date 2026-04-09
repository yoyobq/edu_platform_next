// src/app/providers/nav-capability-provider.tsx

import { type ReactNode, useEffect, useMemo, useState } from 'react';

import { NavCapabilityContext, type NavCapabilityState, type NavMode } from './nav-capability';

const NAV_PINNED_FULL_STORAGE_KEY = 'app.nav.prefersPinnedFull';

export function NavCapabilityProvider({ children }: { children: ReactNode }) {
  const [mode, setModeRaw] = useState<NavMode>('none');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [manualFullOverride, setManualFullOverride] = useState(false);
  const [prefersPinnedFull, setPrefersPinnedFull] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.localStorage.getItem(NAV_PINNED_FULL_STORAGE_KEY) === '1';
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(NAV_PINNED_FULL_STORAGE_KEY, prefersPinnedFull ? '1' : '0');
  }, [prefersPinnedFull]);

  const value = useMemo<NavCapabilityState>(
    () => ({
      mode,
      prefersPinnedFull,
      manualFullOverride,
      isDrawerOpen,
      setMode: (newMode) => {
        setModeRaw(newMode);
        if (newMode === 'full') {
          setPrefersPinnedFull(true);
          setManualFullOverride(false);
        } else if (newMode === 'rail') {
          setPrefersPinnedFull(false);
          setManualFullOverride(false);
        } else {
          setManualFullOverride(false);
        }
        if (newMode !== 'rail') {
          setIsDrawerOpen(false);
        }
      },
      autoFoldToRail: () => {
        setModeRaw('rail');
        setManualFullOverride(false);
        setIsDrawerOpen(false);
      },
      clearManualFullOverride: () => setManualFullOverride(false),
      openDrawer: () => {
        if (mode === 'rail') {
          setIsDrawerOpen(true);
        }
      },
      closeDrawer: () => setIsDrawerOpen(false),
      pinToFull: () => {
        setModeRaw('full');
        setPrefersPinnedFull(true);
        setManualFullOverride(true);
        setIsDrawerOpen(false);
      },
    }),
    [isDrawerOpen, manualFullOverride, mode, prefersPinnedFull],
  );

  return <NavCapabilityContext.Provider value={value}>{children}</NavCapabilityContext.Provider>;
}
