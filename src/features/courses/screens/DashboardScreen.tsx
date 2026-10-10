import { GraduationCap, LogOut } from 'lucide-react-native';
import React, { useCallback } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import type { Course } from '../../../domain/courses/types';
import { useNetworkStatus } from '../../../infrastructure/network/useNetworkStatus';
import type { RootScreenProps } from '../../../navigation/types';
import { AppScreen } from '../../../ui/components/AppScreen';
import { AppText } from '../../../ui/components/AppText';
import { EmptyView } from '../../../ui/components/EmptyView';
import { ErrorView } from '../../../ui/components/ErrorView';
import { OfflineBanner } from '../../../ui/components/OfflineBanner';
import { SectionCard } from '../../../ui/components/SectionCard';
import { iconSize } from '../../../ui/scale';
import { colors, radius, spacing, touch } from '../../../ui/theme';
import { useAuthStore } from '../../auth/authStoreContext';
import { CourseCard } from '../components/CourseCard';
import { CourseListSkeleton } from '../components/LoadingSkeleton';
import { useCoursesStore } from '../coursesStoreContext';

type DashboardHeaderTitleProps = {
  onLongPress?: () => void;
};

export function DashboardHeaderTitle({ onLongPress }: DashboardHeaderTitleProps) {
  return (
    <Pressable onLongPress={onLongPress} accessibilityRole="header">
      <AppText variant="heading">My Courses</AppText>
    </Pressable>
  );
}

export function DashboardHeaderRight() {
  const logout = useAuthStore(state => state.logout);
  return (
    <Pressable
      onPress={() => {
        logout();
      }}
      accessibilityRole="button"
      accessibilityLabel="Sign out"
      hitSlop={spacing.sm}
      style={styles.headerButton}
    >
      <LogOut size={iconSize(22)} color={colors.text} />
    </Pressable>
  );
}

function keyExtractor(course: Course): string {
  return String(course.id);
}

function ListSeparator() {
  return <View style={styles.separator} />;
}

function SummaryStat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${value} ${label.toLowerCase()}`}>
      <AppText variant="heading">{value}</AppText>
      <AppText variant="caption" color={colors.muted}>
        {label}
      </AppText>
    </View>
  );
}

export function DashboardScreen({ navigation }: RootScreenProps<'Dashboard'>) {
  const courses = useCoursesStore(state => state.courses);
  const hasLoaded = useCoursesStore(state => state.hasLoaded);
  const isLoading = useCoursesStore(state => state.isLoading);
  const isRefreshing = useCoursesStore(state => state.isRefreshing);
  const errorMessage = useCoursesStore(state => state.errorMessage);
  const loadCourses = useCoursesStore(state => state.loadCourses);
  const userName = useAuthStore(state => state.user?.name ?? null);
  const network = useNetworkStatus();

  const handleOpen = useCallback(
    (courseId: number) => navigation.navigate('CourseDetails', { courseId }),
    [navigation],
  );
  const handleContinue = useCallback(
    (courseId: number) => navigation.navigate('CourseDetails', { courseId, focusFirstPending: true }),
    [navigation],
  );
  const handleRefresh = useCallback(() => {
    loadCourses();
  }, [loadCourses]);

  const hasCourses = courses.length > 0;
  const totalLessons = courses.reduce((sum, course) => sum + course.lessons, 0);
  const isEmpty = hasLoaded && !hasCourses && !isLoading && errorMessage === null;

  const renderBanner = () => {
    // Without saved courses the error view already explains the offline failure.
    if (network === 'offline' && hasCourses) {
      return <OfflineBanner variant="offline" />;
    }
    if (hasCourses && errorMessage !== null) {
      return <OfflineBanner variant="stale" message={errorMessage} onRetry={handleRefresh} />;
    }
    return null;
  };

  const renderContent = () => {
    if (isLoading && !hasCourses) {
      return <CourseListSkeleton />;
    }
    if (!hasCourses && errorMessage !== null) {
      return (
        <ErrorView title="Couldn't load courses" message={errorMessage} onRetry={handleRefresh} />
      );
    }
    if (isEmpty) {
      return (
        <EmptyView
          title="No courses yet"
          message="Courses you enrol in will show up here."
          actionLabel="Refresh"
          onAction={handleRefresh}
        />
      );
    }
    return (
      <FlatList
        data={courses}
        keyExtractor={keyExtractor}
        renderItem={({ item }) => (
          <CourseCard course={item} onOpen={handleOpen} onContinue={handleContinue} />
        )}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={ListSeparator}
        ListHeaderComponent={
          <View style={styles.summary}>
            <SectionCard
              icon={GraduationCap}
              title={userName ? `Hi ${userName}` : 'Welcome back'}
              subtitle="Pick up where you left off."
            >
              <View style={styles.stats}>
                <SummaryStat value={courses.length} label="Courses" />
                <SummaryStat value={totalLessons} label="Lessons" />
              </View>
            </SectionCard>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      />
    );
  };

  return (
    <AppScreen>
      <View style={styles.headerStrip} />
      {renderBanner()}
      {renderContent()}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  headerButton: {
    minHeight: touch.min,
    minWidth: touch.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerStrip: {
    height: 4,
    backgroundColor: colors.primary,
  },
  list: {
    padding: spacing.lg,
  },
  summary: {
    marginBottom: spacing.lg,
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  stat: {
    flex: 1,
    backgroundColor: colors.surfaceTint,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
  separator: {
    height: spacing.md,
  },
});
