export type Course = {
  id: number;
  title: string;
  instructor: string;
  progress: number;
  lessons: number;
};

export type Lesson = {
  id: number;
  courseId: number;
  title: string;
  completed: boolean;
};

export const CACHE_VERSION = 1;

export type CacheEnvelope<T> = {
  v: typeof CACHE_VERSION;
  updatedAt: number;
  data: T;
};
