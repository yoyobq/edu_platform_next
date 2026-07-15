// src/features/ai-chat/application/session-controller.ts

import type { AiChatGateway, AiChatPendingTurnStore, AiChatSessionRuntime } from './ports';
import {
  type AiChatSessionAction,
  INITIAL_AI_CHAT_SESSION_STATE,
  reduceAiChatSessionState,
} from './session-state';
import type {
  AiChatSessionMessage,
  AiChatSessionState,
  AiChatTurnStatus,
  PendingAiChatAdmissionTurn,
  PendingAiChatTurn,
  PendingAiChatWorkflowTurn,
} from './types';
import {
  AI_CHAT_INPUT_MAX_LENGTH,
  resolveAiChatAdmissionPresentation,
  resolveAiChatPollDelay,
  resolveAiChatRequestErrorMessage,
  resolveAiChatRetryDelay,
  resolveAiChatWorkflowPresentation,
  shouldRetryAiChatAdmission,
  shouldRetryAiChatQuery,
} from './workflow';

type AiChatSessionControllerDependencies = {
  gateway: AiChatGateway;
  pendingTurnStore: AiChatPendingTurnStore;
  runtime: AiChatSessionRuntime;
};

type AiChatSessionConfiguration = {
  accountId?: number;
  enabled: boolean;
};

type AiChatSessionListener = () => void;

export class AiChatSessionController {
  private accountId: number | null = null;
  private enabled = false;
  private foreground = true;
  private requestInFlight = false;
  private operationVersion = 0;
  private pendingTurn: PendingAiChatTurn | null = null;
  private state = INITIAL_AI_CHAT_SESSION_STATE;
  private cancelScheduledOperation: (() => void) | null = null;
  private readonly listeners = new Set<AiChatSessionListener>();

  constructor(private readonly dependencies: AiChatSessionControllerDependencies) {}

  readonly getState = (): AiChatSessionState => this.state;

  readonly subscribe = (listener: AiChatSessionListener): (() => void) => {
    this.listeners.add(listener);

    return () => this.listeners.delete(listener);
  };

  configure(input: AiChatSessionConfiguration): void {
    const nextAccountId = input.accountId ?? null;

    if (this.accountId === nextAccountId && this.enabled === input.enabled) {
      return;
    }

    this.stopOperations();
    this.accountId = nextAccountId;
    this.enabled = input.enabled;
    this.apply({ type: 'reset' });

    if (!this.enabled || this.accountId === null) {
      return;
    }

    const pendingTurn = this.dependencies.pendingTurnStore.load(this.accountId);

    if (!pendingTurn) {
      return;
    }

    this.pendingTurn = pendingTurn;
    this.apply({ type: 'recover', payload: pendingTurn });
    this.continuePendingTurn(pendingTurn, this.operationVersion);
  }

  setForeground(foreground: boolean): void {
    if (this.foreground === foreground) {
      return;
    }

    this.foreground = foreground;

    if (!foreground) {
      this.clearScheduledOperation();
      return;
    }

    const pendingTurn = this.pendingTurn;

    if (pendingTurn && !this.requestInFlight) {
      this.continuePendingTurn(pendingTurn, this.operationVersion);
    }
  }

  readonly submit = (message: string): boolean => {
    const trimmedMessage = message.trim();

    if (
      !this.enabled ||
      this.accountId === null ||
      !trimmedMessage ||
      this.pendingTurn !== null ||
      this.requestInFlight
    ) {
      return false;
    }

    if (trimmedMessage.length > AI_CHAT_INPUT_MAX_LENGTH) {
      this.apply({
        type: 'reject-input',
        payload: {
          assistantMessageId: this.dependencies.runtime.createId('assistant'),
          content: '单条消息不能超过 12000 个字符。',
        },
      });
      return false;
    }

    const pendingTurn: PendingAiChatAdmissionTurn = {
      accountId: this.accountId,
      assistantMessageId: this.dependencies.runtime.createId('assistant'),
      phase: 'admission',
      requestId: this.dependencies.runtime.createId('request'),
      startedAt: this.dependencies.runtime.now(),
      traceId: this.dependencies.runtime.createId('trace'),
      userMessage: trimmedMessage,
      userMessageId: this.dependencies.runtime.createId('user'),
    };

    this.pendingTurn = pendingTurn;
    this.dependencies.pendingTurnStore.save(pendingTurn);
    this.apply({
      type: 'start',
      payload: {
        assistantMessageId: pendingTurn.assistantMessageId,
        message: pendingTurn.userMessage,
        userMessageId: pendingTurn.userMessageId,
      },
    });
    this.continuePendingTurn(pendingTurn, this.operationVersion);

    return true;
  };

  readonly reset = (): void => {
    const accountId = this.accountId;

    this.stopOperations();
    if (accountId !== null) {
      this.dependencies.pendingTurnStore.clear(accountId);
    }
    this.apply({ type: 'reset' });
  };

  private stopOperations(): void {
    this.operationVersion += 1;
    this.clearScheduledOperation();
    this.pendingTurn = null;
    this.requestInFlight = false;
  }

  private clearScheduledOperation(): void {
    this.cancelScheduledOperation?.();
    this.cancelScheduledOperation = null;
  }

  private continuePendingTurn(turn: PendingAiChatTurn, version: number): void {
    if (!this.foreground || this.requestInFlight || !this.isCurrent(turn, version)) {
      return;
    }

    if (turn.phase === 'admission') {
      void this.admitTurn(turn, version);
      return;
    }

    void this.pollTurn(turn, version);
  }

