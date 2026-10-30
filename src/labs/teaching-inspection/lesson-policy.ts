// src/labs/teaching-inspection/lesson-policy.ts
export function dueRound(dates: readonly string[], today: string): number {
  let selected = 1;
  dates.forEach((date, index) => {
    if (date <= today) selected = index + 1;
  });
  return selected;
}
