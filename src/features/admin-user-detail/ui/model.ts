import type { ReactNode } from 'react';

export type EditableSectionKey = 'account' | 'staff' | 'userInfo';

export type DetailItem = {
  key: string;
  label: ReactNode;
  value: ReactNode;
};

export type DetailSection = {
  items: readonly DetailItem[];
  key: string;
  tone: 'editable' | 'fixed' | 'reference';
};

export type DetailSectionGroup = {
  editable: DetailSection;
  fixed: DetailSection;
  reference: DetailSection;
};

export type SectionErrorState = Record<EditableSectionKey, string | null>;

export const INITIAL_SECTION_ERROR_STATE: SectionErrorState = {
  account: null,
  staff: null,
  userInfo: null,
};
