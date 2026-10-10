import { calculateProgress } from '../../src/domain/courses/progress';
import { lessonsFor, pythonCourse } from '../fakes/fixtures';

describe('calculateProgress', () => {
  it('returns 0 for an empty list instead of NaN', () => {
    expect(calculateProgress([])).toBe(0);
  });

  it('returns 0 when nothing is completed and 100 when everything is', () => {
    expect(calculateProgress(lessonsFor(pythonCourse, 0))).toBe(0);
    expect(calculateProgress(lessonsFor(pythonCourse, 4))).toBe(100);
  });

  it('rounds to the nearest integer', () => {
    const twenty = { ...pythonCourse, lessons: 20 };
    expect(calculateProgress(lessonsFor(twenty, 13))).toBe(65);
    const three = { ...pythonCourse, lessons: 3 };
    expect(calculateProgress(lessonsFor(three, 1))).toBe(33);
    expect(calculateProgress(lessonsFor(three, 2))).toBe(67);
  });
});
