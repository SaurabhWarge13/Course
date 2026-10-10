import { ChevronRight } from 'lucide-react-native';
import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppButton } from '../../../ui/components/AppButton';
import { AppDivider } from '../../../ui/components/AppDivider';
import { AppText } from '../../../ui/components/AppText';
import { ProgressBar } from '../../../ui/components/ProgressBar';
import { iconSize } from '../../../ui/scale';
import { colors, radius, spacing } from '../../../ui/theme';
import type { Course } from '../../../domain/courses/types';

type CourseCardProps = {
  course: Course;
  onOpen: (courseId: number) => void;
  onContinue: (courseId: number) => void;
};

function CourseCardComponent({ course, onOpen, onContinue }: CourseCardProps) {
  const isComplete = course.progress >= 100;
  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => onOpen(course.id)}
        accessibilityRole="button"
        accessibilityLabel={`${course.title} by ${course.instructor}, ${course.progress}% complete, ${course.lessons} lessons`}
        style={({ pressed }) => [styles.body, pressed && styles.pressed]}
      >
        <View style={styles.titleRow}>
          <View style={styles.titleBlock}>
            <AppText variant="cardTitle">{course.title}</AppText>
            <AppText variant="bodySmall" color={colors.muted}>
              {course.instructor}
            </AppText>
          </View>
          <ChevronRight size={iconSize(20)} color={colors.muted} />
        </View>

        <View style={styles.progressRow}>
          <View style={styles.progressBar}>
            <ProgressBar progress={course.progress} />
          </View>
          <AppText variant="label" color={isComplete ? colors.success : colors.text}>
            {course.progress}%
          </AppText>
        </View>
      </Pressable>

      <AppDivider />

      <View style={styles.footer}>
        <AppText variant="caption" color={colors.muted}>
          {course.lessons} lessons
        </AppText>
        {isComplete ? (
          <AppButton
            label="Done"
            variant="secondary"
            compact
            onPress={() => onOpen(course.id)}
            accessibilityLabel={`${course.title} completed, open course`}
          />
        ) : (
          <AppButton
            label="Continue"
            variant="secondary"
            compact
            onPress={() => onContinue(course.id)}
            icon={<ChevronRight size={iconSize(16)} color={colors.primary} />}
            accessibilityLabel={`Continue ${course.title}`}
          />
        )}
      </View>
    </View>
  );
}

export const CourseCard = memo(CourseCardComponent);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  body: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  pressed: {
    backgroundColor: colors.surfaceTint,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  titleBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  progressBar: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
});