  private async admitTurn(turn: PendingAiChatAdmissionTurn, version: number): Promise<void> {
    this.requestInFlight = true;

    try {
      const result = await this.dependencies.gateway.queueTurn({
        message: turn.userMessage,
        requestId: turn.requestId,
        traceId: turn.traceId,
      });

      if (!this.isCurrent(turn, version)) {
        return;
      }

      this.requestInFlight = false;
      const presentation = resolveAiChatAdmissionPresentation(result);

      if (presentation.terminal) {
        this.finishTurn(turn, presentation.content, presentation.status, version);
        return;
      }

      const workflowTurn: PendingAiChatWorkflowTurn = {
        accountId: turn.accountId,
        assistantMessageId: turn.assistantMessageId,
        phase: 'workflow',
        startedAt: turn.startedAt,
        userMessage: turn.userMessage,
        userMessageId: turn.userMessageId,
        workflowId: result.workflowId,
      };

      this.pendingTurn = workflowTurn;
      this.dependencies.pendingTurnStore.save(workflowTurn);
      this.updateAssistant(
        workflowTurn.assistantMessageId,
        presentation.content,
        'loading',
        presentation.status,
      );
      this.continuePendingTurn(workflowTurn, version);
    } catch (error) {
      if (!this.isCurrent(turn, version)) {
        return;
      }

      this.requestInFlight = false;
      if (shouldRetryAiChatAdmission(error)) {
        this.updateAssistant(
          turn.assistantMessageId,
          '提交响应暂时中断，正在使用同一请求标识确认任务，避免重复创建。',
          'loading',
          'waiting_for_service',
        );
        this.scheduleRetry(turn, version);
        return;
      }

      this.finishTurn(turn, resolveAiChatRequestErrorMessage(error), 'failed', version);
    }
  }

  private async pollTurn(turn: PendingAiChatWorkflowTurn, version: number): Promise<void> {
    this.requestInFlight = true;

    try {
      const result = await this.dependencies.gateway.queryTurn(turn.workflowId);

      if (!this.isCurrent(turn, version)) {
        return;
      }

      this.requestInFlight = false;
      if (!result) {
        this.finishTurn(
          turn,
          '没有找到这次 AI 任务，任务可能已过期，请重新发送。',
          'failed',
          version,
        );
        return;
      }

      const presentation = resolveAiChatWorkflowPresentation(result);

      if (presentation.terminal) {
        this.finishTurn(turn, presentation.content, presentation.status, version);
        return;
      }

      this.updateAssistant(
        turn.assistantMessageId,
        presentation.content,
        'loading',
        presentation.status,
      );
      this.schedulePendingTurn(
        turn,
        version,
        resolveAiChatPollDelay({
          elapsedMs: this.dependencies.runtime.now() - turn.startedAt,
          status: presentation.status,
        }),
      );
    } catch (error) {
      if (!this.isCurrent(turn, version)) {
        return;
      }

      this.requestInFlight = false;
      if (shouldRetryAiChatQuery(error)) {
        this.updateAssistant(
          turn.assistantMessageId,
          '状态查询暂时中断，任务仍可能在后台运行，正在继续查询。',
          'loading',
          'waiting_for_service',
        );
        this.scheduleRetry(turn, version);
        return;
      }

      this.clearScheduledOperation();
      this.updateAssistant(
        turn.assistantMessageId,
        `${resolveAiChatRequestErrorMessage(error)} ` +
          '已保留任务恢复信息，可刷新页面后重试查询，或停止等待。',
        'loading',
        'waiting_for_service',
      );
    }
  }

  private scheduleRetry(turn: PendingAiChatTurn, version: number): void {
    this.schedulePendingTurn(
      turn,
      version,
      resolveAiChatRetryDelay({
        elapsedMs: this.dependencies.runtime.now() - turn.startedAt,
        randomValue: this.dependencies.runtime.random(),
      }),
    );
  }

  private schedulePendingTurn(turn: PendingAiChatTurn, version: number, delayMs: number): void {
    this.clearScheduledOperation();

    if (!this.foreground) {
      return;
    }

    this.cancelScheduledOperation = this.dependencies.runtime.schedule(() => {
      this.cancelScheduledOperation = null;
      this.continuePendingTurn(turn, version);
    }, delayMs);
  }

  private finishTurn(
    turn: PendingAiChatTurn,
    content: string,
    status: AiChatTurnStatus,
    version: number,
  ): void {
    if (!this.isCurrent(turn, version)) {
      return;
    }

    this.updateAssistant(
      turn.assistantMessageId,
      content,
      status === 'completed' ? 'ready' : 'error',
      status,
    );
    this.dependencies.pendingTurnStore.clear(turn.accountId);
    this.clearScheduledOperation();
    this.pendingTurn = null;
    this.requestInFlight = false;
  }

  private updateAssistant(
    assistantMessageId: string,
    content: string,
    sessionStatus: AiChatSessionState['status'],
    turnStatus: NonNullable<AiChatSessionMessage['status']>,
  ): void {
    this.apply({
      type: 'update',
      payload: { assistantMessageId, content, sessionStatus, turnStatus },
    });
  }

  private isCurrent(turn: PendingAiChatTurn, version: number): boolean {
    return this.operationVersion === version && this.pendingTurn === turn;
  }

  private apply(action: AiChatSessionAction): void {
    const nextState = reduceAiChatSessionState(this.state, action);

    if (nextState === this.state) {
      return;
    }

    this.state = nextState;
    for (const listener of this.listeners) {
      listener();
    }
  }
}
