// e2e/specs/routing/public-auth-student-registration.spec.ts

import type { Route } from '@playwright/test';

import { routes } from '../../fixtures/routes';
import { AUTH_STORAGE_KEY, ensureFullNavigation, mockApiHealth } from '../../helpers/app';
import { expect, test } from '../../test';

function getGraphQLPayload(route: Route) {
  return route.request().postDataJSON() as
    | {
        query?: string;
        variables?: {
          input?: Record<string, unknown>;
          token?: string;
        };
      }
    | undefined;
}

async function fulfillGraphQL(route: Route, body: unknown) {
  await route.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json',
    status: 200,
  });
}

function buildEmptyPlannedTimetableResult() {
  return {
    invalidReason: null,
    isComplete: true,
    isValid: true,
    items: [],
    truncationReason: null,
  };
}

function buildJourneyAcademicSemesters() {
  return [
    {
      createdAt: '2026-04-01T00:00:00.000Z',
      endDate: '2026-07-10',
      examStartDate: '2026-06-22',
      firstTeachingDate: '2026-02-20',
      id: 101,
      isCurrent: true,
      isVisible: true,
      name: '2025-2026 学年第二学期',
      schoolYear: 2025,
      sortOrder: 0,
      startDate: '2026-02-17',
      termNumber: 2,
      updatedAt: '2026-04-02T00:00:00.000Z',
    },
  ];
}

function buildJourneyCalendarEvents() {
  return [
    {
      createdAt: '2026-04-05T00:00:00.000Z',
      dayPeriod: 'ALL_DAY',
      eventDate: '2026-04-20',
      eventType: 'SPORTS_MEET',
      id: 201,
      originalDate: null,
      recordStatus: 'ACTIVE',
      ruleNote: '春季活动安排',
      semesterId: 101,
      teachingCalcEffect: 'NO_CHANGE',
      topic: '春季运动会',
      updatedAt: '2026-04-06T00:00:00.000Z',
      updatedByAccountId: 9527,
      version: 1,
    },
  ];
}

function buildJourneyStudentAcademicSemesters() {
  return buildJourneyAcademicSemesters().map((semester) => ({
    endDate: semester.endDate,
    examStartDate: semester.examStartDate,
    firstTeachingDate: semester.firstTeachingDate,
    id: semester.id,
    isCurrent: semester.isCurrent,
    name: semester.name,
    schoolYear: semester.schoolYear,
    startDate: semester.startDate,
    termNumber: semester.termNumber,
  }));
}

function buildJourneyStudentCalendarEvents() {
  return buildJourneyCalendarEvents().map((event) => ({
    dayPeriod: event.dayPeriod,
    eventDate: event.eventDate,
    eventType: event.eventType,
    id: event.id,
    originalDate: event.originalDate,
    ruleNote: event.ruleNote,
    semesterId: event.semesterId,
    teachingCalcEffect: event.teachingCalcEffect,
    topic: event.topic,
  }));
}

function buildJourneyStudentMe() {
  return {
    account: {
      id: 2001,
      identityHint: 'STUDENT',
      loginEmail: 'student@example.com',
      loginName: 'stu001',
      status: 'ACTIVE',
    },
    accountId: 2001,
    identity: {
      __typename: 'StudentType',
      currentClassCode: '1031301',
      currentClassId: 'class-1031301',
      id: '313010101',
      name: '张三',
      slotGroup: [],
      upstreamId: '313010101',
    },
    needsProfileCompletion: false,
    userInfo: {
      accessGroup: ['STUDENT'],
      avatarUrl: null,
      email: 'student@example.com',
      nickname: '张三',
      signature: null,
      tags: [],
    },
  };
}

