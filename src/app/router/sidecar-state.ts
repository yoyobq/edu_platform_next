import { createContext, useContext } from 'react';

export type AiAvailability = 'available' | 'degraded' | 'readonly' | 'unavailable';

export type SidecarState = {
  availability: AiAvailability;
  isOpen: boolean;
  close: () => void;
  open: () => void;
};

export const SidecarStateContext = createContext<SidecarState | null>(null);

export function useSidecarState() {
  const contextValue = useContext(SidecarStateContext);

  if (!contextValue) {
    throw new Error('useSidecarState must be used within SidecarStateProvider.');
  }

  return contextValue;
}
