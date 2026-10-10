import { createCourseRepository } from '../../src/features/courses/CourseRepository';
import { AppError } from '../../src/infrastructure/api/errors';
import { createSessionContext } from '../../src/infrastructure/secure/sessionContext';
import { userKeys } from '../../src/infrastructure/storage/keys';
import { createMemoryStorage } from '../../src/infrastructure/storage/memoryStorage';
import { createFailingStorage, createFakeCoursesApi } from '../fakes/fakes';
import { aiCourse, alice, bob, envelope, lessonsFor, pythonCourse, sessionFor } from '../fakes/fixtures';

const keys = userKeys(alice.id);
const networkError = new AppError('network', 'offline');

function setup(storageOverride?: ReturnType<typeof createMemoryStorage>) {
  const storage = storageOverride ?? createMemoryStorage();
  const coursesApi = createFakeCoursesApi();
  const sessionContext = createSessionContext();
  sessionContext.set(sessionFor(alice), 1);
  const stamp = { userId: alice.id, epoch: 1 };
  const repository = createCourseRepository({ coursesApi, storage, sessionContext });
  return { storage, coursesApi, sessionContext, stamp, repository };
}

function readData(storage: ReturnType<typeof createMemoryStorage>, key: string): unknown {
  const raw = storage.getString(key);
  return raw === undefined ? undefined : JSON.parse(raw).data;
}

describe('CourseRepository.getCourses', () => {
  it('returns network data and writes the cache envelope', async () => {
    const { repository, coursesApi, storage, stamp } = setup();
    coursesApi.getCourses.mockResolvedValue([pythonCourse]);

    const result = await repository.getCourses(stamp);

    expect(result).toEqual({ data: [pythonCourse], source: 'network' });
    expect(readData(storage, keys.courses)).toEqual([pythonCourse]);
  });

  it('falls back to the cache with the error when the request fails', async () => {
    const { repository, coursesApi, storage, stamp } = setup();
    storage.setString(keys.courses, envelope([pythonCourse]));
    coursesApi.getCourses.mockRejectedValue(networkError);

    const result = await repository.getCourses(stamp);

    expect(result.source).toBe('cache');
    expect(result.data).toEqual([pythonCourse]);
    expect(result.source === 'cache' && result.error.kind).toBe('network');
  });

  it('throws the normalized error when nothing is cached', async () => {
    const { repository, coursesApi, stamp } = setup();
    coursesApi.getCourses.mockRejectedValue(networkError);

    await expect(repository.getCourses(stamp)).rejects.toMatchObject({ kind: 'network' });
  });

  it('discards corrupt or outdated cache entries', async () => {
    const { repository, coursesApi, storage, stamp } = setup();
    storage.setString(keys.courses, '{not json');
    coursesApi.getCourses.mockRejectedValue(networkError);
    await expect(repository.getCourses(stamp)).rejects.toMatchObject({ kind: 'network' });
    expect(storage.getString(keys.courses)).toBeUndefined();

    storage.setString(keys.courses, JSON.stringify({ v: 0, updatedAt: 1, data: [pythonCourse] }));
    await expect(repository.getCourses(stamp)).rejects.toMatchObject({ kind: 'network' });
    expect(storage.getString(keys.courses)).toBeUndefined();
  });

  it('keeps a successful response when the cache write fails', async () => {
    const failing = createFailingStorage(createMemoryStorage(), [keys.courses]);
    const { repository, coursesApi, stamp } = setup(failing);
    coursesApi.getCourses.mockResolvedValue([pythonCourse]);

    await expect(repository.getCourses(stamp)).resolves.toEqual({
      data: [pythonCourse],
      source: 'network',
    });
  });

  it('does not write the cache for a session that is no longer current', async () => {
    const { repository, coursesApi, storage, sessionContext } = setup();
    coursesApi.getCourses.mockResolvedValue([pythonCourse]);
    const staleStamp = { userId: alice.id, epoch: 1 };
    sessionContext.set(sessionFor(bob), 2);

    await repository.getCourses(staleStamp);

    expect(storage.getString(keys.courses)).toBeUndefined();
  });
});

