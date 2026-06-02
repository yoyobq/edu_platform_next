// src/app/lib/local-entry-catalog.ts

import { getNavigationLeafItems, type NavigationFilter } from '@/app/navigation';

import { withWorkbenchSearch } from '@/shared/third-workspace-demo';

import type { EntryCard } from './entry-card';

type LocalEntryCatalogItem = EntryCard & {
  keywords: string[];
};

type LocalEntryContext = NavigationFilter & {
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
  return getNavigationLeafItems(context)
    .filter((item) => item.localEntry)
    .map((item) => ({
      id: `route-${item.key.replaceAll('/', '-').replace(/^-+/, '')}`,
      title: item.label,
      description: item.localEntry?.description,
      to: withSearch(item.path, context.search),
      kind: 'route' as const,
      keywords: [...(item.localEntry?.keywords ?? [])],
    }));
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