test('学生完成注册、验证邮箱、登录后应可从学生导航进入学期校历并退出账户', async ({ page }) => {
  let accountVerificationRequests = 0;
  let academicCalendarEventRequests = 0;
  let academicSemesterRequests = 0;
  let consumeInput: Record<string, unknown> | null = null;
  let loginInput: Record<string, unknown> | null = null;
  let mySemesterPlannedTimetableRequests = 0;
  let studentCalendarEventRequests = 0;
  let studentSemesterRequests = 0;
  let weeklyPlannedTimetableRequests = 0;

  await mockApiHealth(page);
  await page.route('**/graphql', async (route) => {
    const payload = getGraphQLPayload(route);
    const query = typeof payload?.query === 'string' ? payload.query : '';

    if (query.includes('query PublicStudentRegistrationLinkInfo')) {
      await fulfillGraphQL(route, {
        data: {
          publicStudentRegistrationLinkInfo: {
            success: true,
            reason: 'AVAILABLE',
            message: null,
            info: {
              canProceed: true,
              status: 'ACTIVE',
              scope: 'CLASS',
              classCode: '1031301',
              className: '信息1301班',
              studentId: null,
              expiresAt: '2026-06-30T12:00:00.000Z',
            },
          },
        },
      });
      return;
    }

    if (query.includes('mutation VerifyStudentRegistrationIdentity')) {
      await fulfillGraphQL(route, {
        data: {
          verifyStudentRegistrationIdentity: {
            success: true,
            canProceed: true,
            reason: 'AVAILABLE',
            message: null,
          },
        },
      });
      return;
    }

    if (query.includes('mutation VerifyStudentRegistrationAccount')) {
      accountVerificationRequests += 1;
      await fulfillGraphQL(route, {
        data: {
          verifyStudentRegistrationAccount: {
            success: true,
            canProceed: true,
            reason: 'AVAILABLE',
            message: null,
          },
        },
      });
      return;
    }

    if (query.includes('mutation ConsumeStudentRegistrationLink')) {
      consumeInput = payload?.variables?.input ?? null;
      await fulfillGraphQL(route, {
        data: {
          consumeStudentRegistrationLink: {
            success: true,
            message: '学生注册成功',
            accountId: 2001,
            loginEmail: 'student@example.com',
            accountStatus: 'PENDING',
            emailVerificationRequired: true,
            emailVerificationSent: true,
          },
        },
      });
      return;
    }

    if (query.includes('mutation VerifyLoginEmail')) {
      await fulfillGraphQL(route, {
        data: {
          verifyLoginEmail: {
            success: true,
            message: '登录邮箱已验证',
            reason: null,
            accountId: 2001,
            loginEmail: 'student@example.com',
          },
        },
      });
      return;
    }

    if (query.includes('mutation Login')) {
      loginInput = payload?.variables?.input ?? null;
      await fulfillGraphQL(route, {
        data: {
          login: {
            accessToken: 'student-access-token',
            refreshToken: 'student-refresh-token',
          },
        },
      });
      return;
    }

    if (query.includes('query Me')) {
      await fulfillGraphQL(route, {
        data: {
          me: buildJourneyStudentMe(),
        },
      });
      return;
    }

    if (query.includes('myProfileIdentity')) {
      await fulfillGraphQL(route, {
        data: {
          myProfileIdentity: {
            __typename: 'MyProfileStudentIdentityDTO',
            accountId: 2001,
            currentClassCode: '1031301',
            currentClassId: 'class-1031301',
            id: '313010101',
            name: '张三',
            upstreamId: '313010101',
          },
        },
      });
      return;
    }

    if (query.includes('query StudentAcademicSemesters')) {
      studentSemesterRequests += 1;
      await fulfillGraphQL(route, {
        data: {
          studentAcademicSemesters: buildJourneyStudentAcademicSemesters(),
        },
      });
      return;
    }

    if (query.includes('query StudentAcademicCalendarEvents')) {
      studentCalendarEventRequests += 1;
      await fulfillGraphQL(route, {
        data: {
          studentAcademicCalendarEvents: buildJourneyStudentCalendarEvents(),
        },
      });
      return;
    }

    if (query.includes('query AcademicSemesters')) {
      academicSemesterRequests += 1;
      await fulfillGraphQL(route, {
        data: {
          academicSemesters: buildJourneyAcademicSemesters(),
        },
      });
      return;
    }

    if (query.includes('query AcademicCalendarEvents')) {
      academicCalendarEventRequests += 1;
      await fulfillGraphQL(route, {
        data: {
          academicCalendarEvents: buildJourneyCalendarEvents(),
        },
      });
      return;
    }

    if (query.includes('query ListMyAcademicSemesterPlannedTimetable')) {
      mySemesterPlannedTimetableRequests += 1;
      await fulfillGraphQL(route, {
        data: {
          listMyAcademicSemesterPlannedTimetable: buildEmptyPlannedTimetableResult(),
        },
      });
      return;
    }

    if (query.includes('query ListAcademicWeeklyPlannedTimetable')) {
      weeklyPlannedTimetableRequests += 1;
      await fulfillGraphQL(route, {
        data: {
          listAcademicWeeklyPlannedTimetable: buildEmptyPlannedTimetableResult(),
        },
      });
      return;
    }

    await route.fallback();
  });

  await page.goto(routes.studentRegister('student-register-journey-001'));

  await expect(page.getByRole('heading', { name: '信息1301班 学生注册' })).toBeVisible();
  await page.getByLabel('学号').fill('313010101');
  await page.getByLabel('学生姓名').fill('张三');
  await page.getByLabel('身份证后 6 位').fill('A12345');
  await page.getByRole('button', { name: '下一步' }).click();
  await page.getByLabel('登录名（可选）').fill('stu001');
  await page.getByRole('textbox', { exact: true, name: '登录密码' }).fill('Password123!');
  await page.getByRole('textbox', { exact: true, name: '确认登录密码' }).fill('Password123!');
  await page.getByRole('button', { name: '下一步' }).click();
  await expect(page.getByText('密码包含常见的弱密码片段，请更换更复杂的密码。')).toBeVisible();
  expect(accountVerificationRequests).toBe(0);
  await page.getByRole('textbox', { exact: true, name: '登录密码' }).fill('Abc12345!');
  await page.getByRole('textbox', { exact: true, name: '确认登录密码' }).fill('Abc12345!');
  await page.getByRole('button', { name: '下一步' }).click();
  await page.getByLabel('登录邮箱').fill('student@example.com');
  await page.getByRole('button', { name: '提交注册' }).click();

  await expect(page.getByRole('alert').filter({ hasText: '账号已创建' })).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: '验证邮件已发送' })).toBeVisible();

  await page.goto(routes.verifyAccountEmail('student-email-verify-journey-001'));
  await expect(page.getByRole('alert').filter({ hasText: '登录邮箱已验证' })).toBeVisible();
  await page.getByRole('button', { name: '前往登录' }).click();

  await expect(page).toHaveURL(/\/login\?skipRestore=1$/);
  await expect(page.getByLabel('登录名或邮箱')).toHaveValue('student@example.com');
  await page.getByLabel('密码').fill('Abc12345!');
  await page.getByRole('button', { name: /登\s*录/ }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: '学生首页' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '我的学习首页' })).toBeVisible();
  await ensureFullNavigation(page);
  await expect(page.getByRole('menuitem', { name: '学期校历' })).toBeVisible();
  await page.getByRole('menuitem', { name: '学期校历' }).click();

  await expect(page).toHaveURL(routes.semesterCalendar);
  await expect(page.getByRole('heading', { name: '学期校历' })).toBeVisible();
  await expect(page.getByText('春季运动会')).toBeVisible();
  await expect(page.getByRole('menuitem', { name: '教务助手' })).toHaveCount(0);
  await page.getByRole('button', { name: '用户菜单' }).click();
  await expect(page.getByText('student@example.com')).toBeVisible();
  await expect(page.getByText('退出登录')).toBeVisible();
  await expect(page.getByText('增加另一个账号')).toHaveCount(0);
  await expect(
    page.evaluate((storageKey) => window.localStorage.getItem(storageKey), AUTH_STORAGE_KEY),
  ).resolves.not.toBeNull();
  await page.getByRole('button', { name: '退出登录' }).click();
  const logoutDialog = page.getByRole('dialog', { name: '退出登录' });

  await expect(logoutDialog.getByText('退出后需要重新登录。')).toBeVisible();
  await logoutDialog.getByRole('button', { name: /退\s*出/ }).click();

  await expect(page).toHaveURL(/\/login\?redirect=%2Fcalendar-schedule%2Fsemester-calendar$/);
  await expect(page.getByRole('heading', { name: '账号登录' })).toBeVisible();
  await expect(
    page.evaluate((storageKey) => window.localStorage.getItem(storageKey), AUTH_STORAGE_KEY),
  ).resolves.toBeNull();
  expect(consumeInput).toEqual({
    token: 'student-register-journey-001',
    studentId: '313010101',
    name: '张三',
    idCardLastSix: 'A12345',
    loginEmail: 'student@example.com',
    loginPassword: 'Abc12345!',
    loginName: 'stu001',
    nickname: '张三',
  });
  expect(loginInput).toEqual({
    audience: 'DESKTOP',
    loginName: 'student@example.com',
    loginPassword: 'Abc12345!',
    type: 'PASSWORD',
  });
  expect(studentSemesterRequests).toBe(1);
  expect(studentCalendarEventRequests).toBe(1);
  expect(academicSemesterRequests).toBe(0);
  expect(academicCalendarEventRequests).toBe(0);
  expect(mySemesterPlannedTimetableRequests).toBe(0);
  expect(weeklyPlannedTimetableRequests).toBe(0);
  expect(accountVerificationRequests).toBe(1);
});

