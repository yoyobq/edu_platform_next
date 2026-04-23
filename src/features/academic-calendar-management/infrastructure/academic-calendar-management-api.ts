import type { OperationVariables } from '@apollo/client';

import {
  requestAcademicSemesters as requestSharedAcademicSemesters,
  type SharedAcademicSemesterRecord,
} from '@/shared/graphql';
import { executeGraphQL, isGraphQLIngressError } from '@/shared/graphql';

import type {
  AcademicCalendarEventRecord,
  AcademicSemesterRecord,
  CreateAcademicCalendarEventInput,
  CreateAcademicSemesterInput,
  ListAcademicCalendarEventsInput,
  ListAcademicSemestersInput,
  UpdateAcademicCalendarEventInput,
  UpdateAcademicSemesterInput,
} from '../application/types';

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

type AcademicSemesterDTO = SharedAcademicSemesterRecord;
type AcademicCalendarEventDTO = AcademicCalendarEventRecord;

async function requestGraphQL<TData, TVariables extends OperationVariables>(
  query: string,
  variables: TVariables,
): Promise<TData> {
  return executeGraphQL(query, variables);
}

function mapAcademicSemesterRecord(record: AcademicSemesterDTO): AcademicSemesterRecord {
  return {
    createdAt: record.createdAt,
    endDate: record.endDate,
    examStartDate: record.examStartDate,
    firstTeachingDate: record.firstTeachingDate,
    id: record.id,
    isCurrent: record.isCurrent,
    name: record.name,
    schoolYear: record.schoolYear,
    startDate: record.startDate,
    termNumber: record.termNumber,
    updatedAt: record.updatedAt,
  };
}

function mapAcademicCalendarEventRecord(
  record: AcademicCalendarEventDTO,
): AcademicCalendarEventRecord {
  return {
    createdAt: record.createdAt,
    dayPeriod: record.dayPeriod,
    eventDate: record.eventDate,
    eventType: record.eventType,
    id: record.id,
    originalDate: record.originalDate,
    recordStatus: record.recordStatus,
    ruleNote: record.ruleNote,
    semesterId: record.semesterId,
    teachingCalcEffect: record.teachingCalcEffect,
    topic: record.topic,
    updatedAt: record.updatedAt,
    updatedByAccountId: record.updatedByAccountId,
    version: record.version,
  };
}

function resolveAcademicCalendarErrorMessage(error: unknown, fallback: string) {
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

export async function requestAcademicSemesters(input: ListAcademicSemestersInput = {}) {
  try {
    const response = await requestSharedAcademicSemesters(input);

    return response.map(mapAcademicSemesterRecord);
  } catch (error) {
    throw new Error(resolveAcademicCalendarErrorMessage(error, '暂时无法加载学期列表。'));
  }
}

export async function requestAcademicSemesterCreate(input: CreateAcademicSemesterInput) {
  try {
    const response = await requestGraphQL<
      { createAcademicSemester: AcademicSemesterDTO },
      { input: CreateAcademicSemesterInput }
    >(CREATE_ACADEMIC_SEMESTER_MUTATION, { input });

    return mapAcademicSemesterRecord(response.createAcademicSemester);
  } catch (error) {
    throw new Error(resolveAcademicCalendarErrorMessage(error, '暂时无法创建学期。'));
  }
}

export async function requestAcademicSemesterUpdate(input: UpdateAcademicSemesterInput) {
  try {
    const response = await requestGraphQL<
      { updateAcademicSemester: AcademicSemesterDTO },
      { input: UpdateAcademicSemesterInput }
    >(UPDATE_ACADEMIC_SEMESTER_MUTATION, { input });

    return mapAcademicSemesterRecord(response.updateAcademicSemester);
  } catch (error) {
    throw new Error(resolveAcademicCalendarErrorMessage(error, '暂时无法更新学期。'));
  }
}

export async function requestAcademicSemesterDelete(input: { id: number }) {
  try {
    const response = await requestGraphQL<
      { deleteAcademicSemester: { id: number; success: boolean } },
      { input: { id: number } }
    >(DELETE_ACADEMIC_SEMESTER_MUTATION, { input });

    if (!response.deleteAcademicSemester.success) {
      throw new Error('学期删除失败。');
    }

    return response.deleteAcademicSemester;
  } catch (error) {
    throw new Error(resolveAcademicCalendarErrorMessage(error, '暂时无法删除学期。'));
  }
}

export async function requestAcademicCalendarEvents(input: ListAcademicCalendarEventsInput = {}) {
  try {
    const response = await requestGraphQL<
      { academicCalendarEvents: AcademicCalendarEventDTO[] },
      ListAcademicCalendarEventsInput
    >(LIST_ACADEMIC_CALENDAR_EVENTS_QUERY, input);

    return response.academicCalendarEvents.map(mapAcademicCalendarEventRecord);
  } catch (error) {
    throw new Error(resolveAcademicCalendarErrorMessage(error, '暂时无法加载校历事件列表。'));
  }
}

export async function requestAcademicCalendarEventCreate(input: CreateAcademicCalendarEventInput) {
  try {
    const response = await requestGraphQL<
      { createAcademicCalendarEvent: AcademicCalendarEventDTO },
      { input: CreateAcademicCalendarEventInput }
    >(CREATE_ACADEMIC_CALENDAR_EVENT_MUTATION, { input });

    return mapAcademicCalendarEventRecord(response.createAcademicCalendarEvent);
  } catch (error) {
    throw new Error(resolveAcademicCalendarErrorMessage(error, '暂时无法创建校历事件。'));
  }
}

export async function requestAcademicCalendarEventUpdate(input: UpdateAcademicCalendarEventInput) {
  try {
    const response = await requestGraphQL<
      { updateAcademicCalendarEvent: AcademicCalendarEventDTO },
      { input: UpdateAcademicCalendarEventInput }
    >(UPDATE_ACADEMIC_CALENDAR_EVENT_MUTATION, { input });

    return mapAcademicCalendarEventRecord(response.updateAcademicCalendarEvent);
  } catch (error) {
    throw new Error(resolveAcademicCalendarErrorMessage(error, '暂时无法更新校历事件。'));
  }
}

export async function requestAcademicCalendarEventDelete(input: { id: number }) {
  try {
    const response = await requestGraphQL<
      { deleteAcademicCalendarEvent: { id: number; success: boolean } },
      { input: { id: number } }
    >(DELETE_ACADEMIC_CALENDAR_EVENT_MUTATION, { input });

    if (!response.deleteAcademicCalendarEvent.success) {
      throw new Error('校历事件删除失败。');
    }

    return response.deleteAcademicCalendarEvent;
  } catch (error) {
    throw new Error(resolveAcademicCalendarErrorMessage(error, '暂时无法删除校历事件。'));
  }
}
