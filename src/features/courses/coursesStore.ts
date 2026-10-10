import { create } from 'zustand';
import { toUserMessage } from '../../infrastructure/api/errors';
import type { SessionContext } from '../../infrastructure/secure/sessionContext';
import type { CachedCourses, CourseRepository } from './CourseRepository';
import { applyCompletion, isCompleteLessonList } from '../../domain/courses/lessons';
import { calculateProgress } from '../../domain/courses/progress';
import type { Course, Lesson } from '../../domain/courses/types';

export type FetchSource = 'network' | 'cache';

export type LessonsState = {
  status: 'idle' | 'loading' | 'success' | 'error';
  lessons: Lesson[];
  source: FetchSource | null;
  errorMessage: string | null;
};

export type CompletionError = {
  lessonId: number;
  message: string;
};

export type CoursesState = {
  userId: string | null;
  courses: Course[];
  hasLoaded: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  source: FetchSource | null;
  errorMessage: string | null;
  lessonsByCourse: Record<number, LessonsState>;
  savingLessonId: number | null;
  completionError: CompletionError | null;
  pendingRefresh: { courses: boolean; lessonCourseIds: number[] };
};

export type CoursesActions = {
  hydrate(userId: string, cached: CachedCourses): void;
  loadCourses(): Promise<void>;
  loadLessons(courseId: number): Promise<void>;
  markLessonCompleted(courseId: number, lessonId: number): Promise<void>;
  reset(): void;
};

export type CoursesStoreDeps = {
  courseRepository: CourseRepository;
  sessionContext: SessionContext;
};

const EMPTY_LESSONS: LessonsState = { status: 'idle', lessons: [], source: null, errorMessage: null };
const NO_PENDING = { courses: false, lessonCourseIds: [] as number[] };

const initialState: CoursesState = {
  userId: null,
  courses: [],
  hasLoaded: false,
  isLoading: false,
  isRefreshing: false,
  source: null,
  errorMessage: null,
  lessonsByCourse: {},
  savingLessonId: null,
  completionError: null,
  pendingRefresh: NO_PENDING,
};

function replaceCourse(courses: Course[], updated: Course): Course[] {
  return courses.map(course => (course.id === updated.id ? updated : course));
}

function withDerivedProgress(courses: Course[], lessons: Lesson[], courseId: number): Course[] {
  const course = courses.find(candidate => candidate.id === courseId);
  if (!course || !isCompleteLessonList(lessons, course)) {
    return courses;
  }
  return replaceCourse(courses, { ...course, progress: calculateProgress(lessons) });
}

// A lesson list confirmed by the server (fetched, or just completed) is the local truth for progress,
// so a stale course-list response cannot regress it.
function withTrustedLessonProgress(courses: Course[], state: CoursesState): Course[] {
  return courses.map(course => {
    const lessonsState = state.lessonsByCourse[course.id];
    if (!lessonsState || !isCompleteLessonList(lessonsState.lessons, course)) {
      return course;
    }
    const hasPendingCompletion =
      state.savingLessonId !== null &&
      lessonsState.lessons.some(lesson => lesson.id === state.savingLessonId);
    if (lessonsState.source !== 'network' && !hasPendingCompletion) {
      return course;
    }
    return { ...course, progress: calculateProgress(lessonsState.lessons) };
  });
}

