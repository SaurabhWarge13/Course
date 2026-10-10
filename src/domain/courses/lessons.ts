import { calculateProgress } from './progress';
import type { Course, Lesson } from './types';

export type CourseLessons = {
  course: Course;
  lessons: Lesson[];
};

export function applyCompletion(
  lessons: Lesson[],
  course: Course,
  lessonId: number,
): CourseLessons {
  const target = lessons.find(lesson => lesson.id === lessonId);
  if (!target || target.completed) {
    return { lessons, course };
  }
  const updatedLessons = lessons.map(lesson =>
    lesson.id === lessonId ? { ...lesson, completed: true } : lesson,
  );
  return {
    lessons: updatedLessons,
    course: { ...course, progress: calculateProgress(updatedLessons) },
  };
}

export function isCompleteLessonList(lessons: Lesson[], course: Course): boolean {
  if (lessons.length !== course.lessons) {
    return false;
  }
  const ids = new Set(lessons.map(lesson => lesson.id));
  return ids.size === lessons.length && lessons.every(lesson => lesson.courseId === course.id);
}
