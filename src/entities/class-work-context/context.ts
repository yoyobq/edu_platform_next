// src/entities/class-work-context/context.ts
import { createContext, useContext } from 'react';
export type ClassWorkScope = {
  classId?: string;
  semesterId?: number;
  studentId?: string;
  commentKind?: 'TERM' | 'GRADUATION';
  inspect?: boolean;
};
export type ClassWorkOption = { id: string; className: string; classCode: string };
export type ClassGovernanceTarget = 'profile' | 'conduct' | 'results' | 'comments';
export type ClassWorkContextValue = {
  ready: boolean;
  entryKey: string;
  scope: ClassWorkScope;
  workClass: ClassWorkOption | null;
  options: readonly ClassWorkOption[];
  loading: boolean;
  error: string | null;
  notice: string | null;
  retry: () => void;
  changeWorkClass: (id: string) => void;
  returnToWorkClass: () => void;
  returnToInspection: (() => void) | null;
  buildGovernancePath: (target: ClassGovernanceTarget, scope: ClassWorkScope) => string;
};

export const ClassWorkContext = createContext<ClassWorkContextValue | null>(null);
export function useClassWorkContext() {
  return useContext(ClassWorkContext);
}
