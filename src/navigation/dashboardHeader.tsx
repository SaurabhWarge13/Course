import React from 'react';
import { showDevMenu } from '../app/devMenu';
import { devControls } from '../app/stores';
import { useAuthStore } from '../features/auth/authStoreContext';
import { DashboardHeaderTitle } from '../features/courses/screens/DashboardScreen';

// Dashboard header title with the development menu attached here, at the app level, so the courses
// feature stays free of composition-root imports.
export function DashboardTitle() {
  const userId = useAuthStore(state => state.user?.id ?? null);
  return <DashboardHeaderTitle onLongPress={() => showDevMenu(devControls, userId)} />;
}
