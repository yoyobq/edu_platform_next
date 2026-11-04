// src/features/teaching-inspection/application/execution-state.spec.ts
import { describe, expect, it } from 'vitest';

import { executionReducer, initialExecutionState } from './execution-state';
describe('教学检查执行状态', () => {
  it('发送阶段原子进入忙碌状态，结束时清除当前活动', () => {
    const active = executionReducer(initialExecutionState, {
      type: 'activity',
      value: { kind: 'prepare', dispatched: true },
    });
    expect(active.busy).toBe(true);
    expect(active.activity).toEqual({ kind: 'prepare', dispatched: true });
    expect(executionReducer(active, { type: 'busy', value: false })).toMatchObject({
      busy: false,
      activity: null,
    });
  });
  it('部分失败保留计数，结束后仍可查看本次结果', () => {
    const state = executionReducer(initialExecutionState, {
      type: 'progress',
      value: { done: 31, total: 31, label: '本次处理结束', success: 29, failed: 1, unknown: 1 },
    });
    expect(executionReducer(state, { type: 'activity', value: null }).progress).toEqual(
      state.progress,
    );
    expect(initialExecutionState.progress.done).toBe(0);
  });
});
