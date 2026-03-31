export type HomeModuleSummaryTone = 'default' | 'success' | 'warning' | 'danger';

export type HomeModuleAction = {
  id: string;
  label: string;
  kind: 'navigate' | 'trigger';
  disabled?: boolean;
  loading?: boolean;
  reason?: string;
  to?: string;
};

export type HomeModuleEntry = {
  primaryAction: HomeModuleAction;
  secondaryActions?: readonly HomeModuleAction[];
};

export type HomeModuleSummaryItem = {
  label: string;
  value: string;
  tone?: HomeModuleSummaryTone;
};

export type HomeModuleBadge = {
  text: string;
  tone?: HomeModuleSummaryTone;
};

export type HomeModuleSummary = {
  headline: string;
  items?: readonly HomeModuleSummaryItem[];
  badges?: readonly HomeModuleBadge[];
  updatedAt?: string | null;
};

export type HomeModuleEmptyState = {
  title: string;
  description: string;
  action?: HomeModuleAction;
};

export type HomeModuleErrorState = {
  title: string;
  description: string;
  severity?: 'warning' | 'error';
  action?: HomeModuleAction;
};

export type HomeModuleState =
  | {
      kind: 'ready';
      summary: HomeModuleSummary;
      isRefetching?: boolean;
    }
  | {
      kind: 'empty';
      empty: HomeModuleEmptyState;
    }
  | {
      kind: 'error';
      error: HomeModuleErrorState;
    };

export type HomeModuleHiddenReason = 'forbidden' | 'not-configured' | 'env-blocked';
export type HomeModuleVisibleReason = 'allowed';

export type HomeModuleVisibility =
  | {
      visible: false;
      reason: HomeModuleHiddenReason;
    }
  | {
      visible: true;
      reason: HomeModuleVisibleReason;
    };

export type HomeModuleBase = {
  id: string;
  title: string;
  intent: string;
};

export type HiddenHomeModuleContract = HomeModuleBase & {
  visibility: {
    visible: false;
    reason: HomeModuleHiddenReason;
  };
};

export type VisibleHomeModuleContract = HomeModuleBase & {
  visibility: {
    visible: true;
    reason: HomeModuleVisibleReason;
  };
  state: HomeModuleState;
  entry: HomeModuleEntry;
};

export type HomeModuleContract = HiddenHomeModuleContract | VisibleHomeModuleContract;
