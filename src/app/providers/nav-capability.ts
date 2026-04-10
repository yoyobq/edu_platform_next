// src/app/providers/nav-capability.ts

import { createContext, useContext } from 'react';

/**
 * Nav sidebar capability modes.
 * - none: no left sidebar, keeps current light navigation
 * - rail: 64px icon column; click/focus triggers drawer flyout
 * - full: full-width sidebar, entered after user explicitly pins
 *
 * drawer/flyout is a transient UI state within rail, not an independent mode.
 */
export type NavMode = 'none' | 'rail' | 'full';

/** Width constants referenced by layout and documentation. */
export const NAV_RAIL_WIDTH = 64;
export const NAV_FULL_WIDTH = 240;

/**
 * When main content measured width drops below this value while nav is in full mode,
 * layout auto-folds full → rail to protect minimum usable main area.
 */
export const NAV_MAIN_MIN_WIDTH_WITH_FULL = 480;

/**
 * Restoring rail → full uses a higher threshold than folding full → rail.
 * This hysteresis prevents oscillation when the layout width sits near the boundary.
 */
export const NAV_MAIN_MIN_WIDTH_TO_RESTORE_FULL = 680;

export type NavCapabilityState = {
  mode: NavMode;
  prefersPinnedFull: boolean;
  manualFullOverride: boolean;
  /** Drawer flyout is temporarily expanded within rail mode. */
  isDrawerOpen: boolean;
  setMode: (mode: NavMode, options?: { preservePinnedPreference?: boolean }) => void;
  autoFoldToRail: () => void;
  clearManualFullOverride: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  /** Promote from drawer flyout to pinned full sidebar. */
  pinToFull: () => void;
};

export const NavCapabilityContext = createContext<NavCapabilityState | null>(null);

export function useNavCapability() {
  const ctx = useContext(NavCapabilityContext);

  if (!ctx) {
    throw new Error('useNavCapability must be used within NavCapabilityProvider.');
  }

  return ctx;
}
