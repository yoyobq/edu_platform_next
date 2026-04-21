import type { OperationVariables } from '@apollo/client';

import { executeGraphQL, isGraphQLIngressError } from '@/shared/graphql';

export const ACADEMIC_CALENDAR_EVENT_DAY_PERIODS = ['AFTERNOON', 'ALL_DAY', 'MORNING'] as const;
export const ACADEMIC_CALENDAR_EVENT_RECORD_STATUSES = ['ACTIVE', 'EXPIRED', 'TENTATIVE'] as const;
export const ACADEMIC_CALENDAR_EVENT_TYPES = [
  'ACTIVITY',
  'EXAM',
  'HOLIDAY',
  'HOLIDAY_MAKEUP',
  'SPORTS_MEET',
  'WEEKDAY_SWAP',
] as const;
export const ACADEMIC_CALENDAR_TEACHING_CALC_EFFECTS = [
  'CANCEL',
  'MAKEUP',
  'NO_CHANGE',
  'SWAP',
] as const;

export type AcademicCalendarEventDayPeriod = (typeof ACADEMIC_CALENDAR_EVENT_DAY_PERIODS)[number];
export type AcademicCalendarEventRecordStatus =
  (typeof ACADEMIC_CALENDAR_EVENT_RECORD_STATUSES)[number];
export type AcademicCalendarEventType = (typeof ACADEMIC_CALENDAR_EVENT_TYPES)[number];
export type AcademicCalendarTeachingCalcEffect =
  (typeof ACADEMIC_CALENDAR_TEACHING_CALC_EFFECTS)[number];

export type AcademicSemesterRecord = {
  createdAt: string;
  endDate: string;
  examStartDate: string;
  firstTeachingDate: string;
  id: number;
  isCurrent: boolean;
  name: string;
  schoolYear: number;
  startDate: string;
  termNumber: number;
  updatedAt: string;
};

export type AcademicCalendarEventRecord = {
  createdAt: string;
  dayPeriod: AcademicCalendarEventDayPeriod;
  eventDate: string;
  eventType: AcademicCalendarEventType;
  id: number;
  originalDate: string | null;
  recordStatus: AcademicCalendarEventRecordStatus;
  ruleNote: string | null;
  semesterId: number;
  teachingCalcEffect: AcademicCalendarTeachingCalcEffect;
  topic: string;
  updatedAt: string;
  updatedByAccountId: number | null;
  version: number;
};

export type ListAcademicSemestersInput = {
  isCurrent?: boolean;
  limit?: number;
  schoolYear?: number;
  termNumber?: number;
};

export type CreateAcademicSemesterInput = {
  endDate: string;
  examStartDate: string;
  firstTeachingDate: string;
  isCurrent: boolean;
  name: string;
  schoolYear: number;
  startDate: string;
  termNumber: number;
};

export type UpdateAcademicSemesterInput = Partial<CreateAcademicSemesterInput> & {
  id: number;
};

export type ListAcademicCalendarEventsInput = {
  eventDate?: string;
  eventType?: AcademicCalendarEventType;
  limit?: number;
  recordStatus?: AcademicCalendarEventRecordStatus;
  semesterId?: number;
};

export type CreateAcademicCalendarEventInput = {
  dayPeriod: AcademicCalendarEventDayPeriod;
  eventDate: string;
  eventType: AcademicCalendarEventType;
  originalDate?: string;
  recordStatus: AcademicCalendarEventRecordStatus;
  ruleNote?: string;
  semesterId: number;
  teachingCalcEffect: AcademicCalendarTeachingCalcEffect;
  topic: string;
  version: number;
};

export type UpdateAcademicCalendarEventInput = Partial<CreateAcademicCalendarEventInput> & {
  id: number;
};

const ACADEMIC_SEMESTER_FIELDS = `
  createdAt
  endDate
  examStartDate
  firstTeachingDate
  id
  isCurrent
  name
  schoolYear
  startDate
  termNumber
  updatedAt
`;

