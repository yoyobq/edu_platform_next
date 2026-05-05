import { type ReactNode, useMemo, useState } from 'react';

import {
  WorkbenchCustomItemDragContext,
  type WorkbenchCustomItemDragPayload,
} from './workbench-custom-item-dnd-context';

export function WorkbenchCustomItemDragProvider({ children }: { children: ReactNode }) {
  const [activePayload, setActivePayload] = useState<WorkbenchCustomItemDragPayload | null>(null);
  const value = useMemo(
    () => ({
      activePayload,
      clearDrag: () => setActivePayload(null),
      startDrag: (payload: WorkbenchCustomItemDragPayload) => setActivePayload(payload),
    }),
    [activePayload],
  );

  return (
    <WorkbenchCustomItemDragContext.Provider value={value}>
      {children}
    </WorkbenchCustomItemDragContext.Provider>
  );
}
