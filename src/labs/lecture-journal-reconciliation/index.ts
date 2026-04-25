export { lectureJournalReconciliationLabAccess } from './access';

export async function loadLectureJournalReconciliationLabRouteModule() {
  const { LectureJournalReconciliationLabPage } = await import('./page');

  return {
    Component: LectureJournalReconciliationLabPage,
  };
}
