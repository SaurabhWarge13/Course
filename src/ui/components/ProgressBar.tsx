import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';

type ProgressBarProps = {
  progress: number;
  height?: number;
};

export function ProgressBar({ progress, height = 8 }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, progress));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: clamped }}
      style={[styles.track, { height, borderRadius: height / 2 }]}
    >
      <View style={[styles.fill, { width: `${clamped}%`, borderRadius: height / 2 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    backgroundColor: colors.progressTrack,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
});
