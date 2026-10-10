import type { Course, Lesson } from '../../../domain/courses/types';

export const SEED_COURSES: Course[] = [
  { id: 1, title: 'Python Programming', instructor: 'John Smith', progress: 65, lessons: 20 },
  { id: 2, title: 'Generative AI', instructor: 'Sarah Williams', progress: 40, lessons: 16 },
  { id: 3, title: 'Full Stack Development', instructor: 'David Brown', progress: 25, lessons: 28 },
];

const LESSON_TOPICS: Record<number, string[]> = {
  1: ['Introduction', 'Variables & Data Types', 'Functions', 'OOP', 'Modules', 'File I/O', 'Error Handling', 'Testing'],
  2: ['What is Generative AI', 'Transformers', 'Prompting', 'Embeddings', 'Fine-tuning', 'Evaluation', 'Safety', 'Deployment'],
  3: ['HTML & CSS', 'JavaScript', 'React', 'Node.js', 'REST APIs', 'Databases', 'Authentication', 'Deployment'],
};

export function mockLessonId(courseId: number, index: number): number {
  return courseId * 1000 + index + 1;
}

export function buildMockLessons(course: Course, completedIds: ReadonlySet<number>): Lesson[] {
  const topics = LESSON_TOPICS[course.id] ?? ['Lesson'];
  return Array.from({ length: course.lessons }, (_, index) => {
    const id = mockLessonId(course.id, index);
    const topic = topics[index % topics.length];
    const round = Math.floor(index / topics.length);
    return {
      id,
      courseId: course.id,
      title: round === 0 ? topic : `${topic} ${round + 1}`,
      completed: completedIds.has(id),
    };
  });
}

export function seededCompletedIds(course: Course): number[] {
  const count = Math.round((course.progress / 100) * course.lessons);
  return Array.from({ length: count }, (_, index) => mockLessonId(course.id, index));
}
