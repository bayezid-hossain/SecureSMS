export const C = {
  surface: '#121416',
  surfaceDim: '#121416',
  surfaceContainerLowest: '#0C0E10',
  surfaceContainerLow: '#1A1C1E',
  surfaceContainer: '#1E2022',
  surfaceContainerHigh: '#282A2C',
  surfaceContainerHighest: '#333537',
  surfaceBright: '#37393B',
  surfaceVariant: '#333537',

  primary: '#5DDAC3',
  primaryContainer: '#006B5D',
  onPrimary: '#00382F',
  onPrimaryContainer: '#72EDD6',
  primaryFixed: '#7CF7DF',
  primaryFixedDim: '#5DDAC3',

  secondary: '#AECDC7',
  secondaryContainer: '#304C48',
  onSecondaryContainer: '#9DBBB6',

  tertiary: '#ABCDCD',
  tertiaryContainer: '#446464',
  onTertiaryContainer: '#BDDFDF',

  error: '#FFB4AB',
  errorContainer: '#93000A',

  onSurface: '#E2E2E5',
  onSurfaceVariant: '#BEC9C5',
  outline: '#889390',
  outlineVariant: '#3E4946',

  // Convenience
  text: '#E2E2E5',
  textMuted: '#BEC9C5',
  textFaint: '#889390',
  bg: '#121416',
} as const

export const GRADIENT = {
  primary: ['#5DDAC3', '#006B5D'] as [string, string],
}

// Icon size constants
export const ICON = {
  sm: 18,
  md: 24,
  lg: 30,
}

// Spacing
export const S = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
}

// Border radius
export const R = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 999,
}

// Font families (system fallbacks; swap for expo-google-fonts in production)
export const F = {
  headline: 'System',
  body: 'System',
}
