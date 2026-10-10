import React from 'react';
import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';
import { fontSize } from '../scale';
import { type FontWeight, type TypographyVariant, colors, typography } from '../theme';

type AppTextProps = TextProps & {
  variant?: TypographyVariant;
  color?: string;
  weight?: FontWeight;
  align?: TextStyle['textAlign'];
};

const variantStyles = StyleSheet.create(
  Object.fromEntries(
    Object.entries(typography).map(([name, role]) => [
      name,
      {
        fontSize: fontSize(role.size),
        lineHeight: fontSize(role.lineHeight),
        fontWeight: role.weight,
      },
    ]),
  ) as Record<TypographyVariant, TextStyle>,
);

export function AppText({
  variant = 'body',
  color = colors.text,
  weight,
  align,
  style,
  ...rest
}: AppTextProps) {
  return (
    <Text
      {...rest}
      style={[
        variantStyles[variant],
        { color },
        weight !== undefined && { fontWeight: weight },
        align !== undefined && { textAlign: align },
        style,
      ]}
    />
  );
}
