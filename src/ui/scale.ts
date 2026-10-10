import { moderateScale } from 'react-native-size-matters';

// Fonts and icons scale gently with screen width; spacing, radii and touch targets stay in dp.
const SCALE_FACTOR = 0.3;

export function fontSize(size: number): number {
  return moderateScale(size, SCALE_FACTOR);
}

export function iconSize(size: number): number {
  return moderateScale(size, SCALE_FACTOR);
}
