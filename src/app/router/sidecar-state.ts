import { createContext, useContext } from 'react';

export type SidecarState = {
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
