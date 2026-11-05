// e2e/specs/routing/student-profile-filing-family.spec.ts
import { mockApiHealth, mockAuthGraphQL, seedAuthSession } from '../../helpers/app';
import { expect, test } from '../../test';

test('补充家庭电话可选择与另一位家长一致，手动电话优先，单位留空提交字符串 null', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-11-04T04:00:00Z'));
  await mockApiHealth(page);
  await mockAuthGraphQL(page, { currentSession: { accountId: 1, primaryAccessGroup: 'ADMIN' } });
  await seedAuthSession(page, { accountId: 1, primaryAccessGroup: 'ADMIN' });
  await page.addInitScript(() => {
    localStorage.setItem(
      'aigc-friendly-frontend.upstream.session.v2',
      JSON.stringify({
        accountId: 1,
        version: 2,
        upstreamLoginId: 'teacher',
        upstreamSessionToken: 'family-test-session',
        expiresAt: '2027-01-01T00:00:00Z',
      }),
    );
  });
  const flags = {
    personalObserved: true,
    sensitiveIdentifiersObserved: true,
    photoObserved: true,
    familyObserved: false,
    educationObserved: true,
    recordObserved: true,
  };
  const classOption = {
    id: 'A',
    classCode: '2401',
    className: '家庭补录测试班',
    departmentId: 'D',
    majorId: 'M',
    majorName: '护理',
    gradeYear: 2024,
    trainingYears: 3,
    studentCount: 1,
    resolvedAuthorityCode: 'ADMIN',
    authorizationPath: 'ADMIN_BYPASS',
    classAdvisers: [],
    classEnrollmentYear: 2024,
    classExpectedGraduationYear: 2027,
    classInSchool: true,
    classSchoolYearRangeLabel: '2024-2027',
  };
  const student = {
    studentId: 'S1',
    studentName: '家庭补录学生',
    studentStatus: 'ENROLLED',
    currentClassId: 'A',
    currentClassCode: '2401',
    activeMembershipClassCode: '2401',
    activeMembershipClassName: '家庭补录测试班',
    rosterScopeSource: 'ACTIVE_MEMBERSHIP',
    attentionLevel: 'ATTENTION',
    snapshotPresent: true,
    upstreamIdPresent: true,
    profileCompletenessFlags: flags,
    sectionStatuses: [],
    warningCodes: [],
    manualOverrideActive: false,
    upstreamChangedSinceManualPatch: false,
    droppedDecisionReasonCode: null,
    droppedEffectiveSemesterId: null,
    droppedEffectiveSemesterLabel: null,
    lastManualUpdatedAt: null,
    lastSyncedAt: null,
    membershipLastObservedAt: null,
    sourceObservedAt: null,
  };
  const summary = {
    studentId: 'S1',
    profileCompletenessFlags: flags,
    sectionStatuses: [
      { section: 'family', sectionBaselineToken: 'family-baseline', sourceStatus: 'OBSERVED' },
    ],
    familyMembers: ['1', '2'].map((relationshipCode) => ({
      itemKey: `parent-${relationshipCode}`,
      relationshipCode,
      maskedName: relationshipCode === '1' ? '父*' : '母*',
      maskedPhone: '138****1234',
      maskedWorkplace: null,
      manualOverrideActive: false,
      manualPatchFieldKeys: [],
      sourceObservedAt: '2026-11-04T00:00:00Z',
      sourceUpdatedAt: null,
      upstreamBaselineToken: `parent-baseline-${relationshipCode}`,
      upstreamChangedSinceManualPatch: false,
    })),
    educationResumes: [],
  };
  type Member = {
    name: string;
    relationshipCode: string;
    phone?: string;
    phoneSourceItemKey?: string;
    workplace: string;
  };
  const writes: Array<{ members: Member[] }> = [];
  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as {
      query?: string;
      variables?: { input: { members: Member[] } };
    };
    const query = payload.query ?? '';
    let field = '';
    let result: unknown;
    if (query.includes('studentPrivateProfileClassOptions')) {
      field = 'studentPrivateProfileClassOptions';
      result = [classOption];
    } else if (query.includes('studentPrivateProfileClassOverview')) {
      field = 'studentPrivateProfileClassOverview';
      result = {
        classId: 'A',
        classCode: '2401',
        className: classOption.className,
        studentCount: 1,
        students: [student],
      };
    } else if (query.includes('writeStudentPrivateProfileFamilyToUpstream')) {
      if (!payload.variables?.input) throw new Error('Missing family write input');
      writes.push(payload.variables.input);
      field = 'writeStudentPrivateProfileFamilyToUpstream';
      result = {
        success: true,
        studentId: 'S1',
        sectionKey: 'FAMILY',
        action: 'CREATE',
        upstreamSaved: true,
        localSnapshotRefreshed: true,
        snapshotUpdated: true,
        changedSections: ['family'],
        warningCodes: [],
        upstreamSessionToken: 'family-test-session',
        expiresAt: '2027-01-01T00:00:00Z',
        traceId: 'family-test',
        summaryRefreshFailed: false,
        summary,
      };
    } else if (query.includes('studentPrivateProfileSummary')) {
      field = 'studentPrivateProfileSummary';
      result = summary;
    }
    if (!field) {
      await route.fallback();
      return;
    }
    await route.fulfill({ json: { data: { [field]: result } } });
  });

  await page.goto('/class-affairs/student-profile-filing?classId=A&studentId=S1');
  await page.getByRole('button', { name: /补充家庭\/教育简历$/ }).click();
  const drawer = page.getByRole('dialog');
  await expect(drawer.getByLabel('工作单位', { exact: true })).toHaveValue('null');
  await expect(drawer.getByRole('button', { name: '与母亲一致', exact: true })).toBeEnabled();
  const mother = drawer.getByRole('radio', { name: '母亲', exact: true });
  await drawer.getByText('母亲', { exact: true }).click();
  await expect(mother).toBeChecked();
  await drawer.getByRole('button', { name: '与父亲一致', exact: true }).click();
  const phone = drawer.getByLabel('电话', { exact: true });
  await expect(phone).toHaveAttribute('placeholder', '提交时使用父亲的电话');
  await phone.fill('13900001234');
  await drawer.getByLabel('姓名', { exact: true }).fill('测试母亲');
  await drawer.getByLabel('工作单位', { exact: true }).fill('测试单位');
  await drawer.getByRole('button', { name: /^留\s*空$/ }).click();
  await expect(drawer.getByLabel('工作单位', { exact: true })).toHaveValue('null');
  await drawer.getByRole('button', { name: '提交家庭信息', exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]?.members[0]).toMatchObject({ phone: '13900001234', workplace: 'null' });
  expect(writes[0]?.members[0]?.phoneSourceItemKey).toBeUndefined();

  await expect(drawer.getByLabel('姓名', { exact: true })).toHaveValue('');
  await drawer.getByLabel('姓名', { exact: true }).fill('测试父亲');
  await drawer.getByRole('button', { name: '与母亲一致', exact: true }).click();
  await drawer.getByRole('button', { name: '提交家庭信息', exact: true }).click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[1]?.members[0]).toMatchObject({
    phoneSourceItemKey: 'parent-2',
    workplace: 'null',
  });
  expect(writes[1]?.members[0]?.phone).toBeUndefined();
});
