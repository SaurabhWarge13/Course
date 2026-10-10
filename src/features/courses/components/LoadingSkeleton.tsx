import React from 'react';
import { type DimensionValue, StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../../../ui/theme';

function Bar({ width, height = 12 }: { width: DimensionValue; height?: number }) {
  return <View style={[styles.bar, { width, height }]} />;
}

function Skeleton({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
    >
      {children}
    </View>
  );
}

export function CourseListSkeleton() {
  return (
    <Skeleton label="Loading your courses">
      {[0, 1, 2].map(key => (
        <View key={key} style={[styles.card, styles.cardBody]}>
          <Bar width="60%" height={16} />
          <Bar width="35%" />
          <Bar width="100%" height={8} />
        </View>
      ))}
    </Skeleton>
  );
}

export function LessonListSkeleton() {
  return (
    <Skeleton label="Loading lessons">
      <View style={[styles.card, styles.cardBody]}>
        <Bar width="40%" height={16} />
        <Bar width="100%" height={10} />
      </View>
      {[0, 1, 2, 3].map(key => (
        <View key={key} style={[styles.card, styles.row]}>
          <View style={styles.dot} />
          <View style={styles.rowText}>
            <Bar width="70%" />
            <Bar width="30%" height={10} />
          </View>
        </View>
      ))}
    </Skeleton>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardBody: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  bar: {
    borderRadius: radius.sm,
    backgroundColor: colors.skeleton,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.skeleton,
  },
  rowText: {
    flex: 1,
    gap: spacing.sm,
  },
});
