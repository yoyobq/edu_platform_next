// src/app/providers/nav-capability-provider.tsx

import { type ReactNode, useMemo, useState } from 'react';

import { NavCapabilityContext, type NavCapabilityState, type NavMode } from './nav-capability';

const NAV_PINNED_FULL_STORAGE_KEY = 'app.nav.prefersPinnedFull';

function readPinnedFullPreference() {
  if (typeof window === 'undefined') {
    return {
      hasPinnedFullPreference: false,
      prefersPinnedFull: false,
    };
  }

  const value = window.localStorage.getItem(NAV_PINNED_FULL_STORAGE_KEY);

  return {
    hasPinnedFullPreference: value === '0' || value === '1',
    prefersPinnedFull: value === '1',
  };
}

function persistPinnedFullPreference(value: boolean) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(NAV_PINNED_FULL_STORAGE_KEY, value ? '1' : '0');
}

export function NavCapabilityProvider({ children }: { children: ReactNode }) {
  const [mode, setModeRaw] = useState<NavMode>('none');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [manualFullOverride, setManualFullOverride] = useState(false);
  const [pinnedFullPreference, setPinnedFullPreference] = useState(readPinnedFullPreference);

  const value = useMemo<NavCapabilityState>(
    () => ({
      mode,
      prefersPinnedFull: pinnedFullPreference.prefersPinnedFull,
      hasPinnedFullPreference: pinnedFullPreference.hasPinnedFullPreference,
      manualFullOverride,
      isDrawerOpen,
      setMode: (newMode, options) => {
        setModeRaw(newMode);
        if (newMode === 'full') {
          if (!options?.preservePinnedPreference) {
            setPinnedFullPreference({
              hasPinnedFullPreference: true,
              prefersPinnedFull: true,
            });
            persistPinnedFullPreference(true);
          }
          setManualFullOverride(false);
        } else if (newMode === 'rail') {
          if (!options?.preservePinnedPreference) {
            setPinnedFullPreference({
              hasPinnedFullPreference: true,
              prefersPinnedFull: false,
            });
            persistPinnedFullPreference(false);
          }
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
        setPinnedFullPreference({
          hasPinnedFullPreference: true,
          prefersPinnedFull: true,
        });
        persistPinnedFullPreference(true);
        setManualFullOverride(true);
        setIsDrawerOpen(false);
      },
    }),
    [isDrawerOpen, manualFullOverride, mode, pinnedFullPreference],
  );

  return <NavCapabilityContext.Provider value={value}>{children}</NavCapabilityContext.Provider>;
}
