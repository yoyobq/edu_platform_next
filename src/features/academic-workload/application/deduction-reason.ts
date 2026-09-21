// src/features/academic-workload/application/deduction-reason.ts

const DEDUCTION_REASON_LABELS: Record<string, string> = {
  ACTIVITY: '活动',
  EXAM: '考试',
  HOLIDAY: '节假日',
  MILITARY_TRAINING: '军训',
  SPORTS_MEET: '运动会',
  WEEKDAY_SWAP: '调休',
};

export function formatDeductionReason(value: string | null | undefined) {
  const normalizedValue = value?.trim().toUpperCase() || null;

  if (!normalizedValue) {
    return '未标注原因';
  }

  return DEDUCTION_REASON_LABELS[normalizedValue] ?? normalizedValue;
}
