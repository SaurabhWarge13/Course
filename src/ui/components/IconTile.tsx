import type { LucideIcon } from 'lucide-react-native';
import React from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { iconSize } from '../scale';
import { colors, radius } from '../theme';

type IconTileProps = {
  icon: LucideIcon;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export function IconTile({ icon: Icon, size = 36, style }: IconTileProps) {
  return (
    <View
      style={[styles.tile, { width: size, height: size }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Icon size={iconSize(size * 0.5)} color={colors.onPrimary} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
