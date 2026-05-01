export function formatLocalBusinessDate(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function isFutureTeachingDate(
  teachingDate: string | null | undefined,
  today = formatLocalBusinessDate(),
) {
  return Boolean(teachingDate && /^\d{4}-\d{2}-\d{2}$/.test(teachingDate) && teachingDate > today);
}
