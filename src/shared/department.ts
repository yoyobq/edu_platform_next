export const WHITE_HOUSE_DEPARTMENT_NAME = '白宫';
export const WHITE_HOUSE_DEPARTMENT_OPTION_ID = '';

export function normalizeDepartmentName(value: string | null | undefined) {
  const normalized = value?.trim();

  return normalized ? normalized : WHITE_HOUSE_DEPARTMENT_NAME;
}
