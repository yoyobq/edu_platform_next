// src/features/teaching-inspection/application/run.ts
import { hasGraphQLCategory } from '@/shared/graphql';

import type { RecoveryEntry } from '../infrastructure/recovery';
import type { PrepareInput } from '../model';
import { blockerText, operationText } from '../model';

import type { Draft, Row, RunContext } from './workbench.types';
export async function run(context: RunContext, submit: boolean, target?: Row) {
  const {
    running,
    stop,
    alive,
    latestSession,
    chosen,
    emptyChapter,
    canPrepare,
    canSubmit,
    patch,
    drafts,
    setBusy,
    setActivity,
    setError,
    setProgress,
    setDrafts,
    semesterId,
    kind,
    isIndividual,
    account,
    retirePreparationTracking,
    track,
    forget,
    rememberPreparation,
    reload,
    recoveries,
    flow,
    api,
    newRequestId,
    waitBetweenItems,
  } = context;
  const targets = target ? [target] : chosen;
  if (running.current || (submit && targets.some(emptyChapter))) return;
  const controller = latestSession.current;
  let current = controller.session;
  if (!current) {
    controller.openLoginModal();
    return;
  }
  const upstreamIdentity = current.upstreamLoginId;
  const sameIdentity = () => latestSession.current.session?.upstreamLoginId === upstreamIdentity;
  const publish = (key: string, value: Draft) => {
    if (sameIdentity()) patch(key, value);
  };
  const queue = targets.filter(submit ? canSubmit : canPrepare);
  if (!queue.length) return;
  running.current = true;
  stop.current = false;
  setBusy(true);
  setActivity(submit ? { kind: 'submit', key: target?.key } : { kind: 'prepare' });
  setError('');
  let touched = false;
  let done = 0,
    success = 0,
    failed = 0,
    unknown = 0;
  const update = (label: string) => {
    if (alive.current) setProgress({ done, total: queue.length, success, failed, unknown, label });
  };
  // Rolling credentials belong to this queue; never read a stale render between requests.
  const persist = (result: { upstreamSessionToken: string | null; expiresAt: string | null }) => {
    if (!sameIdentity()) throw new Error('检查人不一致，材料已清理，请同步数据。');
    controller.persistSessionFromResult(current!, result);
    if (result.upstreamSessionToken)
      current = {
        ...current!,
        upstreamSessionToken: result.upstreamSessionToken,
        expiresAt: result.expiresAt ?? current!.expiresAt,
      };
  };
  try {
    update(submit ? '开始提交' : '开始准备');
    if (!submit) {
      const requests: { row: Row; input: PrepareInput }[] = [];
      for (const row of queue) {
        if (stop.current || !sameIdentity()) break;
        publish(row.key, { state: 'busy', message: '正在读取课程' });
        update(`正在读取 ${row.name} · ${row.course!.courseName}`);
        const detail = await api.detail(semesterId, row.course!.resourceKey, kind);
        if (!sameIdentity()) throw new Error('检查人不一致，材料已清理，请同步数据。');
        const checkDate = detail.schedule.dates[row.round - 1];
        if (checkDate !== row.date) {
          publish(row.key, { state: 'error', message: '检查日期已变化，请刷新列表' });
          failed++;
          done++;
          continue;
        }
        const input: PrepareInput = {
          semesterId,
          kind,
          resourceKey: detail.resourceKey,
          round: row.round,
          checkDate,
          scheduleVersion: detail.schedule.version,
          clientRequestId: newRequestId(),
        };
        requests.push({ row, input });
        publish(row.key, { state: 'busy', message: '正在准备' });
      }
      if (!stop.current && sameIdentity() && requests.length) {
        update(`正在准备 ${requests[0].row.name} 等 ${requests.length} 项`);
        touched = true;
        setActivity({ kind: 'prepare', dispatched: true });
        if (isIndividual) {
          // Every original request is durable before any batch generation can start.
          for (const request of requests) {
            retirePreparationTracking(request.row);
            track({
              ...request.input,
              accountId: account.accountId,
              upstreamLoginId: upstreamIdentity,
              action: 'PREPARE',
              prepare: request.input,
            });
          }
        }
        const generated =
          isIndividual && requests.length === 1
            ? await flow.prepare(requests[0].input, current!.upstreamSessionToken)
            : null;
        const response = generated
          ? {
              ...generated,
              items: [
                {
                  resourceKey: requests[0].input.resourceKey,
                  round: requests[0].input.round,
                  result: generated,
                },
              ],
            }
          : await api.prepareBatch(
              requests.map((request) => request.input),
              current!.upstreamSessionToken,
              kind,
            );
        persist(response);
        for (const request of requests) {
          const result = response.items.find(
            (item) =>
              item.resourceKey === request.input.resourceKey && item.round === request.input.round,
          )?.result;
          if (isIndividual && result) {
            if (!result.operation) forget([request.input.clientRequestId]);
            rememberPreparation(result);
          }
          if (result?.preview && !result.blockers.length) {
            publish(request.row.key, {
              state: 'ready',
              message: '已准备，待确认',
              prepared: result,
            });
            success++;
          } else {
            publish(request.row.key, {
              state: 'error',
              prepared: result ?? undefined,
              message: result
                ? result.blockers.map(blockerText).join('；') || '材料无法准备'
                : '准备失败，请同步数据',
            });
            failed++;
          }
          done++;
          update('准备数据中');
        }
      }
    } else {
      for (const row of queue) {
        if (stop.current || !sameIdentity()) break;
        const draft = drafts[row.key];
        const prepared = draft.prepared!;
        const preview = prepared.preview!;
        if (api.previewHasExpired(preview.expiresAt)) {
          publish(row.key, { ...draft, state: 'error', message: '材料已过期，请重新准备并确认' });
          failed++;
          done++;
          update('需要重新准备');
          continue;
        }
        const input = {
          semesterId,
          kind,
          resourceKey: row.course!.resourceKey,
          previewId: preview.id,
          clientRequestId: newRequestId(),
          ...(isIndividual
            ? {}
            : {
                scores: prepared.material.lesson!.scores,
                chapter: draft.editedChapter ?? prepared.material.lesson!.chapter,
              }),
        };
        const entry: RecoveryEntry = {
          ...input,
          action: 'SAVE',
          parentRequestId: isIndividual ? prepared.operation?.requestId : undefined,
          accountId: account.accountId,
          upstreamLoginId: current!.upstreamLoginId,
          round: row.round,
          checkDate: preview.checkDate,
        };
        track(entry);
        publish(row.key, { ...draft, state: 'busy', message: '正在提交' });
        update(`正在提交 ${row.name} · ${row.course!.courseName}`);
        try {
          touched = true;
          const response = await flow.save(input, current!.upstreamSessionToken);
          persist(response);
          if (['SAVED', 'VERIFIED'].includes(response.operation.state)) {
            forget([
              entry.clientRequestId,
              ...(entry.parentRequestId ? [entry.parentRequestId] : []),
            ]);
            publish(row.key, {
              state: 'saved',
              message: response.syncWarning ? `提交成功；${response.syncWarning}` : '提交成功',
              prepared,
              editedChapter: input.chapter,
            });
            success++;
          } else {
            publish(row.key, {
              ...draft,
              state: 'unknown',
              message: operationText(response.operation.state),
            });
            unknown++;
          }
        } catch (cause) {
          publish(row.key, {
            ...draft,
            state: 'unknown',
            message: '提交结果待确认，请同步数据',
          });
          unknown++;
          if (hasGraphQLCategory(cause, 'UNAUTHENTICATED')) throw cause;
        }
        done++;
        update('等待下一项');
        if (done < queue.length && !stop.current) await waitBetweenItems();
      }
    }
    update(stop.current ? '已停止后续处理' : '本次处理结束');
  } catch (cause) {
    setError(cause instanceof Error ? cause.message : '处理未完成，请同步数据');
    if (sameIdentity())
      setDrafts((old) =>
        Object.fromEntries(
          Object.entries(old).map(([key, draft]) => [
            key,
            draft.state === 'busy'
              ? {
                  ...draft,
                  state: (submit ? 'unknown' : 'error') as Draft['state'],
                  message: submit ? '提交结果待确认，请同步数据' : '准备失败，请同步数据',
                }
              : draft,
          ]),
        ),
      );
    update('已暂停，请同步数据');

    if (hasGraphQLCategory(cause, 'UNAUTHENTICATED'))
      controller.openLoginModalForExpiredSession({
        session: current!,
        loginError: '会话已失效，重新连接后请主动继续；不会自动提交。',
      });
  } finally {
    if (!submit && sameIdentity())
      setDrafts((old) =>
        Object.fromEntries(
          Object.entries(old).map(([key, draft]) => [
            key,
            draft.state === 'busy'
              ? { state: 'error' as const, message: '准备已停止或失败，请同步数据' }
              : draft,
          ]),
        ),
      );
    if (touched && alive.current && sameIdentity()) await reload();
    running.current = false;
    if (alive.current) {
      setBusy(false);
      setActivity(null);
      recoveries();
    }
  }
}
