import type { CourseRepository } from '../../src/features/courses/CourseRepository';
import { createCoursesStore } from '../../src/features/courses/coursesStore';
import { AppError } from '../../src/infrastructure/api/errors';
import { createSessionContext } from '../../src/infrastructure/secure/sessionContext';
import { deferred, flushPromises } from '../fakes/deferred';
import { aiCourse, alice, bob, lessonsFor, pythonCourse, sessionFor } from '../fakes/fixtures';

function setup() {
  const sessionContext = createSessionContext();
  sessionContext.set(sessionFor(alice), 1);
  const repository: jest.Mocked<CourseRepository> = {
    readCached: jest.fn(),
    getCourses: jest.fn(),
    getLessons: jest.fn(),
    completeLesson: jest.fn(),
  };
  const store = createCoursesStore({ courseRepository: repository, sessionContext });
  return { store, repository, sessionContext };
}

const lessons = lessonsFor(pythonCourse, 2);

describe('coursesStore.hydrate', () => {
  it('shows cached courses and lessons immediately', () => {
    const { store } = setup();
    store.getState().hydrate(alice.id, { courses: [pythonCourse], lessonsByCourse: { 1: lessons } });
    const state = store.getState();
    expect(state.courses).toEqual([pythonCourse]);
    expect(state.source).toBe('cache');
    expect(state.hasLoaded).toBe(true);
    expect(state.lessonsByCourse[1]).toMatchObject({ status: 'success', source: 'cache', lessons });
  });
});

describe('coursesStore.loadCourses', () => {
  it('moves through loading into success', async () => {
    const { store, repository } = setup();
    const pending = deferred<Awaited<ReturnType<CourseRepository['getCourses']>>>();
    repository.getCourses.mockReturnValue(pending.promise);

    const load = store.getState().loadCourses();
    expect(store.getState().isLoading).toBe(true);
    pending.resolve({ data: [pythonCourse, aiCourse], source: 'network' });
    await load;

    expect(store.getState()).toMatchObject({
      isLoading: false,
      hasLoaded: true,
      source: 'network',
      errorMessage: null,
    });
    expect(store.getState().courses).toHaveLength(2);
  });

  it('marks an empty list as loaded with no error', async () => {
    const { store, repository } = setup();
    repository.getCourses.mockResolvedValue({ data: [], source: 'network' });
    await store.getState().loadCourses();
    expect(store.getState()).toMatchObject({ hasLoaded: true, courses: [], errorMessage: null });
  });

  it('keeps cached data and reports the error on fallback', async () => {
    const { store, repository } = setup();
    repository.getCourses.mockResolvedValue({
      data: [pythonCourse],
      source: 'cache',
      error: new AppError('network', 'offline'),
    });
    await store.getState().loadCourses();
    expect(store.getState().courses).toEqual([pythonCourse]);
    expect(store.getState().source).toBe('cache');
    expect(store.getState().errorMessage).toMatch(/No internet/);
  });

  it('exposes the error when nothing can be shown', async () => {
    const { store, repository } = setup();
    repository.getCourses.mockRejectedValue(new AppError('http', 'down', 500));
    await store.getState().loadCourses();
    expect(store.getState()).toMatchObject({ hasLoaded: true, isLoading: false, courses: [] });
    expect(store.getState().errorMessage).toMatch(/server is having trouble/);
  });

  it('ignores a response that arrives after the session changed', async () => {
    const { store, repository, sessionContext } = setup();
    const pending = deferred<Awaited<ReturnType<CourseRepository['getCourses']>>>();
    repository.getCourses.mockReturnValue(pending.promise);

    const load = store.getState().loadCourses();
    sessionContext.set(sessionFor(bob), 2);
    store.getState().reset();
    pending.resolve({ data: [pythonCourse], source: 'network' });
    await load;

    expect(store.getState().courses).toEqual([]);
    expect(store.getState().isLoading).toBe(false);
  });
});

