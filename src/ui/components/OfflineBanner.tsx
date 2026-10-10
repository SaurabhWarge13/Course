import { AlertCircle, WifiOff } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { iconSize } from '../scale';
import { colors, spacing } from '../theme';
import { AppButton } from './AppButton';
import { AppText } from './AppText';

type OfflineBannerProps =
  | { variant: 'offline' }
  | { variant: 'stale'; message: string; onRetry?: () => void };

export function OfflineBanner(props: OfflineBannerProps) {
  const isOffline = props.variant === 'offline';
  return (
    <View style={styles.banner} accessibilityLiveRegion="polite">
      {isOffline ? (
        <WifiOff size={iconSize(18)} color={colors.warning} />
      ) : (
        <AlertCircle size={iconSize(18)} color={colors.warning} />
      )}
      <AppText variant="bodySmall" color={colors.warningText} style={styles.message}>
        {isOffline ? "You're offline. Showing saved content." : props.message}
      </AppText>
      {!isOffline && props.onRetry && (
        <AppButton label="Retry" variant="text" compact onPress={props.onRetry} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.warningSoft,
  },
  message: {
    flex: 1,
  },
});
