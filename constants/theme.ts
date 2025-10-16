const palette = {
  purple: {
    50: '#F5F3FF',
    100: '#EDE9FE',
    200: '#DDD6FE',
    300: '#C4B5FD',
    400: '#A78BFA',
    500: '#8B5CF6',
    600: '#7C3AED',
    700: '#6D28D9',
    800: '#5B21B6',
    900: '#4C1D95',
  },
  coral: {
    50: '#FEF2F2',
    100: '#FEE2E2',
    200: '#FECACA',
    300: '#FCA5A5',
    400: '#F87171',
    500: '#EF4444',
    600: '#DC2626',
    700: '#B91C1C',
    800: '#991B1B',
    900: '#7F1D1D',
  },
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },
  success: {
    light: '#D1FAE5',
    main: '#10B981',
    dark: '#065F46',
  },
  warning: {
    light: '#FEF3C7',
    main: '#F59E0B',
    dark: '#92400E',
  },
  error: {
    light: '#FEE2E2',
    main: '#EF4444',
    dark: '#B91C1C',
  },
};

export const theme = {
  colors: {
    primary: palette.purple[800],
    primaryLight: palette.purple[600],
    primaryDark: palette.purple[900],
    secondary: palette.gray[100],
    accent: palette.coral[400],
    background: {
      primary: '#FFFFFF',
      secondary: palette.gray[50],
      tertiary: palette.gray[100],
    },
    text: {
      primary: palette.gray[900],
      secondary: palette.gray[600],
      tertiary: palette.gray[400],
      inverse: '#FFFFFF',
    },
    border: palette.gray[200],
    divider: palette.gray[200],
    white: '#FFFFFF',
    black: '#000000',
    transparent: 'transparent',
    success: palette.success.main,
    warning: palette.warning.main,
    error: palette.error.main,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  borderRadius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
  },
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4,
    },
  },
};

export const categoryColors = {
  'Personal': '#8B5CF6', // Purple
  'Music': '#EC4899',    // Pink
  'News': '#3B82F6',     // Blue
  'Comedy': '#F97316',   // Orange
  'Education': '#10B981', // Green
  'Stories': '#8B5CF6',  // Purple
  'Business': '#6366F1', // Indigo
  'Technology': '#14B8A6', // Teal
  'Health': '#06B6D4',   // Cyan
  'Entertainment': '#F59E0B', // Amber
  'Sports': '#EF4444',   // Red
  'Other': '#6B7280',    // Gray
};

export type Category = keyof typeof categoryColors;

export const categories: Category[] = [
  'Personal',
  'Music',
  'News',
  'Comedy',
  'Education',
  'Stories',
  'Business',
  'Technology',
  'Health',
  'Entertainment',
  'Sports',
  'Other'
];