const ACADEMIC_CALENDAR_EVENT_FIELDS = `
  createdAt
  dayPeriod
  eventDate
  eventType
  id
  originalDate
  recordStatus
  ruleNote
  semesterId
  teachingCalcEffect
  topic
  updatedAt
  updatedByAccountId
  version
`;

const LIST_ACADEMIC_SEMESTERS_QUERY = `
  query AcademicSemesters($isCurrent: Boolean, $limit: Int, $schoolYear: Int, $termNumber: Int) {
    academicSemesters(
      isCurrent: $isCurrent
      limit: $limit
      schoolYear: $schoolYear
      termNumber: $termNumber
    ) {
      ${ACADEMIC_SEMESTER_FIELDS}
    }
  }
`;

const CREATE_ACADEMIC_SEMESTER_MUTATION = `
  mutation CreateAcademicSemester($input: CreateAcademicSemesterInput!) {
    createAcademicSemester(input: $input) {
      ${ACADEMIC_SEMESTER_FIELDS}
    }
  }
`;

const UPDATE_ACADEMIC_SEMESTER_MUTATION = `
  mutation UpdateAcademicSemester($input: UpdateAcademicSemesterInput!) {
    updateAcademicSemester(input: $input) {
      ${ACADEMIC_SEMESTER_FIELDS}
    }
  }
`;

const DELETE_ACADEMIC_SEMESTER_MUTATION = `
  mutation DeleteAcademicSemester($input: DeleteAcademicSemesterInput!) {
    deleteAcademicSemester(input: $input) {
      id
      success
    }
  }
`;

const LIST_ACADEMIC_CALENDAR_EVENTS_QUERY = `
  query AcademicCalendarEvents(
    $eventDate: String
    $eventType: AcademicCalendarEventType
    $limit: Int
    $recordStatus: AcademicCalendarEventRecordStatus
    $semesterId: Int
  ) {
    academicCalendarEvents(
      eventDate: $eventDate
      eventType: $eventType
      limit: $limit
      recordStatus: $recordStatus
      semesterId: $semesterId
    ) {
      ${ACADEMIC_CALENDAR_EVENT_FIELDS}
    }
  }
`;

const CREATE_ACADEMIC_CALENDAR_EVENT_MUTATION = `
  mutation CreateAcademicCalendarEvent($input: CreateAcademicCalendarEventInput!) {
    createAcademicCalendarEvent(input: $input) {
      ${ACADEMIC_CALENDAR_EVENT_FIELDS}
    }
  }
`;

const UPDATE_ACADEMIC_CALENDAR_EVENT_MUTATION = `
  mutation UpdateAcademicCalendarEvent($input: UpdateAcademicCalendarEventInput!) {
    updateAcademicCalendarEvent(input: $input) {
      ${ACADEMIC_CALENDAR_EVENT_FIELDS}
    }
  }
`;

const DELETE_ACADEMIC_CALENDAR_EVENT_MUTATION = `
  mutation DeleteAcademicCalendarEvent($input: DeleteAcademicCalendarEventInput!) {
    deleteAcademicCalendarEvent(input: $input) {
      id
      success
    }
  }
`;

async function requestGraphQL<TData, TVariables extends OperationVariables>(
  query: string,
  variables: TVariables,
): Promise<TData> {
  return executeGraphQL(query, variables);
}

function resolveErrorMessage(error: unknown, fallback: string) {
  if (isGraphQLIngressError(error)) {
    const firstError = error.graphqlErrors?.[0];
    const extensions = (firstError?.extensions as Record<string, unknown> | undefined) || {};

    if (typeof extensions.errorMessage === 'string') {
      return extensions.errorMessage;
    }

    return error.userMessage;
  }

  return error instanceof Error ? error.message : fallback;
}

export async function listAcademicSemesters(input: ListAcademicSemestersInput = {}) {
  try {
    const response = await requestGraphQL<
      {
        academicSemesters: AcademicSemesterRecord[];
      },
      ListAcademicSemestersInput
    >(LIST_ACADEMIC_SEMESTERS_QUERY, input);

    return response.academicSemesters;
  } catch (error) {
    throw new Error(resolveErrorMessage(error, '暂时无法加载学期列表。'));
  }
}

