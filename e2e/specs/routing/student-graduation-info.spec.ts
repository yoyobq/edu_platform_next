// e2e/specs/routing/student-graduation-info.spec.ts
import type { Page } from '@playwright/test';

import { mockApiHealth, mockAuthGraphQL, seedAuthSession } from '../../helpers/app';
import { expect, test } from '../../test';

const FILING = '/class-affairs/student-profile-filing';
const classOption = {
  id: 'A',
  classCode: '2401',
  className: '毕业验收班',
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
  studentName: '毕业验收学生',
  studentStatus: 'ENROLLED',
  currentClassId: 'A',
  currentClassCode: '2401',
  activeMembershipClassCode: '2401',
  activeMembershipClassName: '毕业验收班',
  rosterScopeSource: 'ACTIVE_MEMBERSHIP',
  attentionLevel: 'READY',
  snapshotPresent: true,
  upstreamIdPresent: true,
  profileCompletenessFlags: {
    personalObserved: true,
    sensitiveIdentifiersObserved: true,
    photoObserved: true,
    familyObserved: true,
    educationObserved: true,
    recordObserved: true,
  },
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

type GraduationField = {
  field: string;
  value: string | null;
  localValue: string | null;
  canSet: boolean;
  source: string;
  warningCodes: string[];
};

async function setup(
  page: Page,
  additionalFields: GraduationField[] = [],
  trainingLevel: string | null = null,
) {
  const formWarnings: string[] = [];
  page.on('console', (message) => {
    if (message.text().includes('useForm') && message.text().includes('not connected')) {
      formWarnings.push(message.text());
    }
  });
  await mockApiHealth(page);
  await mockAuthGraphQL(page, { currentSession: { accountId: 1, primaryAccessGroup: 'ADMIN' } });
  await seedAuthSession(page, { accountId: 1, primaryAccessGroup: 'ADMIN' });
  let revision = '1:upstream:local-1';
  let content = '原证书';
  let conflict = false;
  const writes: {
    expectedRevision: string;
    fields: { field: string; action: string; value?: string }[];
  }[] = [];
  const view = () => ({
    studentId: 'S1',
    revision,
    expectedGraduationYear: 2027,
    trainingLevel,
    updatedAt: null,
    canEdit: true,
    mainSnapshotPresent: true,
    fields: [
      {
        field: 'GRADUATION_CERTIFICATE_NO',
        value: content,
        localValue: content,
        canSet: true,
        source: 'LOCAL',
        warningCodes: [],
      },
      ...additionalFields,
    ],
  });
  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as {
      query?: string;
      variables?: {
        input?: {
          expectedRevision: string;
          fields: { field: string; action: string; value?: string }[];
        };
      };
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
        className: '毕业验收班',
        studentCount: 1,
        students: [student],
      };
    } else if (query.includes('patchStudentPrivateProfileGraduationInfo')) {
      const input = payload.variables?.input;
      if (!input) throw new Error('Missing graduation patch');
      writes.push(input);
      if (conflict) {
        conflict = false;
        revision = '1:upstream:local-2';
        content = '他人更新证书';
        await route.fulfill({
          json: {
            data: null,
            errors: [{ message: '毕业信息已变化', extensions: { code: 'CONFLICT' } }],
          },
        });
        return;
      }
      field = 'patchStudentPrivateProfileGraduationInfo';
      revision = '1:upstream:local-3';
      for (const patch of input.fields) {
        if (patch.field === 'GRADUATION_CERTIFICATE_NO') {
          content = patch.value ?? '';
        } else {
          const target = additionalFields.find((field) => field.field === patch.field);
          if (target) {
            target.value = patch.value ?? null;
            target.localValue = patch.value ?? null;
            target.source = patch.action === 'SET' ? 'LOCAL' : 'MISSING';
          }
        }
      }
      result = view();
    } else if (query.includes('studentPrivateProfileGraduationInfo')) {
      field = 'studentPrivateProfileGraduationInfo';
      result = view();
    }
    if (!field) {
      await route.fallback();
      return;
    }
    await route.fulfill({ json: { data: { [field]: result } } });
  });
  await page.goto(`${FILING}?classId=A&studentId=S1`);
  await page.getByRole('button', { name: '毕业信息', exact: true }).click();
  await expect(page.getByLabel('毕业证书编号')).toHaveValue('原证书');
  return {
    writes,
    formWarnings,
    failNextSave: () => {
      conflict = true;
    },
  };
}

