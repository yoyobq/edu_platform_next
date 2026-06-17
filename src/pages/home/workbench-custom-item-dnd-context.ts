import { createContext, useContext } from 'react';

import type { WorkbenchLocalCustomItem } from '@/features/workbench-home';

export type WorkbenchCustomItemDragSource = 'timetable' | 'todo';

export type WorkbenchCustomItemDragPayload = {
  item: WorkbenchLocalCustomItem;
  removeSource: () => void;
  source: WorkbenchCustomItemDragSource;
  sourceCell?: {
    dayOfWeek: number;
    rowKey: string;
  };
};

type WorkbenchCustomItemDragContextValue = {
  activePayload: WorkbenchCustomItemDragPayload | null;
  clearDrag: () => void;
  startDrag: (payload: WorkbenchCustomItemDragPayload) => void;
};

export const WorkbenchCustomItemDragContext =
  createContext<WorkbenchCustomItemDragContextValue | null>(null);

export function useWorkbenchCustomItemDrag() {
  const context = useContext(WorkbenchCustomItemDragContext);

  if (!context) {
    throw new Error(
      'useWorkbenchCustomItemDrag must be used within WorkbenchCustomItemDragProvider',
    );
  }

  return context;
}
