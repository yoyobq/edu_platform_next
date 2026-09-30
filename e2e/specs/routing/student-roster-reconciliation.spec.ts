// e2e/specs/routing/student-roster-reconciliation.spec.ts
import { mockApiHealth, mockAuthGraphQL, seedAuthSession } from '../../helpers/app';
import { expect, test } from '../../test';

const future = '2099-01-01T00:00:00.000Z';
const student = {
  key: 'historical',
  studentId: '320010113',
  studentName: '历史学生',
  studentStatus: 'DROPPED',
  classCode: '1032001',
  className: '信息2001班',
  category: 'SUPPRESSED',
  action: 'SUPPRESSED_BY_EXCLUDE_DECISION',
  activeDecisionId: 'old-decision',
  activeDecisionOutcome: 'EXCLUDE',
  activeDecisionReasonCode: 'DROPPED_CONFIRMED',
  activeDecisionEffectiveSemesterId: null,
  currentMembershipId: null,
  currentClassCode: '1032001',
  currentClassName: '信息2001班',
  requiresConfirmation: false,
  upstreamPresence: 'MISSING',
  upstreamStudentId: null,
  upstreamClassCode: null,
  upstreamClassName: null,
  isEnrolled: null,
  isInSchool: null,
  recommendedDecisionOutcome: null,
  recommendedReasonCode: null,
  rowIndex: null,
  reason: null,
  inferredAdmissionYear: null,
  inferredOriginalClassCode: null,
  inferredOriginalClassSeq: null,
  inferredTargetClassSeq: null,
  statusChangeEvidence: {
    studentId: '320010113',
    state: 'NOT_FETCHED',
    sourceStatus: null,
    observedAt: null,
    sourceTotal: null,
    complete: false,
    events: [],
  },
};

