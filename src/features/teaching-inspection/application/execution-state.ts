// src/features/teaching-inspection/application/execution-state.ts
import type { Activity, ExecutionProgress } from './workbench.types';
export const initialExecutionState: {
  busy: boolean;
  activity: Activity;
  progress: ExecutionProgress;
} = {
  busy: false,
  activity: null,
  progress: { done: 0, total: 0, label: '', success: 0, failed: 0, unknown: 0 },
};
type Event =
  | { type: 'busy'; value: boolean }
  | { type: 'activity'; value: Activity }
  | {
      type: 'progress';
      value: ExecutionProgress | ((old: ExecutionProgress) => ExecutionProgress);
    };
export function executionReducer(
  state: typeof initialExecutionState,
  event: Event,
): typeof initialExecutionState {
  switch (event.type) {
    case 'busy':
      return { ...state, busy: event.value, activity: event.value ? state.activity : null };
    case 'activity':
      return { ...state, activity: event.value, busy: event.value !== null };
    case 'progress':
      return {
        ...state,
        progress: typeof event.value === 'function' ? event.value(state.progress) : event.value,
      };
  }
}
