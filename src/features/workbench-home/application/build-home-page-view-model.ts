import type { HomeModuleContract, HomePageViewModel } from '@/shared/home-modules';

export const OPEN_ENTRY_SIDECAR_ACTION_ID = 'workbench-home.open-entry-sidecar';

type HomePageSessionContext = {
  accessGroup?: readonly string[] | null;
  displayName?: string | null;
  role?: string | null;
};

type WorkbenchTemplateKey = 'admin-default' | 'member-default' | 'minimal-default';

const ADMIN_IDENTITIES = ['ADMIN', 'MANAGER', 'STAFF', 'COACH'] as const;
const MEMBER_IDENTITIES = ['CUSTOMER', 'LEARNER', 'STUDENT', 'REGISTRANT'] as const;

function normalizeIdentities(session: HomePageSessionContext) {
  return Array.from(
    new Set(
      [session.role, ...(session.accessGroup ?? [])]
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .map((value) => value.toUpperCase()),
    ),
  );
}

function hasAnyIdentity(identities: readonly string[], candidates: readonly string[]) {
  return candidates.some((candidate) => identities.includes(candidate));
}

function resolveTemplateKey(session: HomePageSessionContext): WorkbenchTemplateKey {
  const identities = normalizeIdentities(session);

  if (hasAnyIdentity(identities, ADMIN_IDENTITIES)) {
    return 'admin-default';
  }

  if (hasAnyIdentity(identities, MEMBER_IDENTITIES)) {
    return 'member-default';
  }

  return 'minimal-default';
}

function getTemplateMeta(templateKey: WorkbenchTemplateKey) {
  switch (templateKey) {
    case 'admin-default':
      return {
        description: '先给出系统状态、稳定入口与回访占位，避免管理视角继续借用 demo 首页语义。',
        label: '管理默认模板',
      };
    case 'member-default':
      return {
        description: '先给出当前状态、下一步入口与最近上下文占位，保持成员视角的默认工作台闭环。',
        label: '成员默认模板',
      };
    default:
      return {
        description: '在没有角色模板与个人偏好时，先用最小默认组合保证首页不失语。',
        label: '最小默认模板',
      };
  }
}

function createPrimaryEntryModule(
  session: HomePageSessionContext,
  templateKey: WorkbenchTemplateKey,
): HomeModuleContract {
  const roleLabel = session.role?.toUpperCase() ?? 'GUEST';
  const accessGroupLabel =
    session.accessGroup && session.accessGroup.length > 0
      ? session.accessGroup.join(', ')
      : '未配置';
  const headline =
    templateKey === 'admin-default'
      ? '当前工作台先保持“状态确认 + 受控入口”组合。'
      : templateKey === 'member-default'
        ? '当前工作台先保持“状态确认 + 下一步入口”组合。'
        : '当前工作台先保持最小兜底组合。';

  return {
    id: 'primary-entry-shortcuts',
    title: '主动作入口',
    intent: '给出当前默认工作台里最稳定的下一步，而不是把试验能力塞回首页。',
    visibility: {
      visible: true,
      reason: 'allowed',
    },
    state: {
      kind: 'ready',
      summary: {
        headline,
        items: [
          {
            label: '当前角色',
            value: roleLabel,
          },
          {
            label: '访问组',
            value: accessGroupLabel,
          },
          {
            label: '默认动作',
            value: '打开开始入口',
          },
        ],
        badges: [
          {
            text:
              templateKey === 'admin-default'
                ? '管理视角'
                : templateKey === 'member-default'
                  ? '成员视角'
                  : '通用兜底',
            tone: 'success',
          },
        ],
      },
    },
    entry: {
      primaryAction: {
        id: OPEN_ENTRY_SIDECAR_ACTION_ID,
        label: '打开开始入口',
        kind: 'trigger',
      },
    },
  };
}

function createRecentContextModule(session: HomePageSessionContext): HomeModuleContract {
  const displayName = session.displayName?.trim() || '当前账号';

  return {
    id: 'recent-context',
    title: '最近上下文',
    intent: '承接登录后回到点；在真实上下文接入前，先稳定表达空态与后续去向。',
    visibility: {
      visible: true,
      reason: 'allowed',
    },
    state: {
      kind: 'empty',
      empty: {
        title: '当前还没有最近上下文',
        description: `${displayName} 之后完成一次进入、查询或正式流程回访后，这里会收束成你的最近上下文。`,
        action: {
          id: OPEN_ENTRY_SIDECAR_ACTION_ID,
          label: '从开始入口继续',
          kind: 'trigger',
        },
      },
    },
    entry: {
      primaryAction: {
        id: OPEN_ENTRY_SIDECAR_ACTION_ID,
        label: '从开始入口继续',
        kind: 'trigger',
      },
    },
  };
}

type BuildHomePageViewModelInput = {
  session: HomePageSessionContext;
  statusOverviewModule: HomeModuleContract;
};

export function buildHomePageViewModel({
  session,
  statusOverviewModule,
}: BuildHomePageViewModelInput): HomePageViewModel {
  const templateKey = resolveTemplateKey(session);
  const templateMeta = getTemplateMeta(templateKey);

  return {
    templateDescription: templateMeta.description,
    templateKey,
    templateLabel: templateMeta.label,
    modules: [
      statusOverviewModule,
      createPrimaryEntryModule(session, templateKey),
      createRecentContextModule(session),
    ],
  };
}
