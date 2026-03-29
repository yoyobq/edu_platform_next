import { createContext, useContext } from 'react';

export type SidecarState = {
  isOpen: boolean;
  measuredWidth: number;
  close: () => void;
  open: () => void;
  reportMeasuredWidth: (width: number) => void;
};

export const SidecarStateContext = createContext<SidecarState | null>(null);

export function useSidecarState() {
  const contextValue = useContext(SidecarStateContext);

  if (!contextValue) {
    throw new Error('useSidecarState must be used within SidecarStateProvider.');
  }

  return contextValue;
}
