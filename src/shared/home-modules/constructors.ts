import type {
  HiddenHomeModuleContract,
  HomeModuleBase,
  HomeModuleEntry,
  HomeModuleHiddenReason,
  HomeModuleState,
  VisibleHomeModuleContract,
} from './contract';

type VisibleHomeModuleInput = HomeModuleBase & {
  entry: HomeModuleEntry;
  state: HomeModuleState;
};

type HiddenHomeModuleInput = HomeModuleBase & {
  reason: HomeModuleHiddenReason;
};

export function createVisibleHomeModule(input: VisibleHomeModuleInput): VisibleHomeModuleContract {
  return {
    ...input,
    visibility: {
      visible: true,
      reason: 'allowed',
    },
  };
}

export function createHiddenHomeModule(input: HiddenHomeModuleInput): HiddenHomeModuleContract {
  return {
    id: input.id,
    intent: input.intent,
    title: input.title,
    visibility: {
      visible: false,
      reason: input.reason,
    },
  };
}