export function createCoursesStore(deps: CoursesStoreDeps) {
  const { courseRepository, sessionContext } = deps;

  return create<CoursesState & CoursesActions>()((set, get) => {
    const setLessons = (courseId: number, patch: Partial<LessonsState>) =>
      set(state => ({
        lessonsByCourse: {
          ...state.lessonsByCourse,
          [courseId]: { ...(state.lessonsByCourse[courseId] ?? EMPTY_LESSONS), ...patch },
        },
      }));

    const runPendingRefresh = () => {
      const { pendingRefresh } = get();
      set({ pendingRefresh: NO_PENDING });
      if (pendingRefresh.courses) {
        get().loadCourses();
      }
      pendingRefresh.lessonCourseIds.forEach(courseId => {
        get().loadLessons(courseId);
      });
    };

    return {
      ...initialState,

      hydrate: (userId, cached) => {
        const lessonsByCourse: Record<number, LessonsState> = {};
        Object.entries(cached.lessonsByCourse).forEach(([courseId, lessons]) => {
          lessonsByCourse[Number(courseId)] = {
            status: 'success',
            lessons,
            source: 'cache',
            errorMessage: null,
          };
        });
        set({
          ...initialState,
          userId,
          courses: cached.courses,
          hasLoaded: cached.courses.length > 0,
          source: cached.courses.length > 0 ? 'cache' : null,
          lessonsByCourse,
        });
      },

      loadCourses: async () => {
        const stamp = sessionContext.current();
        if (!stamp) {
          return;
        }
        const { isLoading, isRefreshing, savingLessonId, courses } = get();
        if (savingLessonId !== null) {
          set(state => ({ pendingRefresh: { ...state.pendingRefresh, courses: true } }));
          return;
        }
        if (isLoading || isRefreshing) {
          return;
        }
        set(courses.length > 0 ? { isRefreshing: true } : { isLoading: true, errorMessage: null });
        try {
          const result = await courseRepository.getCourses(stamp);
          if (!sessionContext.isCurrent(stamp)) {
            return;
          }
          set({
            courses: withTrustedLessonProgress(result.data, get()),
            source: result.source,
            hasLoaded: true,
            isLoading: false,
            isRefreshing: false,
            errorMessage: result.source === 'cache' ? toUserMessage(result.error) : null,
          });
        } catch (error) {
          if (!sessionContext.isCurrent(stamp)) {
            return;
          }
          set({ hasLoaded: true, isLoading: false, isRefreshing: false, errorMessage: toUserMessage(error) });
        }
      },

      loadLessons: async courseId => {
        const stamp = sessionContext.current();
        if (!stamp) {
          return;
        }
        if (get().savingLessonId !== null) {
          set(state => ({
            pendingRefresh: {
              ...state.pendingRefresh,
              lessonCourseIds: state.pendingRefresh.lessonCourseIds.includes(courseId)
                ? state.pendingRefresh.lessonCourseIds
                : [...state.pendingRefresh.lessonCourseIds, courseId],
            },
          }));
          return;
        }
        if (get().lessonsByCourse[courseId]?.status === 'loading') {
          return;
        }
        setLessons(courseId, { status: 'loading', errorMessage: null });
        try {
          const result = await courseRepository.getLessons(stamp, courseId);
          if (!sessionContext.isCurrent(stamp)) {
            return;
          }
          set(state => ({
            courses: withDerivedProgress(state.courses, result.data, courseId),
            lessonsByCourse: {
              ...state.lessonsByCourse,
              [courseId]: {
                status: 'success',
                lessons: result.data,
                source: result.source,
                errorMessage: result.source === 'cache' ? toUserMessage(result.error) : null,
              },
            },
          }));
        } catch (error) {
          if (!sessionContext.isCurrent(stamp)) {
            return;
          }
          setLessons(courseId, { status: 'error', errorMessage: toUserMessage(error) });
        }
      },

      markLessonCompleted: async (courseId, lessonId) => {
        const stamp = sessionContext.current();
        const state = get();
        const course = state.courses.find(candidate => candidate.id === courseId);
        const lessonsState = state.lessonsByCourse[courseId];
        const isBusy = state.savingLessonId !== null || lessonsState?.status === 'loading';
        if (!stamp || !course || !lessonsState || isBusy) {
          return;
        }
        const lesson = lessonsState.lessons.find(candidate => candidate.id === lessonId);
        if (!lesson || lesson.completed) {
          return;
        }

        const previous = { course, lessons: lessonsState.lessons };
        const optimistic = applyCompletion(previous.lessons, previous.course, lessonId);
        set(current => ({
          savingLessonId: lessonId,
          completionError: null,
          courses: replaceCourse(current.courses, optimistic.course),
          lessonsByCourse: {
            ...current.lessonsByCourse,
            [courseId]: { ...lessonsState, lessons: optimistic.lessons },
          },
        }));

        try {
          const confirmed = await courseRepository.completeLesson(stamp, optimistic, lessonId);
          if (!sessionContext.isCurrent(stamp)) {
            return;
          }
          set(current => ({
            savingLessonId: null,
            courses: replaceCourse(current.courses, confirmed.course),
            lessonsByCourse: {
              ...current.lessonsByCourse,
              [courseId]: {
                ...current.lessonsByCourse[courseId],
                lessons: confirmed.lessons,
                source: 'network',
              },
            },
          }));
        } catch (error) {
          if (!sessionContext.isCurrent(stamp)) {
            return;
          }
          set(current => ({
            savingLessonId: null,
            completionError: { lessonId, message: toUserMessage(error) },
            courses: replaceCourse(current.courses, previous.course),
            lessonsByCourse: {
              ...current.lessonsByCourse,
              [courseId]: { ...current.lessonsByCourse[courseId], lessons: previous.lessons },
            },
          }));
        }
        runPendingRefresh();
      },

      reset: () => set(initialState),
    };
  });
}

export type CoursesStore = ReturnType<typeof createCoursesStore>;
