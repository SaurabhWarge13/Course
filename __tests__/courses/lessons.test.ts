import { applyCompletion, isCompleteLessonList } from '../../src/domain/courses/lessons';
import { aiCourse, lessonsFor, pythonCourse } from '../fakes/fixtures';

describe('applyCompletion', () => {
  const lessons = lessonsFor(pythonCourse, 2);

  it('completes only the requested lesson and recomputes progress', () => {
    const result = applyCompletion(lessons, pythonCourse, 103);
    expect(result.lessons.map(lesson => lesson.completed)).toEqual([true, true, true, false]);
    expect(result.course.progress).toBe(75);
    expect(lessons[2].completed).toBe(false);
  });

  it('is idempotent for an already completed lesson', () => {
    const result = applyCompletion(lessons, pythonCourse, 101);
    expect(result.lessons).toBe(lessons);
    expect(result.course).toBe(pythonCourse);
  });

  it('ignores unknown lesson ids', () => {
    const result = applyCompletion(lessons, pythonCourse, 999);
    expect(result.lessons).toBe(lessons);
    expect(result.course.progress).toBe(pythonCourse.progress);
  });
});

describe('isCompleteLessonList', () => {
  it('accepts a full list with unique ids for the course', () => {
    expect(isCompleteLessonList(lessonsFor(pythonCourse, 1), pythonCourse)).toBe(true);
  });

  it('rejects partial lists, duplicate ids and foreign lessons', () => {
    const full = lessonsFor(pythonCourse, 1);
    expect(isCompleteLessonList(full.slice(0, 3), pythonCourse)).toBe(false);
    expect(isCompleteLessonList([full[0], full[0], full[2], full[3]], pythonCourse)).toBe(false);
    expect(isCompleteLessonList(lessonsFor(aiCourse, 0), pythonCourse)).toBe(false);
  });
});
