export const THIRD_WORKSPACE_DEMO_SEARCH_PARAM = 'workspaceDemo';
export const THIRD_WORKSPACE_DEMO_TRIGGER = '跳层简报';

export type ThirdWorkspaceDemoArtifact = {
  id: string;
  title: string;
  summary: string;
  sections: string[];
};

export const THIRD_WORKSPACE_DEMO_ARTIFACTS: ThirdWorkspaceDemoArtifact[] = [
  {
    id: 'artifact-release-brief',
    title: '版本发布简报',
    summary: '把首页与入口协作层的当前变更整理成可快速浏览的发布摘要。',
    sections: [
      '主线 layout 已支持 sidecar 常驻、overlay root 和第三工作区挂载位。',
      '顶部控制层新增 omni 入口占位，后续可自然接入命令入口。',
      '第三工作区更适合承载超过 sidecar 有效阅读宽度的长结果物。',
    ],
  },
  {
    id: 'artifact-review-outline',
    title: '评审提纲草稿',
    summary: '模拟 Sidecar 里产出较长结构化内容后，跳到第三工作区继续审阅。',
    sections: [
      '先在侧栏内快速生成提纲，再把完整内容切到更宽的独立工作区。',
      '用户需要能明显感知“跳层”发生了，但主区与侧栏上下文仍保持连续。',
      '退出后应快速回到主链路，而不是像离开到另一个页面。',
    ],
  },
  {
    id: 'artifact-risk-map',
    title: '落地风险地图',
    summary: '把布局、焦点、状态同步和撤离路径拆成可评审的风险片段。',
    sections: [
      '第三工作区一旦持久存在，view state 需要从“sidecar 开关”升级到多工作区形态。',
      '跨层视觉提示应依赖 overlay root，而不是反向侵入业务 DOM。',
      '若结果物可编辑，必须明确保存边界与回写路径，避免 demo 误导成正式编辑器。',
    ],
  },
];

export function getThirdWorkspaceDemoArtifactById(id: string | null | undefined) {
  if (!id) {
    return null;
  }

  return THIRD_WORKSPACE_DEMO_ARTIFACTS.find((artifact) => artifact.id === id) ?? null;
}

export function readThirdWorkspaceDemoArtifactId(search: string) {
  return new URLSearchParams(search).get(THIRD_WORKSPACE_DEMO_SEARCH_PARAM);
}

export function withThirdWorkspaceDemo(search: string, artifactId: string | null) {
  const searchParams = new URLSearchParams(search);

  if (artifactId) {
    searchParams.set(THIRD_WORKSPACE_DEMO_SEARCH_PARAM, artifactId);
  } else {
    searchParams.delete(THIRD_WORKSPACE_DEMO_SEARCH_PARAM);
  }

  const nextSearch = searchParams.toString();
  return nextSearch ? `?${nextSearch}` : '';
}

export function resolveThirdWorkspaceDemoTrigger(query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return null;
  }

  if (
    normalizedQuery.includes(THIRD_WORKSPACE_DEMO_TRIGGER) ||
    normalizedQuery.includes('第三工作区') ||
    normalizedQuery.includes('artifacts canvas')
  ) {
    return THIRD_WORKSPACE_DEMO_ARTIFACTS[0] ?? null;
  }

  return null;
}
