// src/entities/academic-semester/application/academic-term.ts

export type AcademicTermLike = {
  label?: string | null;
  schoolYear: number | string;
  semester: number | string;
};

function compareTextValue(a: string | null | undefined, b: string | null | undefined) {
  return (a ?? '').localeCompare(b ?? '', 'zh-CN', {
    numeric: true,
    sensitivity: 'base',
  });
}

export function parsePositiveIntegerText(value: number | string | null | undefined) {
  const normalizedValue = String(value ?? '').trim();

  if (!/^\d+$/.test(normalizedValue)) {
    return null;
  }

  const parsedValue = Number(normalizedValue);

  return Number.isSafeInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

export function buildAcademicTermKey(term: Pick<AcademicTermLike, 'schoolYear' | 'semester'>) {
  return `${term.schoolYear}::${term.semester}`;
}

export function formatAcademicSchoolYear(value: number | string) {
  const text = String(value);

  if (/^\d{4}$/.test(text)) {
    const startYear = Number(text);
    const endYearSuffix = String((startYear + 1) % 100).padStart(2, '0');

    return `${text.slice(-2)}-${endYearSuffix}学年`;
  }

  return `${text} 学年`;
}

export function formatAcademicSemester(value: number | string) {
  const text = String(value);

  if (text === '1') {
    return '第一学期';
  }

  if (text === '2') {
    return '第二学期';
  }

  return `第 ${text} 学期`;
}

export function formatAcademicTermLabel(term: AcademicTermLike) {
  return (
    term.label ||
    `${formatAcademicSchoolYear(term.schoolYear)} ${formatAcademicSemester(term.semester)}`
  );
}

export function resolveAcademicTermTimelineOrder(
  term: Pick<AcademicTermLike, 'schoolYear' | 'semester'>,
) {
  const schoolYear = parsePositiveIntegerText(term.schoolYear);
  const semester = parsePositiveIntegerText(term.semester);

  if (schoolYear === null || semester === null) {
    return null;
  }

  return schoolYear * 10 + semester;
}

export function sortAcademicTermsByTimelineDesc<TTerm extends AcademicTermLike>(
  terms: readonly TTerm[],
) {
  return [...terms].sort((first, second) => {
    const firstOrder = resolveAcademicTermTimelineOrder(first);
    const secondOrder = resolveAcademicTermTimelineOrder(second);

    if (firstOrder !== null && secondOrder !== null && firstOrder !== secondOrder) {
      return secondOrder - firstOrder;
    }

    return compareTextValue(formatAcademicTermLabel(second), formatAcademicTermLabel(first));
  });
}

export function buildAcademicTermOrdinalByKey<TTerm extends AcademicTermLike>(
  terms: readonly TTerm[],
) {
  const orderedTerms = [...terms].sort((first, second) => {
    const firstOrder = resolveAcademicTermTimelineOrder(first);
    const secondOrder = resolveAcademicTermTimelineOrder(second);

    if (firstOrder !== null && secondOrder !== null && firstOrder !== secondOrder) {
      return firstOrder - secondOrder;
    }

    return compareTextValue(formatAcademicTermLabel(first), formatAcademicTermLabel(second));
  });

  return new Map<string, number>(
    orderedTerms.map((term, index) => [buildAcademicTermKey(term), index + 1]),
  );
}
