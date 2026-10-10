import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';

type AppDividerProps = {
  inset?: number;
};

export function AppDivider({ inset = 0 }: AppDividerProps) {
  return <View style={[styles.divider, { marginLeft: inset }]} />;
}

const styles = StyleSheet.create({
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
});
