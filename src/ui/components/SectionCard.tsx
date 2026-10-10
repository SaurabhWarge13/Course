import type { LucideIcon } from 'lucide-react-native';
import React, { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { AppDivider } from './AppDivider';
import { AppText } from './AppText';
import { IconTile } from './IconTile';

type SectionCardProps = {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function SectionCard({ icon, title, subtitle, children }: SectionCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <IconTile icon={icon} />
        <View style={styles.headerText}>
          <AppText variant="cardTitle" numberOfLines={1} accessibilityRole="header">
            {title}
          </AppText>
          {subtitle !== undefined && (
            <AppText variant="caption" color={colors.muted} numberOfLines={1}>
              {subtitle}
            </AppText>
          )}
        </View>
      </View>
      <AppDivider />
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  body: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
});