export async function createAcademicSemester(input: CreateAcademicSemesterInput) {
  try {
    const response = await requestGraphQL<
      {
        createAcademicSemester: AcademicSemesterRecord;
      },
      { input: CreateAcademicSemesterInput }
    >(CREATE_ACADEMIC_SEMESTER_MUTATION, { input });

    return response.createAcademicSemester;
  } catch (error) {
    throw new Error(resolveErrorMessage(error, '暂时无法创建学期。'));
  }
}

export async function updateAcademicSemester(input: UpdateAcademicSemesterInput) {
  try {
    const response = await requestGraphQL<
      {
        updateAcademicSemester: AcademicSemesterRecord;
      },
      { input: UpdateAcademicSemesterInput }
    >(UPDATE_ACADEMIC_SEMESTER_MUTATION, { input });

    return response.updateAcademicSemester;
  } catch (error) {
    throw new Error(resolveErrorMessage(error, '暂时无法更新学期。'));
  }
}

export async function deleteAcademicSemester(input: { id: number }) {
  try {
    const response = await requestGraphQL<
      {
        deleteAcademicSemester: {
          id: number;
          success: boolean;
        };
      },
      { input: { id: number } }
    >(DELETE_ACADEMIC_SEMESTER_MUTATION, { input });

    if (!response.deleteAcademicSemester.success) {
      throw new Error('学期删除失败。');
    }

    return response.deleteAcademicSemester;
  } catch (error) {
    throw new Error(resolveErrorMessage(error, '暂时无法删除学期。'));
  }
}

export async function listAcademicCalendarEvents(input: ListAcademicCalendarEventsInput = {}) {
  try {
    const response = await requestGraphQL<
      {
        academicCalendarEvents: AcademicCalendarEventRecord[];
      },
      ListAcademicCalendarEventsInput
    >(LIST_ACADEMIC_CALENDAR_EVENTS_QUERY, input);

    return response.academicCalendarEvents;
  } catch (error) {
    throw new Error(resolveErrorMessage(error, '暂时无法加载校历事件列表。'));
  }
}

export async function createAcademicCalendarEvent(input: CreateAcademicCalendarEventInput) {
  try {
    const response = await requestGraphQL<
      {
        createAcademicCalendarEvent: AcademicCalendarEventRecord;
      },
      { input: CreateAcademicCalendarEventInput }
    >(CREATE_ACADEMIC_CALENDAR_EVENT_MUTATION, { input });

    return response.createAcademicCalendarEvent;
  } catch (error) {
    throw new Error(resolveErrorMessage(error, '暂时无法创建校历事件。'));
  }
}

export async function updateAcademicCalendarEvent(input: UpdateAcademicCalendarEventInput) {
  try {
    const response = await requestGraphQL<
      {
        updateAcademicCalendarEvent: AcademicCalendarEventRecord;
      },
      { input: UpdateAcademicCalendarEventInput }
    >(UPDATE_ACADEMIC_CALENDAR_EVENT_MUTATION, { input });

    return response.updateAcademicCalendarEvent;
  } catch (error) {
    throw new Error(resolveErrorMessage(error, '暂时无法更新校历事件。'));
  }
}

export async function deleteAcademicCalendarEvent(input: { id: number }) {
  try {
    const response = await requestGraphQL<
      {
        deleteAcademicCalendarEvent: {
          id: number;
          success: boolean;
        };
      },
      { input: { id: number } }
    >(DELETE_ACADEMIC_CALENDAR_EVENT_MUTATION, { input });

    if (!response.deleteAcademicCalendarEvent.success) {
      throw new Error('校历事件删除失败。');
    }

    return response.deleteAcademicCalendarEvent;
  } catch (error) {
    throw new Error(resolveErrorMessage(error, '暂时无法删除校历事件。'));
  }
}
