import { Inbox } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { iconSize } from '../scale';
import { colors, spacing } from '../theme';
import { AppButton } from './AppButton';
import { AppText } from './AppText';

type EmptyViewProps = {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyView({ title, message, actionLabel, onAction }: EmptyViewProps) {
  return (
    <View style={styles.container}>
      <Inbox size={iconSize(40)} color={colors.muted} />
      <AppText variant="heading" align="center">
        {title}
      </AppText>
      <AppText variant="bodySmall" color={colors.muted} align="center">
        {message}
      </AppText>
      {actionLabel !== undefined && onAction && (
        <AppButton label={actionLabel} onPress={onAction} variant="secondary" compact />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
});
