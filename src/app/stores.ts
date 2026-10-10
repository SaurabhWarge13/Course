import { createAuthStore } from '../features/auth/authStore';
import { createCoursesStore } from '../features/courses/coursesStore';
import { createContainer } from './container';
import { type SessionLifecycle, createSessionLifecycle } from './sessionLifecycle';

// Composition root instances. Screens never import this module: App.tsx provides the stores and
// connectivity through the feature and infrastructure providers.
const container = createContainer();

export const coursesStore = createCoursesStore({
  courseRepository: container.courseRepository,
  sessionContext: container.sessionContext,
});

// The auth store forwards intents to the lifecycle, which is created right after it.
export const authStore = createAuthStore(() => lifecycle);

export const lifecycle: SessionLifecycle = createSessionLifecycle({
  authRepository: container.authRepository,
  courseRepository: container.courseRepository,
  sessionContext: container.sessionContext,
  connectivity: container.connectivity,
  storage: container.storage,
  authStore,
  coursesStore,
});

container.sessionEvents.bind({
  onTokensRotated: lifecycle.onTokensRotated,
  onSessionExpired: lifecycle.onSessionExpired,
});
lifecycle.start();

export const connectivity = container.connectivity;
export const devControls = container.devControls;
