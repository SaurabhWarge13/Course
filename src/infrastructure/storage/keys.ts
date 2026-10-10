export function userKeys(userId: string) {
  const prefix = `user:${userId}`;
  return {
    profile: `${prefix}:profile`,
    courses: `${prefix}:courses`,
    lessons: (courseId: number) => `${prefix}:lessons:${courseId}`,
  };
}

export const appKeys = {
  installed: 'app:installed',
  pendingCredentialClear: 'app:pendingCredentialClear',
} as const;
