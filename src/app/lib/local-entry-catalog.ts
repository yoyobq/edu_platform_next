// src/app/lib/local-entry-catalog.ts

import { withWorkbenchSearch } from '@/shared/third-workspace-demo';

import type { EntryCard } from './entry-card';

type AppEnv = 'dev' | 'test' | 'prod';
type AppAccessLevel = 'guest' | 'admin';

type LocalEntryCatalogItem = EntryCard & {
  keywords: string[];
};

type LocalEntryContext = {
  accessLevel: AppAccessLevel;
  appEnv: AppEnv;
  search: string;
};

function withSearch(pathname: string, search: string): string {
  return withWorkbenchSearch(pathname, search);
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function scoreEntry(query: string, entry: LocalEntryCatalogItem): number {
  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery) {
    return 0;
  }

  const candidates = [entry.title, entry.description || '', ...entry.keywords].map(normalizeText);
  let score = 0;

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    if (candidate === normalizedQuery) {
      score += 12;
      continue;
    }

    if (candidate.includes(normalizedQuery)) {
      score += 6;
      continue;
    }

    if (normalizedQuery.includes(candidate)) {
      score += 3;
    }
  }

  return score;
}

export function getAvailableLocalEntryCards(context: LocalEntryContext): LocalEntryCatalogItem[] {
  const cards: LocalEntryCatalogItem[] = [
    {
      id: 'route-home',
      title: '首页',
      description: '返回当前默认工作台首页，查看状态概览、主动作入口与最近上下文。',
      to: withSearch('/', context.search),
      kind: 'route',
      keywords: ['home', 'index', '默认工作台', '状态概览', '首页'],
    },
  ];

  if (context.appEnv === 'dev' || context.appEnv === 'test') {
    cards.push({
      id: 'route-sandbox-playground',
      title: 'Sandbox 演练场',
      description: '进入自由原型试验区，适合快速试错和页面试玩。',
      to: withSearch('/sandbox/playground', context.search),
      kind: 'route',
      keywords: ['sandbox', '演练场', '原型', '试玩', '试验区', '沙盒'],
    });
  }

  return cards;
}

export function matchLocalEntryCards(query: string, cards: LocalEntryCatalogItem[]): EntryCard[] {
  return cards
    .map((card) => ({
      card,
      score: scoreEntry(query, card),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .map((item) => item.card);
}

export function buildLocalEntryReply(query: string, cards: EntryCard[]): string {
  if (cards.length === 0) {
    return `暂时没有找到和“${query.trim()}”直接匹配的入口。你可以换一个页面名称，或描述得更具体一点。`;
  }

  if (cards.length === 1) {
    return `先帮你找到 1 个和“${query.trim()}”相关的入口，确认后即可进入。`;
  }

  return `先帮你找到 ${cards.length} 个和“${query.trim()}”相关的入口，你可以先选一个继续进入。`;
}
