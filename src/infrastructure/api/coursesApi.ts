import type { AxiosInstance } from 'axios';
import type { Course, Lesson } from '../../domain/courses/types';
import { isCourseList, isLessonList } from '../../domain/courses/validation';
import { isInteger, isRecord } from '../../shared/guards';
import { protocolError } from './errors';

export type CompletionResult = {
  courseId: number;
  lessonId: number;
  completed: true;
  progress: number;
};

export type CoursesApi = {
  getCourses(): Promise<Course[]>;
  getLessons(courseId: number): Promise<Lesson[]>;
  completeLesson(courseId: number, lessonId: number): Promise<CompletionResult>;
};

function isCompletionResult(
  value: unknown,
  courseId: number,
  lessonId: number,
): value is CompletionResult {
  return (
    isRecord(value) &&
    value.courseId === courseId &&
    value.lessonId === lessonId &&
    value.completed === true &&
    isInteger(value.progress) &&
    value.progress >= 0 &&
    value.progress <= 100
  );
}

export function createCoursesApi(client: AxiosInstance): CoursesApi {
  return {
    async getCourses() {
      const { data } = await client.get<unknown>('/courses');
      if (!isCourseList(data)) {
        throw protocolError('Malformed course list');
      }
      return data;
    },
    async getLessons(courseId) {
      const { data } = await client.get<unknown>(`/courses/${courseId}/lessons`);
      if (!isLessonList(data) || data.some(lesson => lesson.courseId !== courseId)) {
        throw protocolError('Malformed lesson list');
      }
      return data;
    },
    async completeLesson(courseId, lessonId) {
      const { data } = await client.patch<unknown>(`/courses/${courseId}/lessons/${lessonId}`, {
        completed: true,
      });
      if (!isCompletionResult(data, courseId, lessonId)) {
        throw protocolError('Malformed completion response');
      }
      return data;
    },
  };
}