test('学生注册链接注册成功后应进入待验证登录邮箱状态并支持泛化重发', async ({ page }) => {
  let accountInput: Record<string, unknown> | null = null;
  let consumeInput: Record<string, unknown> | null = null;
  let identityInput: Record<string, unknown> | null = null;
  let resendInput: Record<string, unknown> | null = null;

  await mockApiHealth(page);
  await page.route('**/graphql', async (route) => {
    const payload = getGraphQLPayload(route);
    const query = typeof payload?.query === 'string' ? payload.query : '';

    if (query.includes('query PublicStudentRegistrationLinkInfo')) {
      await fulfillGraphQL(route, {
        data: {
          publicStudentRegistrationLinkInfo: {
            success: true,
            reason: 'AVAILABLE',
            message: null,
            info: {
              canProceed: true,
              status: 'ACTIVE',
              scope: 'CLASS',
              classCode: '1031301',
              className: '信息1301班',
              studentId: null,
              expiresAt: '2026-06-30T12:00:00.000Z',
            },
          },
        },
      });
      return;
    }

    if (query.includes('mutation VerifyStudentRegistrationIdentity')) {
      identityInput = payload?.variables?.input ?? null;
      await fulfillGraphQL(route, {
        data: {
          verifyStudentRegistrationIdentity: {
            success: true,
            canProceed: true,
            reason: 'AVAILABLE',
            message: null,
          },
        },
      });
      return;
    }

    if (query.includes('mutation VerifyStudentRegistrationAccount')) {
      accountInput = payload?.variables?.input ?? null;
      await fulfillGraphQL(route, {
        data: {
          verifyStudentRegistrationAccount: {
            success: true,
            canProceed: true,
            reason: 'AVAILABLE',
            message: null,
          },
        },
      });
      return;
    }

    if (query.includes('mutation ConsumeStudentRegistrationLink')) {
      consumeInput = payload?.variables?.input ?? null;
      await fulfillGraphQL(route, {
        data: {
          consumeStudentRegistrationLink: {
            success: true,
            message: '学生注册成功',
            accountId: 1001,
            loginEmail: 'student@example.com',
            accountStatus: 'PENDING',
            emailVerificationRequired: true,
            emailVerificationSent: false,
          },
        },
      });
      return;
    }

    if (query.includes('mutation ResendLoginEmailVerification')) {
      resendInput = payload?.variables?.input ?? null;
      await fulfillGraphQL(route, {
        data: {
          resendLoginEmailVerification: {
            success: true,
            message: null,
          },
        },
      });
      return;
    }

    await route.fallback();
  });

  await page.goto(routes.studentRegister('student-register-success-001'));

  await expect(page.getByRole('heading', { name: '信息1301班 学生注册' })).toBeVisible();
  await expect(page.getByText('班级代码')).toHaveCount(0);
  await expect(page.getByText('适用范围')).toHaveCount(0);
  await expect(page.getByText('过期时间')).toHaveCount(0);
  await expect(page.getByText('1031301')).toHaveCount(0);
  await expect(page.getByPlaceholder('请输入完整学号')).toBeVisible();
  await expect(page.getByText('例如：3130101XX')).toBeVisible();
  await page.getByLabel('学号').fill('S001');
  await page.getByLabel('学生姓名').fill('张三');
  await page.getByLabel('身份证后 6 位').fill('A12345');
  await page.getByRole('button', { name: '下一步' }).click();
  await expect(page.getByLabel('昵称（可选）')).toHaveValue('张三');
  await page.getByLabel('登录名（可选）').fill('stu001');
  await page.getByRole('textbox', { exact: true, name: '登录密码' }).fill('Abc12345!');
  await page.getByRole('textbox', { exact: true, name: '确认登录密码' }).fill('Abc12345!');
  await page.getByRole('button', { name: '下一步' }).click();
  await page.getByLabel('登录邮箱').fill('student@example.com');
  await page.getByRole('button', { name: '提交注册' }).click();

  await expect(page.getByRole('alert').filter({ hasText: '账号已创建' })).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: '验证邮件发送失败' })).toBeVisible();
  await page.getByRole('button', { name: '重新发送验证邮件' }).click();
  await expect(page.getByRole('alert').filter({ hasText: '如果账户需要验证' })).toBeVisible();

  expect(identityInput).toEqual({
    token: 'student-register-success-001',
    studentId: 'S001',
    name: '张三',
    idCardLastSix: 'A12345',
  });
  expect(accountInput).toEqual({
    token: 'student-register-success-001',
    loginName: 'stu001',
    loginPassword: 'Abc12345!',
    nickname: '张三',
  });
  expect(consumeInput).toEqual({
    token: 'student-register-success-001',
    studentId: 'S001',
    name: '张三',
    idCardLastSix: 'A12345',
    loginEmail: 'student@example.com',
    loginPassword: 'Abc12345!',
    loginName: 'stu001',
    nickname: '张三',
  });
  expect(resendInput).toEqual({
    loginEmail: 'student@example.com',
  });
});

