import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthStoreProvider } from '../features/auth/authStoreContext';
import { CoursesStoreProvider } from '../features/courses/coursesStoreContext';
import { ConnectivityProvider } from '../infrastructure/network/useNetworkStatus';
import { RootNavigator } from '../navigation/RootNavigator';
import { ErrorBoundary } from './ErrorBoundary';
import { authStore, connectivity, coursesStore, lifecycle } from './stores';

export default function App() {
  useEffect(() => {
    lifecycle.restore();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <ConnectivityProvider connectivity={connectivity}>
        <AuthStoreProvider store={authStore}>
          <CoursesStoreProvider store={coursesStore}>
            <ErrorBoundary>
              <RootNavigator />
            </ErrorBoundary>
          </CoursesStoreProvider>
        </AuthStoreProvider>
      </ConnectivityProvider>
    </SafeAreaProvider>
  );
}
