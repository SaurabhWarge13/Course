import React, { type ReactNode } from 'react';
import { type StyleProp, StyleSheet, type ViewStyle } from 'react-native';
import { type Edge, SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';

type AppScreenProps = {
  children: ReactNode;
  edges?: Edge[];
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
};

// Screens under a native header only need the bottom edge; header-less screens pass the top edge too.
export function AppScreen({ children, edges = ['bottom'], padded = false, style }: AppScreenProps) {
  return (
    <SafeAreaView edges={edges} style={[styles.screen, padded && styles.padded, style]}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  padded: {
    paddingHorizontal: spacing.lg,
  },
});