test('账号预校验遇到链接失效时应刷新链接状态并进入整页失效态', async ({ page }) => {
  let linkInfoRequests = 0;

  await mockApiHealth(page);
  await page.route('**/graphql', async (route) => {
    const payload = getGraphQLPayload(route);
    const query = typeof payload?.query === 'string' ? payload.query : '';

    if (query.includes('query PublicStudentRegistrationLinkInfo')) {
      linkInfoRequests += 1;

      if (linkInfoRequests === 1) {
        await fulfillGraphQL(route, {
          data: {
            publicStudentRegistrationLinkInfo: {
              success: true,
              reason: 'AVAILABLE',
              message: null,
              info: {
                canProceed: true,
                status: 'ACTIVE',
                scope: 'STUDENT',
                classCode: '1031301',
                className: '信息1301班',
                studentId: 'S001',
                expiresAt: '2026-06-30T12:00:00.000Z',
              },
            },
          },
        });
        return;
      }

      await fulfillGraphQL(route, {
        data: {
          publicStudentRegistrationLinkInfo: {
            success: false,
            reason: 'LINK_NOT_ACTIVE',
            message: '学生注册链接不可用',
            info: {
              canProceed: false,
              status: 'CONSUMED',
              scope: 'STUDENT',
              classCode: '1031301',
              className: '信息1301班',
              studentId: 'S001',
              expiresAt: '2026-06-30T12:00:00.000Z',
            },
          },
        },
      });
      return;
    }

    if (query.includes('mutation VerifyStudentRegistrationIdentity')) {
      await fulfillGraphQL(route, {
        data: {
          verifyStudentRegistrationIdentity: {
            success: true,
            canProceed: true,
            reason: 'AVAILABLE',
            message: null,
          },
        },
      });
      return;
    }

    if (query.includes('mutation VerifyStudentRegistrationAccount')) {
      await fulfillGraphQL(route, {
        data: {
          verifyStudentRegistrationAccount: {
            success: false,
            canProceed: false,
            reason: 'LINK_NOT_ACTIVE',
            message: '学生注册链接不可用',
          },
        },
      });
      return;
    }

    await route.fallback();
  });

  await page.goto(routes.studentRegister('student-register-consumed-during-account-001'));

  await expect(page.getByLabel('学号')).toHaveValue('S001');
  await expect(page.getByLabel('学号')).toBeDisabled();
  await page.getByLabel('学生姓名').fill('张三');
  await page.getByLabel('身份证后 6 位').fill('A12345');
  await page.getByRole('button', { name: '下一步' }).click();
  await expect(page.getByLabel('昵称（可选）')).toHaveValue('张三');
  await page.getByLabel('登录名（可选）').fill('stu001');
  await page.getByRole('textbox', { exact: true, name: '登录密码' }).fill('Abc12345!');
  await page.getByRole('textbox', { exact: true, name: '确认登录密码' }).fill('Abc12345!');
  await page.getByRole('button', { name: '下一步' }).click();

  await expect(page.getByRole('alert').filter({ hasText: '注册链接已使用' })).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: '学生注册链接不可用' })).toBeVisible();
  await expect(page.getByLabel('登录邮箱')).toHaveCount(0);
  expect(linkInfoRequests).toBe(2);
});

