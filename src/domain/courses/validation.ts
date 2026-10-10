import { isInteger, isNonEmptyString, isRecord } from '../../shared/guards';
import type { Course, Lesson } from './types';

export function isCourse(value: unknown): value is Course {
  return (
    isRecord(value) &&
    isInteger(value.id) &&
    isNonEmptyString(value.title) &&
    typeof value.instructor === 'string' &&
    isInteger(value.progress) &&
    value.progress >= 0 &&
    value.progress <= 100 &&
    isInteger(value.lessons) &&
    value.lessons >= 0
  );
}

export function isLesson(value: unknown): value is Lesson {
  return (
    isRecord(value) &&
    isInteger(value.id) &&
    isInteger(value.courseId) &&
    isNonEmptyString(value.title) &&
    typeof value.completed === 'boolean'
  );
}

export function isCourseList(value: unknown): value is Course[] {
  return Array.isArray(value) && value.every(isCourse);
}

export function isLessonList(value: unknown): value is Lesson[] {
  return Array.isArray(value) && value.every(isLesson);
}
