import React, { type ReactNode } from 'react';
import { ActivityIndicator, Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { colors, radius, spacing, touch } from '../theme';
import { AppText } from './AppText';

type ButtonVariant = 'primary' | 'secondary' | 'text';

type AppButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

const labelColors: Record<ButtonVariant, string> = {
  primary: colors.onPrimary,
  secondary: colors.primary,
  text: colors.primary,
};

const disabledLabelColors: Record<ButtonVariant, string> = {
  primary: colors.muted,
  secondary: colors.muted,
  text: colors.muted,
};

const COMPACT_HIT_SLOP = (touch.comfortable - touch.min) / 2;

export function AppButton({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  compact = false,
  style,
  accessibilityLabel,
}: AppButtonProps) {
  const isInactive = disabled || loading;
  const isDisabledLook = disabled && !loading;
  const labelColor = isDisabledLook ? disabledLabelColors[variant] : labelColors[variant];
  return (
    <Pressable
      onPress={isInactive ? undefined : onPress}
      disabled={isInactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isInactive, busy: loading }}
      hitSlop={compact ? COMPACT_HIT_SLOP : undefined}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        compact && styles.compact,
        compact && variant === 'text' && styles.compactText,
        pressed && !isInactive && pressedStyles[variant],
        isDisabledLook && disabledStyles[variant],
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={labelColors[variant]} />
      ) : (
        <View style={styles.content}>
          {icon}
          <AppText variant="label" color={labelColor}>
            {label}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touch.comfortable,
    minWidth: touch.comfortable,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: {
    minHeight: touch.min,
    minWidth: touch.min,
    paddingHorizontal: spacing.lg,
  },
  compactText: {
    paddingHorizontal: spacing.sm,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.primarySoft,
  },
  text: {
    backgroundColor: 'transparent',
    paddingHorizontal: spacing.sm,
  },
});

const pressedStyles = StyleSheet.create({
  primary: { backgroundColor: colors.primaryPressed },
  secondary: { backgroundColor: colors.primarySoftPressed },
  text: { backgroundColor: colors.primarySoft },
});

const disabledStyles = StyleSheet.create({
  primary: { backgroundColor: colors.disabledFill },
  secondary: { backgroundColor: colors.disabledFill },
  text: { backgroundColor: 'transparent' },
});