test('最终提交遇到链接失效时应刷新链接状态并进入整页失效态', async ({ page }) => {
  let linkInfoRequests = 0;

  await mockApiHealth(page);
  await page.route('**/graphql', async (route) => {
    const payload = getGraphQLPayload(route);
    const query = typeof payload?.query === 'string' ? payload.query : '';

    if (query.includes('query PublicStudentRegistrationLinkInfo')) {
      linkInfoRequests += 1;

      await fulfillGraphQL(route, {
        data: {
          publicStudentRegistrationLinkInfo:
            linkInfoRequests === 1
              ? {
                  success: true,
                  reason: 'AVAILABLE',
                  message: null,
                  info: {
                    canProceed: true,
                    status: 'ACTIVE',
                    scope: 'STUDENT',
                    classCode: '1031301',
                    className: '信息1301班',
                    studentId: 'S001',
                    expiresAt: '2026-06-30T12:00:00.000Z',
                  },
                }
              : {
                  success: false,
                  reason: 'LINK_NOT_ACTIVE',
                  message: '学生注册链接不可用',
                  info: {
                    canProceed: false,
                    status: 'CONSUMED',
                    scope: 'STUDENT',
                    classCode: '1031301',
                    className: '信息1301班',
                    studentId: 'S001',
                    expiresAt: '2026-06-30T12:00:00.000Z',
                  },
                },
        },
      });
      return;
    }

    if (query.includes('mutation VerifyStudentRegistrationIdentity')) {
      await fulfillGraphQL(route, {
        data: {
          verifyStudentRegistrationIdentity: {
            success: true,
            canProceed: true,
            reason: 'AVAILABLE',
            message: null,
          },
        },
      });
      return;
    }

    if (query.includes('mutation VerifyStudentRegistrationAccount')) {
      await fulfillGraphQL(route, {
        data: {
          verifyStudentRegistrationAccount: {
            success: true,
            canProceed: true,
            reason: 'AVAILABLE',
            message: null,
          },
        },
      });
      return;
    }

    if (query.includes('mutation ConsumeStudentRegistrationLink')) {
      await fulfillGraphQL(route, {
        errors: [
          {
            message: '学生注册链接不可用',
            extensions: {
              code: 'BAD_USER_INPUT',
              errorCode: 'STUDENT_REGISTRATION_LINK_NOT_ACTIVE',
              errorMessage: '学生注册链接不可用',
            },
          },
        ],
      });
      return;
    }

    await route.fallback();
  });

  await page.goto(routes.studentRegister('student-register-consumed-during-submit-001'));

  await expect(page.getByLabel('学号')).toHaveValue('S001');
  await page.getByLabel('学生姓名').fill('张三');
  await page.getByLabel('身份证后 6 位').fill('A12345');
  await page.getByRole('button', { name: '下一步' }).click();
  await page.getByLabel('登录名（可选）').fill('stu001');
  await page.getByRole('textbox', { exact: true, name: '登录密码' }).fill('Abc12345!');
  await page.getByRole('textbox', { exact: true, name: '确认登录密码' }).fill('Abc12345!');
  await page.getByRole('button', { name: '下一步' }).click();
  await page.getByLabel('登录邮箱').fill('student@example.com');
  await page.getByRole('button', { name: '提交注册' }).click();

  await expect(page.getByRole('alert').filter({ hasText: '注册链接已使用' })).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: '学生注册链接不可用' })).toBeVisible();
  await expect(page.getByLabel('登录邮箱')).toHaveCount(0);
  expect(linkInfoRequests).toBe(2);
});

