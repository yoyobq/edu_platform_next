import type { Page } from '@playwright/test';

import { openEntrySidecar, openHomeWithSearch } from '../../helpers/app';
import { expect, test } from '../../test';

type AiWorkflowMockState = {
  complete: boolean;
  completeAfterQueryCount: number;
  queueCount: number;
  queueResponseCount: number;
  resultQueryCount: number;
};

async function mockAiChatWorkflow(
  page: Page,
  options: {
    completeAfterQueryCount?: number;
    queueDelayMs?: number;
    resultGraphQLErrorCode?: string;
  } = {},
): Promise<AiWorkflowMockState> {
  const state: AiWorkflowMockState = {
    complete: false,
    completeAfterQueryCount: options.completeAfterQueryCount ?? 2,
    queueCount: 0,
    queueResponseCount: 0,
    resultQueryCount: 0,
  };

  await page.route('**/graphql', async (route) => {
    const payload = route.request().postDataJSON() as { query?: string } | undefined;
    const query = payload?.query ?? '';

    if (query.includes('mutation QueueExampleTextRewriteWorkflow')) {
      state.queueCount += 1;

      if (options.queueDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, options.queueDelayMs));
      }

      await route.fulfill({
        body: JSON.stringify({
          data: {
            queueExampleTextRewriteWorkflow: {
              admissionStatus: 'QUEUED',
              workflowId: 'workflow-sidecar-1',
              workflowStatus: 'QUEUED',
              jobId: 'job-sidecar-1',
              traceId: 'trace-sidecar-1',
              asyncTaskRecordId: 1,
              reason: null,
            },
          },
        }),
        contentType: 'application/json',
        status: 200,
      });
      state.queueResponseCount += 1;
      return;
    }

    if (query.includes('query AiWorkflowDemoResult')) {
      state.resultQueryCount += 1;

      if (options.resultGraphQLErrorCode) {
        await route.fulfill({
          body: JSON.stringify({
            errors: [
              {
                message: 'query rejected',
                extensions: { code: options.resultGraphQLErrorCode },
              },
            ],
          }),
          contentType: 'application/json',
          status: 200,
        });
        return;
      }

      const completed = state.complete || state.resultQueryCount >= state.completeAfterQueryCount;

      await route.fulfill({
        body: JSON.stringify({
          data: {
            aiWorkflowDemoResult: {
              workflowId: 'workflow-sidecar-1',
              workflowType: 'EXAMPLE_TEXT_REWRITE_V1',
              workflowStatus: completed ? 'SUCCEEDED' : 'PROCESSING',
              traceId: 'trace-sidecar-1',
              jobId: 'job-sidecar-1',
              provider: 'qwen',
              model: 'qwen-plus',
              outputPayloadKind: completed ? 'PRESENT' : 'NONE',
              outputPayload: completed ? { 生成文本: '这是 Qwen 返回的完整回复。' } : null,
              errorCode: null,
              errorMessage: null,
              createdAt: '2026-07-13T00:00:00.000Z',
              updatedAt: '2026-07-13T00:00:01.000Z',
            },
          },
        }),
        contentType: 'application/json',
        status: 200,
      });
      return;
    }

    await route.fallback();
  });

  return state;
}

test('入口处于可用状态时，应通过 Qwen workflow 返回完整回复', async ({ page }) => {
  await openHomeWithSearch(page, '?availability=available');
  const workflowState = await mockAiChatWorkflow(page);

  await openEntrySidecar(page);
  await expect(page.getByPlaceholder('输入单轮问题或任务')).toBeFocused();
  await expect(page.getByText('增强入口当前已降级，复杂协作会优先回退到本地入口。')).toHaveCount(0);
  await expect(page.getByText('增强入口暂未连接，你仍可正常使用项目功能。')).toHaveCount(0);

  await page.getByPlaceholder('输入单轮问题或任务').fill('解释一下异步工作流');
  await page.getByPlaceholder('输入单轮问题或任务').press('Enter');

  await expect(page.getByText('Qwen 正在生成完整回复。')).toBeVisible();
  await expect(page.getByText('这是 Qwen 返回的完整回复。')).toBeVisible();
  await expect(page.getByText('Sandbox 演练场')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^进入/ })).toHaveCount(0);
  expect(workflowState.queueCount).toBe(1);
  expect(workflowState.resultQueryCount).toBeGreaterThanOrEqual(2);
});

test('刷新页面后，应使用保存的 workflowId 恢复查询且不重复提交', async ({ page }) => {
  await openHomeWithSearch(page, '?availability=available');
  const workflowState = await mockAiChatWorkflow(page, {
    completeAfterQueryCount: Number.POSITIVE_INFINITY,
  });

  await openEntrySidecar(page);
  await page.getByPlaceholder('输入单轮问题或任务').fill('刷新后继续查询');
  await page.getByPlaceholder('输入单轮问题或任务').press('Enter');
  await expect(page.getByText('Qwen 正在生成完整回复。')).toBeVisible();

  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('edu-mate.ai-chat.pending.v1:9527')))
    .not.toBeNull();

  workflowState.complete = true;
  await page.reload();
  await openEntrySidecar(page);

  await expect(page.getByText('这是 Qwen 返回的完整回复。')).toBeVisible();
  expect(workflowState.queueCount).toBe(1);
  expect(workflowState.resultQueryCount).toBeGreaterThanOrEqual(2);
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('edu-mate.ai-chat.pending.v1:9527')))
    .toBeNull();
});

test('查询遇到非终态权限错误时，应保留恢复信息直到用户显式停止', async ({ page }) => {
  await openHomeWithSearch(page, '?availability=available');
  await mockAiChatWorkflow(page, { resultGraphQLErrorCode: 'FORBIDDEN' });

  await openEntrySidecar(page);
  await page.getByPlaceholder('输入单轮问题或任务').fill('保留仍在执行的任务');
  await page.getByPlaceholder('输入单轮问题或任务').press('Enter');

  await expect(page.getByText(/当前账号没有使用 AI 预览的权限/)).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('edu-mate.ai-chat.pending.v1:9527')))
    .not.toBeNull();

  await page.getByRole('button', { name: '停止等待并新建对话' }).click();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('edu-mate.ai-chat.pending.v1:9527')))
    .toBeNull();
  await expect(page.getByPlaceholder('输入单轮问题或任务')).toBeEnabled();
});

test('admission 返回前显式停止时，不应在响应后恢复已丢弃的任务', async ({ page }) => {
  await openHomeWithSearch(page, '?availability=available');
  const workflowState = await mockAiChatWorkflow(page, { queueDelayMs: 500 });

  await openEntrySidecar(page);
  await page.getByPlaceholder('输入单轮问题或任务').fill('不要恢复这条任务');
  await page.getByPlaceholder('输入单轮问题或任务').press('Enter');
  await page.getByRole('button', { name: '停止等待并新建对话' }).click();

  await expect.poll(() => workflowState.queueResponseCount).toBe(1);
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('edu-mate.ai-chat.pending.v1:9527')))
    .toBeNull();

  await page.reload();
  await openEntrySidecar(page);
  await expect(page.getByText('不要恢复这条任务')).toHaveCount(0);
  expect(workflowState.queueCount).toBe(1);
});
