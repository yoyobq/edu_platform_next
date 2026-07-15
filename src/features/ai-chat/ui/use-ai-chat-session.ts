// src/features/ai-chat/ui/use-ai-chat-session.ts

import { useEffect, useRef, useSyncExternalStore } from 'react';

import type { AiChatSessionController } from '../application/session-controller';

type CreateAiChatSessionController = () => AiChatSessionController;

export function createUseAiChatSession(createController: CreateAiChatSessionController) {
  return function useAiChatSession(input: { accountId?: number; enabled: boolean }) {
    const { accountId, enabled } = input;
    const controllerRef = useRef<AiChatSessionController | null>(null);

    if (!controllerRef.current) {
      controllerRef.current = createController();
    }

    const controller = controllerRef.current;
    const state = useSyncExternalStore(
      controller.subscribe,
      controller.getState,
      controller.getState,
    );

    useEffect(() => {
      controller.configure({ accountId, enabled });

      return () => controller.configure({ enabled: false });
    }, [accountId, controller, enabled]);

    useEffect(() => {
      const updateForegroundState = () => {
        controller.setForeground(document.visibilityState !== 'hidden');
      };

      updateForegroundState();
      document.addEventListener('visibilitychange', updateForegroundState);

      return () => {
        document.removeEventListener('visibilitychange', updateForegroundState);
      };
    }, [controller]);

    return { reset: controller.reset, state, submit: controller.submit };
  };
}