test('指定学生注册链接应锁定学号输入', async ({ page }) => {
  await mockApiHealth(page);
  await page.route('**/graphql', async (route) => {
    const payload = getGraphQLPayload(route);
    const query = typeof payload?.query === 'string' ? payload.query : '';

    if (query.includes('query PublicStudentRegistrationLinkInfo')) {
      await fulfillGraphQL(route, {
        data: {
          publicStudentRegistrationLinkInfo: {
            success: true,
            reason: 'AVAILABLE',
            message: null,
            info: {
              canProceed: true,
              status: 'ACTIVE',
              scope: 'STUDENT',
              classCode: '1031301',
              className: '信息1301班',
              studentId: 'S001',
              expiresAt: '2026-06-30T12:00:00.000Z',
            },
          },
        },
      });
      return;
    }

    await route.fallback();
  });

  await page.goto(routes.studentRegister('student-register-locked-001'));

  await expect(page.getByLabel('学号')).toHaveValue('S001');
  await expect(page.getByLabel('学号')).toBeDisabled();
  await expect(page.getByLabel('学生姓名')).toBeVisible();
});

test('学生注册链接不可用时不展示注册表单', async ({ page }) => {
  await mockApiHealth(page);
  await page.route('**/graphql', async (route) => {
    const payload = getGraphQLPayload(route);
    const query = typeof payload?.query === 'string' ? payload.query : '';

    if (query.includes('query PublicStudentRegistrationLinkInfo')) {
      await fulfillGraphQL(route, {
        data: {
          publicStudentRegistrationLinkInfo: {
            success: false,
            reason: 'LINK_NOT_FOUND',
            message: '这个学生注册链接无效，请确认链接是否完整。',
            info: null,
          },
        },
      });
      return;
    }

    await route.fallback();
  });

  await page.goto(routes.studentRegister('missing-register-link'));

  await expect(page.getByRole('alert')).toContainText('注册链接不可用');
  await expect(page.getByLabel('学号')).toHaveCount(0);
});

