import type { Lesson } from './types';

export function calculateProgress(lessons: Lesson[]): number {
  if (lessons.length === 0) {
    return 0;
  }
  const completed = lessons.filter(lesson => lesson.completed).length;
  return Math.round((completed / lessons.length) * 100);
}
