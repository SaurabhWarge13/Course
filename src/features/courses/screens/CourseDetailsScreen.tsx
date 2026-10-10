import { BookOpen } from 'lucide-react-native';
import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import type { Lesson } from '../../../domain/courses/types';
import { useNetworkStatus } from '../../../infrastructure/network/useNetworkStatus';
import type { RootScreenProps } from '../../../navigation/types';
import { AppScreen } from '../../../ui/components/AppScreen';
import { AppText } from '../../../ui/components/AppText';
import { ErrorView } from '../../../ui/components/ErrorView';
import { OfflineBanner } from '../../../ui/components/OfflineBanner';
import { ProgressBar } from '../../../ui/components/ProgressBar';
import { SectionCard } from '../../../ui/components/SectionCard';
import { colors, spacing } from '../../../ui/theme';
import { LessonListSkeleton } from '../components/LoadingSkeleton';
import { LessonRow } from '../components/LessonRow';
import type { LessonsState } from '../coursesStore';
import { useCoursesStore } from '../coursesStoreContext';

const NO_LESSONS: LessonsState = { status: 'idle', lessons: [], source: null, errorMessage: null };

function keyExtractor(lesson: Lesson): string {
  return String(lesson.id);
}

export function CourseDetailsScreen({ route, navigation }: RootScreenProps<'CourseDetails'>) {
  const { courseId, focusFirstPending = false } = route.params;
  const course = useCoursesStore(state => state.courses.find(candidate => candidate.id === courseId));
  const lessonsState = useCoursesStore(state => state.lessonsByCourse[courseId]) ?? NO_LESSONS;
  const savingLessonId = useCoursesStore(state => state.savingLessonId);
  const completionError = useCoursesStore(state => state.completionError);
  const loadLessons = useCoursesStore(state => state.loadLessons);
  const markLessonCompleted = useCoursesStore(state => state.markLessonCompleted);
  const network = useNetworkStatus();

  const listRef = useRef<FlatList<Lesson>>(null);
  const previousNetwork = useRef(network);
  const hasFocusedPending = useRef(false);
  const { lessons, status: lessonsStatus, errorMessage: lessonsError } = lessonsState;

  useLayoutEffect(() => {
    navigation.setOptions({ title: course?.title ?? 'Course' });
  }, [navigation, course?.title]);

  useEffect(() => {
    loadLessons(courseId);
  }, [courseId, loadLessons]);

  useEffect(() => {
    if (previousNetwork.current === 'offline' && network === 'online') {
      loadLessons(courseId);
    }
    previousNetwork.current = network;
  }, [network, courseId, loadLessons]);

  useEffect(() => {
    if (!focusFirstPending || hasFocusedPending.current || lessons.length === 0) {
      return;
    }
    hasFocusedPending.current = true;
    const index = lessons.findIndex(lesson => !lesson.completed);
    if (index <= 0) {
      return;
    }
    // Let the list lay out its first batch before asking it to scroll.
    const timer = setTimeout(() => {
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.2 });
    }, 150);
    return () => clearTimeout(timer);
  }, [focusFirstPending, lessons]);

  const handleScrollToIndexFailed = useCallback(
    (info: { index: number; averageItemLength: number }) => {
      listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
      setTimeout(() => {
        listRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.2 });
      }, 150);
    },
    [],
  );

  const handleRetryLessons = useCallback(() => {
    loadLessons(courseId);
  }, [courseId, loadLessons]);
  const handleComplete = useCallback(
    (lessonId: number) => {
      markLessonCompleted(courseId, lessonId);
    },
    [courseId, markLessonCompleted],
  );

  if (!course) {
    return (
      <AppScreen>
        <ErrorView
          title="Course not found"
          message="This course is no longer in your list."
          retryLabel="Go back"
          onRetry={() => navigation.goBack()}
        />
      </AppScreen>
    );
  }

  const completedCount = lessons.filter(lesson => lesson.completed).length;
  const isBusy = savingLessonId !== null || lessonsStatus === 'loading';
  const canComplete = network !== 'offline' && !isBusy;
  const helperText = network === 'offline' ? 'Connect to the internet to update progress.' : null;

  const renderContent = () => {
    // `idle` is the first frame before the load effect runs; show the skeleton instead of an empty list.
    if ((lessonsStatus === 'loading' || lessonsStatus === 'idle') && lessons.length === 0) {
      return <LessonListSkeleton />;
    }
    if (lessonsStatus === 'error' && lessons.length === 0) {
      return (
        <ErrorView
          title="Couldn't load lessons"
          message={lessonsError ?? 'Please try again.'}
          onRetry={handleRetryLessons}
        />
      );
    }
    return (
      <FlatList
        ref={listRef}
        data={lessons}
        keyExtractor={keyExtractor}
        renderItem={({ item }) => (
          <LessonRow
            lesson={item}
            canComplete={canComplete}
            isSaving={savingLessonId === item.id}
            errorMessage={completionError?.lessonId === item.id ? completionError.message : null}
            onComplete={handleComplete}
          />
        )}
        ItemSeparatorComponent={ListSeparator}
        contentContainerStyle={styles.list}
        onScrollToIndexFailed={handleScrollToIndexFailed}
        refreshControl={
          <RefreshControl
            refreshing={lessonsStatus === 'loading' && lessons.length > 0}
            onRefresh={handleRetryLessons}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <SectionCard icon={BookOpen} title="Your progress" subtitle={course.instructor}>
              <AppText variant="hero" color={course.progress >= 100 ? colors.success : colors.text}>
                {course.progress}%
              </AppText>
              <ProgressBar progress={course.progress} height={10} />
              <AppText variant="bodySmall" color={colors.muted}>
                {lessons.length > 0
                  ? `${completedCount} of ${lessons.length} lessons completed · ${course.progress}%`
                  : `${course.progress}% complete`}
              </AppText>
              {helperText !== null && (
                <AppText variant="caption" color={colors.warningText}>
                  {helperText}
                </AppText>
              )}
            </SectionCard>
            {lessons.length > 0 && (
              <AppText variant="label" color={colors.muted} accessibilityRole="header">
                Lessons
              </AppText>
            )}
          </View>
        }
      />
    );
  };

  return (
    <AppScreen>
      {network === 'offline' && lessons.length > 0 && <OfflineBanner variant="offline" />}
      {network !== 'offline' && lessons.length > 0 && lessonsError !== null && (
        <OfflineBanner variant="stale" message={lessonsError} onRetry={handleRetryLessons} />
      )}
      {renderContent()}
    </AppScreen>
  );
}

function ListSeparator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  list: {
    padding: spacing.lg,
  },
  header: {
    gap: spacing.lg,
    marginBottom: spacing.sm,
  },
  separator: {
    height: spacing.sm,
  },
});
