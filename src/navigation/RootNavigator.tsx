import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import BootSplash from 'react-native-bootsplash';
import type { AuthStatus } from '../features/auth/authStore';
import { useAuthStore } from '../features/auth/authStoreContext';
import { LoginScreen } from '../features/auth/screens/LoginScreen';
import { CourseDetailsScreen } from '../features/courses/screens/CourseDetailsScreen';
import { DashboardHeaderRight, DashboardScreen } from '../features/courses/screens/DashboardScreen';
import { colors } from '../ui/theme';
import { DashboardTitle } from './dashboardHeader';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

function renderScreens(status: AuthStatus) {
  switch (status) {
    case 'authenticated':
      return (
        <Stack.Group>
          <Stack.Screen
            name="Dashboard"
            component={DashboardScreen}
            options={{
              title: 'My Courses',
              headerTitle: DashboardTitle,
              headerRight: DashboardHeaderRight,
              headerStyle: { backgroundColor: colors.headerBand },
            }}
          />
          <Stack.Screen name="CourseDetails" component={CourseDetailsScreen} options={{ title: '' }} />
        </Stack.Group>
      );
    // Sign-out and credential-cleanup states render inside the Login route, which blocks the form for them.
    case 'restoring':
    case 'unauthenticated':
    case 'submitting':
    case 'signingOut':
    case 'cleanupRequired':
      return <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />;
  }
}

export function RootNavigator() {
  const status = useAuthStore(state => state.status);
  const navigationReady = useRef(false);

  // The native splash covers the first restoration; this plain view is only the fallback behind it.
  // A later `restoring` (a cleanup retry) happens after the splash is gone, so the Login route shows it.
  if (status === 'restoring' && !navigationReady.current) {
    return <View style={styles.restoring} />;
  }

  return (
    <NavigationContainer
      onReady={() => {
        navigationReady.current = true;
        BootSplash.hide({ fade: true });
      }}
    >
      <Stack.Navigator
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        {renderScreens(status)}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  restoring: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