for (const scenario of ['evidence', 'manual'] as const) {
  test(
    scenario === 'evidence'
      ? '采纳校园网建议后，应预览影响、保留草稿并使用续期会话提交'
      : '校园网无记录时，应能撤销修改并将转入裁定纠正为退学',
    async ({ page }, testInfo) => {
      await page.clock.setFixedTime(new Date('2026-09-23T02:00:00Z'));
      const schoolYear = scenario === 'evidence' ? 2024 : 2021;
      await mockApiHealth(page);
      await mockAuthGraphQL(page, {
        currentSession: { accountId: 1, primaryAccessGroup: 'ADMIN' },
      });
      await seedAuthSession(page, { accountId: 1, primaryAccessGroup: 'ADMIN' });
      await page.addInitScript(
        ({ future }) =>
          localStorage.setItem(
            'aigc-friendly-frontend.upstream.session.v2',
            JSON.stringify({
              accountId: 1,
              version: 2,
              upstreamLoginId: 'admin',
              upstreamSessionToken: '{"token":"old"}',
              expiresAt: future,
            }),
          ),
        { future },
      );
      let committed: Record<string, unknown> | null = null;
      const eventEvidence = {
        ...student.statusChangeEvidence,
        state: 'HAS_EVENTS',
        sourceStatus: 'OBSERVED',
        observedAt: '2026-09-23T01:00:00Z',
        sourceTotal: 1,
        complete: true,
        events: [
          {
            logId: 'log',
            typeCode: '10',
            changeTime: '2024-09-27 14:51:22.000',
            classCode: '1032001',
            className: '信息2001班',
            grade: '2020',
          },
        ],
      };
      const evidence =
        scenario === 'evidence'
          ? eventEvidence
          : {
              ...student.statusChangeEvidence,
              state: 'FETCHED_EMPTY',
              sourceStatus: 'MISSING',
              sourceTotal: 0,
              complete: true,
              events: [],
            };
      const result = () => ({
        classCode: '1032001',
        className: '信息2001班',
        dryRun: true,
        committed: false,
        requiresReconfirm: false,
        traceId: 'test',
        expiresAt: future,
        upstreamSessionToken: committed ? '{"token":"renewed"}' : '{"token":"old"}',
        autoAppliedCount: 0,
        confirmationRequiredCount: 0,
        createdDecisionCount: 0,
        createdMembershipCount: 0,
        differenceCount: 0,
        endedDecisionCount: 0,
        endedMembershipCount: 0,
        fetchedCount: 0,
        sessionStrategy: 'REUSED',
        suppressedCount: 1,
        touchedMembershipCount: 0,
        unprocessableCount: 0,
        items: [
          {
            ...student,
            ...(scenario === 'manual'
              ? {
                  action: 'SUPPRESSED_BY_INCLUDE_DECISION',
                  activeDecisionOutcome: 'INCLUDE',
                  activeDecisionReasonCode: 'TRANSFERRED_IN_CONFIRMED',
                  activeDecisionEffectiveSemesterId: 1,
                  statusChangeEvidence: evidence,
                }
              : {}),
            ...(committed
              ? {
                  activeDecisionEffectiveSemesterId: 1,
                  statusChangeEvidence: evidence,
                  activeDecisionOutcome: 'EXCLUDE',
                  activeDecisionReasonCode: 'DROPPED_CONFIRMED',
                  action: 'SUPPRESSED_BY_EXCLUDE_DECISION',
                }
              : {}),
          },
        ],
      });
      await page.route('**/graphql', async (route) => {
        const body = route.request().postDataJSON() as {
          query?: string;
          variables?: { input?: Record<string, unknown> };
        };
        const query = body.query ?? '';
        let data: Record<string, unknown>;
        if (query.includes('studentPrivateProfileClassOptions'))
          data = {
            studentPrivateProfileClassOptions: [
              { id: '1032001', classCode: '1032001', className: '信息2001班' },
            ],
          };
        else if (query.includes('StudentRosterMembershipCurrentAccount'))
          data = { me: { accountId: 1, account: { identityHint: 'admin' } } };
        else if (query.includes('StudentRosterMembershipDepartments'))
          data = {
            departments: [
              { id: 'dept', departmentName: '信息系', shortName: null, isEnabled: true },
            ],
          };
        else if (query.includes('StudentRosterMembershipLocalClassOptions'))
          data = {
            listLocalClassOptions: [
              {
                id: '1032001',
                classCode: '1032001',
                className: '信息2001班',
                departmentId: 'dept',
                gradeYear: 2020,
              },
            ],
          };
        else if (query.includes('StudentRosterMembershipAcademicSemesters'))
          data = {
            academicSemesters: [
              {
                id: 1,
                schoolYear,
                termNumber: 1,
                name: `${schoolYear}—${schoolYear + 1} 第一学期`,
                startDate: '2024-09-01',
                endDate: '2025-01-20',
                examStartDate: '2025-01-01',
                firstTeachingDate: '2024-09-02',
                isCurrent: false,
                isVisible: true,
                sortOrder: 1,
                createdAt: future,
                updatedAt: future,
              },
            ],
          };
        else if (query.includes('mutation DryRunReconcileUpstreamStudentRoster'))
          data = { dryRunReconcileUpstreamStudentRoster: result() };
        else if (query.includes('mutation RefreshRosterStatusChange'))
          data = {
            refreshStudentRosterStatusChange: {
              evidence,
              upstreamSessionToken: '{"token":"renewed"}',
              expiresAt: future,
            },
          };
        else if (query.includes('mutation CommitUpstreamStudentRosterReconciliation')) {
          committed = body.variables?.input ?? null;
          data = {
            commitUpstreamStudentRosterReconciliation: {
              ...result(),
              committed: true,
              dryRun: false,
              createdDecisionCount: 1,
              endedDecisionCount: 1,
            },
          };
        } else {
          await route.fallback();
          return;
        }
        await route.fulfill({ json: { data } });
      });
      await page.goto('/academic-affairs/student-roster-membership-reconciliation');
      await page.getByRole('main').getByRole('combobox', { name: '核对班级', exact: true }).click();
      await page.getByText('信息2001班 (1032001)', { exact: true }).last().click();
      await page.getByRole('button', { name: '预读校园网学生花名册并核对' }).click();
      if (scenario === 'evidence') await expect(page.getByText('需补齐时间')).toBeVisible();
      await page.getByRole('tab', { name: '全部 1', exact: true }).click();
      await page.getByPlaceholder('按姓名或学号查找').fill('320010113');
      await page.getByRole('button', { name: '查看证据与处理' }).click();
      const drawer = page.getByRole('dialog', { name: '历史学生 · 320010113', exact: true });
      await expect(drawer.getByText('查看核对明细', { exact: true })).toHaveCount(0);
      await expect(
        drawer.getByText(/upstreamStudentId|IS_ENROLLED|active decision|membership/),
      ).toHaveCount(0);
      await expect(drawer.getByRole('region', { name: '修改裁定' })).toHaveCount(0);

      await drawer.getByRole('button', { name: '刷新学籍变动' }).click();
      const impact = `从 ${schoolYear}—${schoolYear + 1} 学年第 1 学期起（含该学期），不再纳入本班名单。`;
      if (scenario === 'evidence') {
        await expect(drawer.getByText('2024-09-27 14:51:22.000', { exact: true })).toBeVisible();
        await expect(drawer.getByText(impact, { exact: true })).toBeVisible();
        await drawer.getByRole('button', { name: '采用建议' }).click();
      } else {
        await expect(drawer.getByText('学籍变动：未查到记录')).toBeVisible();
        await expect(drawer.getByRole('button', { name: '采用建议' })).toHaveCount(0);
        await drawer.getByRole('button', { name: '修改裁定' }).click();
        await drawer.getByRole('combobox', { name: '实际情况' }).click();
        await page.getByText('确认报到后退学', { exact: true }).last().click();
        await expect(drawer.getByRole('button', { name: '检查并提交变更' })).toBeDisabled();
        await drawer.getByRole('button', { name: '撤销修改' }).click();
        await expect(drawer.getByRole('combobox', { name: '实际情况' })).toHaveCount(0);
        await expect(
          drawer.getByRole('region', { name: '当前结果' }).getByText('已转入本班', { exact: true }),
        ).toBeVisible();
        await drawer.getByRole('button', { name: '修改裁定' }).click();
        await drawer.getByRole('combobox', { name: '实际情况' }).click();
        await page.getByText('确认报到后退学', { exact: true }).last().click();
        await drawer.getByRole('combobox').nth(1).click();
        await page
          .getByText(`${schoolYear}—${schoolYear + 1} 第一学期`, { exact: true })
          .last()
          .click();
        await expect(drawer.getByText(impact, { exact: true })).toBeVisible();
      }
      expect(committed).toBeNull();
      await expect(page.getByRole('tab', { name: '全部 1', exact: true })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await drawer.getByRole('button', { name: '返回名单', exact: true }).click();
      await expect(page.getByText('有待提交修改', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: '查看证据与处理' }).click();
      await expect(drawer.getByRole('combobox', { name: '实际情况' })).toBeVisible();
      await drawer.screenshot({ path: testInfo.outputPath('decision-draft.png') });
      await drawer.getByRole('button', { name: '检查并提交变更', exact: true }).click();
      const review = page.getByRole('dialog', { name: '确认本班待提交变更' });
      await expect(review.getByText(impact, { exact: true })).toBeVisible();
      await expect(review.getByText('提交后：确认报到后退学', { exact: true })).toBeVisible();
      await expect(review.getByText(/本次提交包含全班待处理项/)).toBeVisible();
      expect(committed).toBeNull();
      await review.getByRole('button', { name: '继续核对' }).click();
      await drawer.getByRole('button', { name: '检查并提交变更', exact: true }).click();
      await review.screenshot({ path: testInfo.outputPath('decision-review.png') });
      await review.getByRole('button', { name: '确认提交' }).click();
      await expect
        .poll(() => committed)
        .toMatchObject({
          upstreamSessionToken: '{"token":"renewed"}',
          endDecisions: [{ decisionId: 'old-decision' }],
          confirmations: [
            { studentId: '320010113', reasonCode: 'DROPPED_CONFIRMED', effectiveSemesterId: 1 },
          ],
        });
      await expect(
        drawer.getByRole('region', { name: '当前结果' }).getByText(impact, { exact: true }),
      ).toBeVisible();
      await expect(
        drawer.getByRole('region', { name: '当前结果' }).getByText('已退学', { exact: true }),
      ).toBeVisible();
      await expect(drawer.getByRole('combobox', { name: '实际情况' })).toHaveCount(0);
      if (scenario === 'evidence') {
        await expect(drawer.getByText('与当前裁定一致')).toBeVisible();
        await expect(drawer.getByRole('button', { name: '采用建议' })).toHaveCount(0);
      }
    },
  );
}