test('登录邮箱验证成功后应跳转登录页并预填登录邮箱', async ({ page }) => {
  await mockApiHealth(page);
  await page.route('**/graphql', async (route) => {
    const payload = getGraphQLPayload(route);
    const query = typeof payload?.query === 'string' ? payload.query : '';

    if (query.includes('mutation VerifyLoginEmail')) {
      await fulfillGraphQL(route, {
        data: {
          verifyLoginEmail: {
            success: true,
            message: '登录邮箱已验证',
            reason: null,
            accountId: 1001,
            loginEmail: 'student@example.com',
          },
        },
      });
      return;
    }

    await route.fallback();
  });

  await page.goto(routes.verifyAccountEmail('verify-account-email-success-001'));

  await expect(page.getByRole('alert').filter({ hasText: '登录邮箱已验证' })).toBeVisible();
  await page.getByRole('button', { name: '前往登录' }).click();
  await expect(page).toHaveURL(/\/login\?skipRestore=1$/);
  await expect(page.getByLabel('登录名或邮箱')).toHaveValue('student@example.com');
});

test('登录邮箱验证失败应按 reason 展示失败态', async ({ page }) => {
  await mockApiHealth(page);
  await page.route('**/graphql', async (route) => {
    const payload = getGraphQLPayload(route);
    const query = typeof payload?.query === 'string' ? payload.query : '';

    if (query.includes('mutation VerifyLoginEmail')) {
      await fulfillGraphQL(route, {
        data: {
          verifyLoginEmail: {
            success: false,
            message: '这个登录邮箱验证链接已经过期，请重新发送验证邮件。',
            reason: 'EXPIRED',
            accountId: null,
            loginEmail: 'student@example.com',
          },
        },
      });
      return;
    }

    await route.fallback();
  });

  await page.goto(routes.verifyAccountEmail('verify-account-email-expired-001'));

  await expect(page.getByRole('alert')).toContainText('验证链接已过期');
  await expect(page.getByRole('button', { name: '返回登录' })).toBeVisible();
});
