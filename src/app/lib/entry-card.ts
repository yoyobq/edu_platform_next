// src/app/lib/entry-card.ts

export type EntryCard = {
  id: string;
  title: string;
  description?: string;
  to: string;
  kind: 'route';
};