describe('CourseRepository.readCached', () => {
  it('derives progress from a complete cached lesson list', () => {
    const { repository, storage } = setup();
    storage.setString(keys.courses, envelope([{ ...pythonCourse, progress: 10 }]));
    storage.setString(keys.lessons(pythonCourse.id), envelope(lessonsFor(pythonCourse, 3)));

    const cached = repository.readCached(alice.id);

    expect(cached.courses[0].progress).toBe(75);
    expect(cached.lessonsByCourse[pythonCourse.id]).toHaveLength(4);
  });

  it('drops an incomplete lesson cache but keeps the course summary', () => {
    const { repository, storage } = setup();
    storage.setString(keys.courses, envelope([pythonCourse]));
    storage.setString(keys.lessons(pythonCourse.id), envelope(lessonsFor(pythonCourse, 1).slice(0, 2)));

    const cached = repository.readCached(alice.id);

    expect(cached.courses[0]).toEqual(pythonCourse);
    expect(cached.lessonsByCourse).toEqual({});
    expect(storage.getString(keys.lessons(pythonCourse.id))).toBeUndefined();
  });

  it('returns an empty result without any cache', () => {
    const { repository } = setup();
    expect(repository.readCached(alice.id)).toEqual({ courses: [], lessonsByCourse: {} });
  });
});

describe('CourseRepository.completeLesson', () => {
  it('persists lessons and the course with the server progress', async () => {
    const { repository, coursesApi, storage, stamp } = setup();
    storage.setString(keys.courses, envelope([pythonCourse, aiCourse]));
    const optimistic = { course: { ...pythonCourse, progress: 75 }, lessons: lessonsFor(pythonCourse, 3) };
    coursesApi.completeLesson.mockResolvedValue({ courseId: 1, lessonId: 103, completed: true, progress: 80 });

    const confirmed = await repository.completeLesson(stamp, optimistic, 103);

    expect(confirmed.course.progress).toBe(80);
    expect(readData(storage, keys.lessons(1))).toEqual(optimistic.lessons);
    expect(readData(storage, keys.courses)).toEqual([{ ...pythonCourse, progress: 80 }, aiCourse]);
  });

  it('propagates the API error and leaves the cache untouched', async () => {
    const { repository, coursesApi, storage, stamp } = setup();
    coursesApi.completeLesson.mockRejectedValue(new AppError('http', 'boom', 500));
    const optimistic = { course: pythonCourse, lessons: lessonsFor(pythonCourse, 3) };

    await expect(repository.completeLesson(stamp, optimistic, 103)).rejects.toMatchObject({ kind: 'http' });
    expect(storage.getString(keys.lessons(1))).toBeUndefined();
  });

  it('still returns the confirmed state when the cache write fails', async () => {
    const failing = createFailingStorage(createMemoryStorage(), [keys.lessons(1)]);
    const { repository, coursesApi, stamp } = setup(failing);
    coursesApi.completeLesson.mockResolvedValue({ courseId: 1, lessonId: 103, completed: true, progress: 75 });
    const optimistic = { course: pythonCourse, lessons: lessonsFor(pythonCourse, 3) };

    await expect(repository.completeLesson(stamp, optimistic, 103)).resolves.toMatchObject({
      course: { progress: 75 },
    });
  });

  it('skips cache writes for a stale session', async () => {
    const { repository, coursesApi, storage, sessionContext } = setup();
    coursesApi.completeLesson.mockResolvedValue({ courseId: 1, lessonId: 103, completed: true, progress: 75 });
    const staleStamp = { userId: alice.id, epoch: 1 };
    sessionContext.clear();

    await repository.completeLesson(staleStamp, { course: pythonCourse, lessons: lessonsFor(pythonCourse, 3) }, 103);

    expect(storage.getString(keys.lessons(1))).toBeUndefined();
  });
});

describe('user scoping', () => {
  it('never reads another user\'s cache', () => {
    const { repository, storage } = setup();
    storage.setString(userKeys(bob.id).courses, envelope([pythonCourse]));
    expect(repository.readCached(alice.id).courses).toEqual([]);
    expect(repository.readCached(bob.id).courses).toEqual([pythonCourse]);
  });
});
