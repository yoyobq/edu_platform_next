const INTEGRATED_COURSE_CATEGORY = '3';
const PRACTICE_COURSE_CATEGORY = '2';

export function isIntegratedCourseCategory(courseCategory: string | null) {
  return courseCategory === INTEGRATED_COURSE_CATEGORY;
}

export function isPracticeCourseCategory(courseCategory: string | null) {
  return courseCategory === PRACTICE_COURSE_CATEGORY;
}
