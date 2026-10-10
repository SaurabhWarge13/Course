import { Eye, EyeOff } from 'lucide-react-native';
import React, { type Ref, useState } from 'react';
import { Pressable, StyleSheet, TextInput, type TextInputProps, View } from 'react-native';
import { fontSize, iconSize } from '../scale';
import { colors, radius, spacing, touch, typography } from '../theme';
import { AppText } from './AppText';

type AppTextFieldProps = Omit<TextInputProps, 'secureTextEntry' | 'style'> & {
  label: string;
  error?: string;
  secure?: boolean;
  inputRef?: Ref<TextInput>;
};

export function AppTextField({
  label,
  error,
  secure = false,
  inputRef,
  onFocus,
  onBlur,
  accessibilityHint,
  ...inputProps
}: AppTextFieldProps) {
  const [isHidden, setIsHidden] = useState(secure);
  const [isFocused, setIsFocused] = useState(false);
  const hasError = error !== undefined;
  const isEditable = inputProps.editable !== false;
  const hint = hasError ? [error, accessibilityHint].filter(Boolean).join('. ') : accessibilityHint;

  return (
    <View style={styles.container}>
      <AppText variant="label" color={colors.muted}>
        {label}
      </AppText>
      <View
        style={[
          styles.inputRow,
          isFocused && styles.inputRowFocused,
          hasError && styles.inputRowError,
          !isEditable && styles.inputRowDisabled,
        ]}
      >
        <TextInput
          ref={inputRef}
          {...inputProps}
          onFocus={event => {
            setIsFocused(true);
            onFocus?.(event);
          }}
          onBlur={event => {
            setIsFocused(false);
            onBlur?.(event);
          }}
          secureTextEntry={secure && isHidden}
          placeholderTextColor={colors.muted}
          selectionColor={colors.primary}
          accessibilityLabel={label}
          accessibilityHint={hint}
          style={styles.input}
        />
        {secure && (
          <Pressable
            onPress={() => setIsHidden(value => !value)}
            accessibilityRole="button"
            accessibilityLabel={isHidden ? 'Show password' : 'Hide password'}
            style={styles.toggle}
          >
            {isHidden ? (
              <Eye size={iconSize(20)} color={colors.muted} />
            ) : (
              <EyeOff size={iconSize(20)} color={colors.muted} />
            )}
          </Pressable>
        )}
      </View>
      {hasError && (
        <AppText variant="caption" color={colors.dangerText} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
  },
  inputRowFocused: {
    borderColor: colors.primary,
  },
  inputRowError: {
    borderColor: colors.danger,
  },
  inputRowDisabled: {
    backgroundColor: colors.surfaceTint,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.sm,
    fontSize: fontSize(typography.body.size),
    color: colors.text,
  },
  toggle: {
    minHeight: touch.comfortable,
    minWidth: touch.comfortable,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -spacing.md,
  },
});
