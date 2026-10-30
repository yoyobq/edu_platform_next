// src/labs/teaching-inspection/lesson-policy.spec.ts
import { describe, expect, it } from 'vitest';

import { dueRound } from './lesson-policy';
describe('教案默认到期轮次', () => {
  it.each([
    ['2026-09-01', 1],
    ['2026-09-28', 1],
    ['2026-09-29', 1],
    ['2026-11-10', 1],
    ['2026-11-11', 2],
    ['2026-12-30', 3],
  ])('今天 %s 选择第 %s 次', (today, round) => {
    expect(dueRound(['2026-09-28', '2026-11-11', '2026-12-30'], today)).toBe(round);
  });
});
