import type { Session, User } from '../../src/domain/auth/types';
import type { Course, Lesson } from '../../src/domain/courses/types';
import { CACHE_VERSION } from '../../src/domain/courses/types';

export const alice: User = { id: 'alice@test.com', email: 'alice@test.com', name: 'Alice' };
export const bob: User = { id: 'bob@test.com', email: 'bob@test.com', name: 'Bob' };

export function sessionFor(user: User, suffix = '1'): Session {
  return {
    userId: user.id,
    accessToken: `acc_${user.name}_${suffix}`,
    refreshToken: `ref_${user.name}_${suffix}`,
    accessTokenExpiresAt: Date.now() + 60_000,
  };
}

export const pythonCourse: Course = {
  id: 1,
  title: 'Python Programming',
  instructor: 'John Smith',
  progress: 50,
  lessons: 4,
};

export const aiCourse: Course = {
  id: 2,
  title: 'Generative AI',
  instructor: 'Sarah Williams',
  progress: 0,
  lessons: 2,
};

export function lessonsFor(course: Course, completedCount: number): Lesson[] {
  return Array.from({ length: course.lessons }, (_, index) => ({
    id: course.id * 100 + index + 1,
    courseId: course.id,
    title: `Lesson ${index + 1}`,
    completed: index < completedCount,
  }));
}

export function envelope<T>(data: T): string {
  return JSON.stringify({ v: CACHE_VERSION, updatedAt: Date.now(), data });
}