test('毕业保存冲突保留输入，取消重读不丢草稿，确认重读后按最新基线保存', async ({ page }) => {
  const scenario = await setup(page);
  const input = page.getByLabel('毕业证书编号');
  await input.fill('我的待保存证书');
  scenario.failNextSave();
  await page.getByRole('button', { name: '本地保存毕业信息' }).click();
  await expect(
    page.getByText('资料已被他人或上游刷新修改。当前输入已保留，请重新读取后核对再保存。'),
  ).toBeVisible();
  await expect(input).toHaveValue('我的待保存证书');
  expect(scenario.writes).toHaveLength(1);
  await page.getByRole('button', { name: '重新读取毕业信息' }).click();
  await page.getByRole('button', { name: /^取\s*消$/ }).click();
  await expect(input).toHaveValue('我的待保存证书');
  await page.getByRole('button', { name: '重新读取毕业信息' }).click();
  await page.getByRole('button', { name: /^确\s*定$/ }).click();
  await expect(input).toHaveValue('他人更新证书');
  await input.fill('核对后提交证书');
  await page.getByRole('button', { name: '本地保存毕业信息' }).click();
  await expect(page.getByText('毕业信息已本地保存')).toBeVisible();
  expect(scenario.writes.map((write) => write.expectedRevision)).toEqual([
    '1:upstream:local-1',
    '1:upstream:local-2',
  ]);
  expect(scenario.writes[1]?.fields).toEqual([
    { field: 'GRADUATION_CERTIFICATE_NO', action: 'SET', value: '核对后提交证书' },
  ]);
});

test('毕业抽屉未保存关闭需确认，继续编辑保留输入，放弃后重新打开使用正式值', async ({ page }) => {
  const scenario = await setup(page);
  await page.getByLabel('毕业证书编号').fill('未保存证书');
  await page.locator('.ant-drawer-close').click();
  await page.getByRole('button', { name: '继续编辑', exact: true }).click();
  await expect(page.getByLabel('毕业证书编号')).toHaveValue('未保存证书');
  await page.locator('.ant-drawer-close').click();
  await page.getByRole('button', { name: '放弃修改', exact: true }).click();
  await expect(page.getByLabel('毕业证书编号')).toHaveCount(0);
  expect(scenario.writes).toHaveLength(0);
  await page.getByRole('button', { name: '毕业信息', exact: true }).click();
  await expect(page.getByLabel('毕业证书编号')).toHaveValue('原证书');
  expect(scenario.formWarnings).toEqual([]);
});

test('毕业日期使用日历选择，默认日期和就业只在显式保存后按日期字符串提交', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-04T04:00:00Z'));
  const scenario = await setup(
    page,
    [
      'ACTUAL_GRADUATION_DATE',
      'INTERNSHIP_START_DATE',
      'INTERNSHIP_END_DATE',
      'DESTINATION',
      'VOCATIONAL_SKILL_TYPE',
    ].map((field) => ({
      field,
      value: null,
      localValue: null,
      canSet: true,
      source: 'MISSING',
      warningCodes: ['GRADUATION_FIELD_MISSING'],
    })),
    '高级',
  );

  const graduation = page.getByLabel('实际毕业日期', { exact: true });
  const internshipStart = page.getByLabel('实习开始日期', { exact: true });
  const internshipEnd = page.getByLabel('实习结束日期', { exact: true });
  await expect(graduation).toHaveValue('2026-06-30');
  await expect(internshipStart).toHaveValue('2026-01-16');
  await expect(internshipEnd).toHaveValue('2026-06-30');
  await expect(page.getByLabel('职业技能工种 / 类型', { exact: true })).toHaveValue('高级工');
  for (const picker of [graduation, internshipStart, internshipEnd]) {
    await expect(picker).toHaveAttribute('readonly', '');
  }
  await expect(page.locator('.ant-form-item').filter({ hasText: '毕业去向' })).toContainText(
    '就业',
  );
  await expect(page.getByRole('button', { name: '本地保存毕业信息' })).toBeEnabled();
  expect(scenario.writes).toHaveLength(0);

  await graduation.click();
  await page.locator('.ant-picker-dropdown:visible td[title="2026-06-29"]').click();
  await expect(graduation).toHaveValue('2026-06-29');
  await page.getByRole('button', { name: '本地保存毕业信息' }).click();
  await expect(page.getByText('毕业信息已本地保存')).toBeVisible();
  expect(scenario.writes).toHaveLength(1);
  expect(scenario.writes[0]?.fields).toEqual([
    { field: 'ACTUAL_GRADUATION_DATE', action: 'SET', value: '2026-06-29' },
    { field: 'INTERNSHIP_START_DATE', action: 'SET', value: '2026-01-16' },
    { field: 'INTERNSHIP_END_DATE', action: 'SET', value: '2026-06-30' },
    { field: 'DESTINATION', action: 'SET', value: '就业' },
    { field: 'VOCATIONAL_SKILL_TYPE', action: 'SET', value: '高级工' },
  ]);
  await expect(page.getByRole('button', { name: '本地保存毕业信息' })).toBeDisabled();
  const graduationItem = page.locator('.ant-form-item').filter({ has: graduation });
  await graduationItem.locator('.ant-picker').hover();
  await graduationItem.getByRole('button', { name: '清除', exact: true }).click();
  await expect(graduation).toHaveValue('');
  await page.getByRole('button', { name: '本地保存毕业信息' }).click();
  await expect.poll(() => scenario.writes.length).toBe(2);
  expect(scenario.writes[1]?.fields).toEqual([
    { field: 'ACTUAL_GRADUATION_DATE', action: 'CLEAR' },
  ]);
  await expect(page.getByRole('button', { name: '本地保存毕业信息' })).toBeDisabled();
  await expect(graduation).toHaveValue('');
  expect(scenario.formWarnings).toEqual([]);
});
