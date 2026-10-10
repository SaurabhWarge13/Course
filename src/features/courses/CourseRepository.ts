import type { SessionStamp } from '../../domain/auth/types';
import type { CoursesApi } from '../../infrastructure/api/coursesApi';
import { type AppError, normalizeError } from '../../infrastructure/api/errors';
import { describeError, logger } from '../../infrastructure/logger';
import type { SessionContext } from '../../infrastructure/secure/sessionContext';
import { userKeys } from '../../infrastructure/storage/keys';
import type { StorageAdapter } from '../../infrastructure/storage/StorageAdapter';
import { isRecord, parseJsonSafely } from '../../shared/guards';
import { type CourseLessons, isCompleteLessonList } from '../../domain/courses/lessons';
import { calculateProgress } from '../../domain/courses/progress';
import { CACHE_VERSION, type CacheEnvelope, type Course, type Lesson } from '../../domain/courses/types';
import { isCourseList, isLessonList } from '../../domain/courses/validation';

export type CachedCourses = {
  courses: Course[];
  lessonsByCourse: Record<number, Lesson[]>;
};

export type FetchResult<T> =
  | { data: T; source: 'network' }
  | { data: T; source: 'cache'; error: AppError };

export type CourseRepository = {
  readCached(userId: string): CachedCourses;
  getCourses(stamp: SessionStamp): Promise<FetchResult<Course[]>>;
  getLessons(stamp: SessionStamp, courseId: number): Promise<FetchResult<Lesson[]>>;
  completeLesson(stamp: SessionStamp, optimistic: CourseLessons, lessonId: number): Promise<CourseLessons>;
};

export type CourseRepositoryDeps = {
  coursesApi: CoursesApi;
  storage: StorageAdapter;
  sessionContext: SessionContext;
};

function readEnvelope<T>(
  storage: StorageAdapter,
  key: string,
  isData: (value: unknown) => value is T,
): T | null {
  const raw = storage.getString(key);
  if (raw === undefined) {
    return null;
  }
  const parsed = parseJsonSafely(raw);
  if (isRecord(parsed) && parsed.v === CACHE_VERSION && isData(parsed.data)) {
    return parsed.data;
  }
  storage.delete(key);
  logger.warn('cache.discarded', { key });
  return null;
}

function writeEnvelope<T>(storage: StorageAdapter, key: string, data: T): void {
  const envelope: CacheEnvelope<T> = { v: CACHE_VERSION, updatedAt: Date.now(), data };
  try {
    storage.setString(key, JSON.stringify(envelope));
  } catch (error) {
    logger.warn('cache.write-failed', { key, error: describeError(error) });
  }
}

export function createCourseRepository(deps: CourseRepositoryDeps): CourseRepository {
  const { coursesApi, storage, sessionContext } = deps;

  const fetchWithFallback = async <T>(
    request: () => Promise<T>,
    key: string,
    isData: (value: unknown) => value is T,
    stamp: SessionStamp,
  ): Promise<FetchResult<T>> => {
    try {
      const data = await request();
      if (sessionContext.isCurrent(stamp)) {
        writeEnvelope(storage, key, data);
      }
      return { data, source: 'network' };
    } catch (error) {
      const appError = normalizeError(error);
      const cached = readEnvelope(storage, key, isData);
      if (cached) {
        return { data: cached, source: 'cache', error: appError };
      }
      throw appError;
    }
  };

  return {
    readCached(userId) {
      const keys = userKeys(userId);
      const courses = readEnvelope(storage, keys.courses, isCourseList) ?? [];
      const lessonsByCourse: Record<number, Lesson[]> = {};
      const reconciled = courses.map(course => {
        const lessons = readEnvelope(storage, keys.lessons(course.id), isLessonList);
        if (!lessons) {
          return course;
        }
        if (!isCompleteLessonList(lessons, course)) {
          storage.delete(keys.lessons(course.id));
          return course;
        }
        lessonsByCourse[course.id] = lessons;
        return { ...course, progress: calculateProgress(lessons) };
      });
      return { courses: reconciled, lessonsByCourse };
    },

    getCourses: stamp =>
      fetchWithFallback(coursesApi.getCourses, userKeys(stamp.userId).courses, isCourseList, stamp),

    getLessons: (stamp, courseId) =>
      fetchWithFallback(
        () => coursesApi.getLessons(courseId),
        userKeys(stamp.userId).lessons(courseId),
        (value): value is Lesson[] =>
          isLessonList(value) && value.every(lesson => lesson.courseId === courseId),
        stamp,
      ),

    async completeLesson(stamp, optimistic, lessonId) {
      const { course, lessons } = optimistic;
      const result = await coursesApi.completeLesson(course.id, lessonId);
      const confirmed: CourseLessons = { lessons, course: { ...course, progress: result.progress } };
      if (!sessionContext.isCurrent(stamp)) {
        return confirmed;
      }
      const keys = userKeys(stamp.userId);
      writeEnvelope(storage, keys.lessons(course.id), confirmed.lessons);
      const cachedCourses = readEnvelope(storage, keys.courses, isCourseList);
      if (cachedCourses) {
        writeEnvelope(
          storage,
          keys.courses,
          cachedCourses.map(cached => (cached.id === course.id ? confirmed.course : cached)),
        );
      }
      return confirmed;
    },
  };
}
