import { AlertCircle, CheckCircle2, Circle } from 'lucide-react-native';
import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppButton } from '../../../ui/components/AppButton';
import { AppText } from '../../../ui/components/AppText';
import { iconSize } from '../../../ui/scale';
import { colors, radius, spacing } from '../../../ui/theme';
import type { Lesson } from '../../../domain/courses/types';

type LessonRowProps = {
  lesson: Lesson;
  canComplete: boolean;
  isSaving: boolean;
  errorMessage: string | null;
  onComplete: (lessonId: number) => void;
};

function LessonRowComponent({ lesson, canComplete, isSaving, errorMessage, onComplete }: LessonRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.main}>
        {lesson.completed ? (
          <CheckCircle2 size={iconSize(22)} color={colors.success} />
        ) : (
          <Circle size={iconSize(22)} color={colors.muted} />
        )}
        <View style={styles.text}>
          <AppText variant="body" weight="500" color={lesson.completed ? colors.muted : colors.text}>
            {lesson.title}
          </AppText>
          <AppText variant="caption" color={lesson.completed ? colors.success : colors.muted}>
            {lesson.completed ? 'Completed' : 'Pending'}
          </AppText>
        </View>
        {!lesson.completed && (
          <AppButton
            label="Mark done"
            variant="secondary"
            compact
            onPress={() => onComplete(lesson.id)}
            disabled={!canComplete}
            loading={isSaving}
            accessibilityLabel={`Mark ${lesson.title} as completed`}
          />
        )}
      </View>
      {errorMessage !== null && (
        <View style={styles.error} accessibilityLiveRegion="polite">
          <AlertCircle size={iconSize(16)} color={colors.danger} />
          <AppText variant="caption" color={colors.dangerText} style={styles.errorText}>
            {errorMessage}
          </AppText>
          <AppButton
            label="Retry"
            variant="text"
            compact
            onPress={() => onComplete(lesson.id)}
            disabled={!canComplete}
          />
        </View>
      )}
    </View>
  );
}

export const LessonRow = memo(LessonRowComponent);

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  main: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  errorText: {
    flex: 1,
  },
});
