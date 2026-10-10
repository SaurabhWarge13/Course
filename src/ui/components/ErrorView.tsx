import { AlertCircle } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { iconSize } from '../scale';
import { colors, spacing } from '../theme';
import { AppButton } from './AppButton';
import { AppText } from './AppText';

type ErrorViewProps = {
  title: string;
  message: string;
  retryLabel?: string;
  onRetry?: () => void;
  retrying?: boolean;
};

export function ErrorView({ title, message, retryLabel = 'Try again', onRetry, retrying = false }: ErrorViewProps) {
  return (
    <View style={styles.container} accessibilityLiveRegion="polite">
      <AlertCircle size={iconSize(40)} color={colors.danger} />
      <AppText variant="heading" align="center">
        {title}
      </AppText>
      <AppText variant="bodySmall" color={colors.muted} align="center">
        {message}
      </AppText>
      {onRetry && <AppButton label={retryLabel} onPress={onRetry} loading={retrying} compact />}
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