describe('coursesStore.markLessonCompleted', () => {
  function hydrated() {
    const context = setup();
    context.store.getState().hydrate(alice.id, { courses: [pythonCourse], lessonsByCourse: { 1: lessons } });
    return context;
  }

  it('applies the change optimistically and keeps the confirmed result', async () => {
    const { store, repository } = hydrated();
    const pending = deferred<Awaited<ReturnType<CourseRepository['completeLesson']>>>();
    repository.completeLesson.mockReturnValue(pending.promise);

    const completion = store.getState().markLessonCompleted(1, 103);
    expect(store.getState().savingLessonId).toBe(103);
    expect(store.getState().lessonsByCourse[1].lessons[2].completed).toBe(true);
    expect(store.getState().courses[0].progress).toBe(75);

    pending.resolve({ course: { ...pythonCourse, progress: 80 }, lessons: lessonsFor(pythonCourse, 3) });
    await completion;

    expect(store.getState().savingLessonId).toBeNull();
    expect(store.getState().courses[0].progress).toBe(80);
    expect(repository.completeLesson).toHaveBeenCalledTimes(1);
  });

  it('rolls back and records an error when the request fails, then allows a retry', async () => {
    const { store, repository } = hydrated();
    repository.completeLesson.mockRejectedValueOnce(new AppError('http', 'nope', 500));

    await store.getState().markLessonCompleted(1, 103);

    expect(store.getState().lessonsByCourse[1].lessons[2].completed).toBe(false);
    expect(store.getState().courses[0].progress).toBe(pythonCourse.progress);
    expect(store.getState().completionError).toMatchObject({ lessonId: 103 });

    repository.completeLesson.mockResolvedValueOnce({
      course: { ...pythonCourse, progress: 75 },
      lessons: lessonsFor(pythonCourse, 3),
    });
    await store.getState().markLessonCompleted(1, 103);
    expect(store.getState().completionError).toBeNull();
    expect(store.getState().lessonsByCourse[1].lessons[2].completed).toBe(true);
  });

  it('is a no-op for completed or unknown lessons', async () => {
    const { store, repository } = hydrated();
    await store.getState().markLessonCompleted(1, 101);
    await store.getState().markLessonCompleted(1, 999);
    expect(repository.completeLesson).not.toHaveBeenCalled();
  });

  it('is blocked while this course\'s lessons are loading, including a background refresh', async () => {
    const { store, repository } = hydrated();
    const pending = deferred<Awaited<ReturnType<CourseRepository['getLessons']>>>();
    repository.getLessons.mockReturnValue(pending.promise);
    const refresh = store.getState().loadLessons(1);
    expect(store.getState().lessonsByCourse[1].status).toBe('loading');

    await store.getState().markLessonCompleted(1, 103);
    expect(repository.completeLesson).not.toHaveBeenCalled();

    pending.resolve({ data: lessons, source: 'network' });
    await refresh;
  });

  it('stays available during a dashboard refresh and a stale course list cannot regress progress', async () => {
    const { store, repository } = hydrated();
    const pendingList = deferred<Awaited<ReturnType<CourseRepository['getCourses']>>>();
    repository.getCourses.mockReturnValue(pendingList.promise);
    repository.completeLesson.mockResolvedValue({
      course: { ...pythonCourse, progress: 75 },
      lessons: lessonsFor(pythonCourse, 3),
    });

    const refresh = store.getState().loadCourses();
    expect(store.getState().isRefreshing).toBe(true);
    await store.getState().markLessonCompleted(1, 103);
    expect(repository.completeLesson).toHaveBeenCalledTimes(1);
    expect(store.getState().courses[0].progress).toBe(75);

    pendingList.resolve({ data: [{ ...pythonCourse, progress: 50 }], source: 'network' });
    await refresh;
    expect(store.getState().courses[0].progress).toBe(75);
    expect(store.getState().isRefreshing).toBe(false);
  });

  it('lets a fresh course list override progress for lessons that only came from the cache', async () => {
    const { store, repository } = hydrated();
    repository.getCourses.mockResolvedValue({ data: [{ ...pythonCourse, progress: 90 }], source: 'network' });
    await store.getState().loadCourses();
    expect(store.getState().courses[0].progress).toBe(90);
  });

  it('defers refreshes requested during a completion and runs them afterwards', async () => {
    const { store, repository } = hydrated();
    const pending = deferred<Awaited<ReturnType<CourseRepository['completeLesson']>>>();
    repository.completeLesson.mockReturnValue(pending.promise);
    repository.getCourses.mockResolvedValue({ data: [pythonCourse], source: 'network' });
    repository.getLessons.mockResolvedValue({ data: lessons, source: 'network' });

    const completion = store.getState().markLessonCompleted(1, 103);
    await store.getState().loadCourses();
    await store.getState().loadLessons(1);
    expect(repository.getCourses).not.toHaveBeenCalled();
    expect(repository.getLessons).not.toHaveBeenCalled();
    expect(store.getState().pendingRefresh).toEqual({ courses: true, lessonCourseIds: [1] });

    pending.resolve({ course: { ...pythonCourse, progress: 75 }, lessons: lessonsFor(pythonCourse, 3) });
    await completion;
    await flushPromises();

    expect(repository.getCourses).toHaveBeenCalledTimes(1);
    expect(repository.getLessons).toHaveBeenCalledWith(expect.objectContaining({ userId: alice.id }), 1);
    expect(store.getState().pendingRefresh).toEqual({ courses: false, lessonCourseIds: [] });
  });

  it('does not roll back state that belongs to a newer session', async () => {
    const { store, repository, sessionContext } = hydrated();
    const pending = deferred<Awaited<ReturnType<CourseRepository['completeLesson']>>>();
    repository.completeLesson.mockReturnValue(pending.promise);

    const completion = store.getState().markLessonCompleted(1, 103);
    sessionContext.set(sessionFor(bob), 2);
    store.getState().reset();
    store.getState().hydrate(bob.id, { courses: [aiCourse], lessonsByCourse: {} });
    pending.reject(new AppError('http', 'late failure', 500));
    await completion;

    expect(store.getState().courses).toEqual([aiCourse]);
    expect(store.getState().completionError).toBeNull();
  });
});

describe('coursesStore.loadLessons', () => {
  it('derives course progress from a complete network lesson list', async () => {
    const { store, repository } = setup();
    store.getState().hydrate(alice.id, { courses: [pythonCourse], lessonsByCourse: {} });
    repository.getLessons.mockResolvedValue({ data: lessonsFor(pythonCourse, 4), source: 'network' });

    await store.getState().loadLessons(1);

    expect(store.getState().lessonsByCourse[1].status).toBe('success');
    expect(store.getState().courses[0].progress).toBe(100);
  });

  it('records an error when lessons cannot be loaded', async () => {
    const { store, repository } = setup();
    repository.getLessons.mockRejectedValue(new AppError('network', 'offline'));
    await store.getState().loadLessons(1);
    expect(store.getState().lessonsByCourse[1]).toMatchObject({ status: 'error' });
  });
});
