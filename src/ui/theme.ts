export const colors = {
  background: '#EFF1F0',
  surface: '#FFFFFF',
  border: '#E6E9E7',
  text: '#10161A',
  muted: '#5F6C72',
  primary: '#0D5F4E',
  primarySoft: '#E8F2EF',
  primaryPressed: '#0A4C3E',
  primarySoftPressed: '#DCEAE5',
  onPrimary: '#FFFFFF',
  surfaceTint: '#F4F8F6',
  disabledFill: '#E9ECEA',
  skeleton: '#E3E7E5',
  headerBand: '#DCEAE4',
  headerBandText: '#4E6D62',
  progressTrack: '#C9DAD3',
  success: '#167A62',
  successSoft: '#E8F2EF',
  warning: '#B07A1F',
  warningText: '#8A5E14',
  warningSoft: '#FBF4E6',
  danger: '#C0553B',
  dangerText: '#A8432C',
  dangerSoft: '#FBF3F1',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const touch = {
  min: 44,
  comfortable: 48,
} as const;

export type FontWeight = '400' | '500' | '600' | '700';

export type TypographyRole = {
  size: number;
  lineHeight: number;
  weight: FontWeight;
};

export const typography = {
  hero: { size: 34, lineHeight: 40, weight: '700' },
  title: { size: 26, lineHeight: 32, weight: '700' },
  cardTitle: { size: 17, lineHeight: 22, weight: '600' },
  heading: { size: 20, lineHeight: 26, weight: '600' },
  body: { size: 16, lineHeight: 22, weight: '400' },
  bodySmall: { size: 14, lineHeight: 20, weight: '400' },
  label: { size: 14, lineHeight: 18, weight: '600' },
  caption: { size: 12, lineHeight: 16, weight: '400' },
} as const satisfies Record<string, TypographyRole>;

export type TypographyVariant = keyof typeof typography;
