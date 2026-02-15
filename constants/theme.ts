// Qwiky Admin Brand Theme
export const THEME = {
  colors: {
    primary: '#4e2780',
    primaryLight: '#6b3fa0',
    primaryDark: '#3a1d60',
    secondary: '#ffde59',
    secondaryLight: '#ffeb8a',
    secondaryDark: '#e6c840',
    
    // Status colors
    confirmed: '#1E88E5',
    confirmedBg: '#EBF5FF',
    settled: '#43A047',
    settledBg: '#E8F5E9',
    cancelled: '#E53935',
    cancelledBg: '#FFEBEE',
    failed: '#EF6C00',
    failedBg: '#FFF3E0',
    pending: '#F9A825',
    pendingBg: '#FFF8E1',
    
    // UI colors
    background: '#F8F9FA',
    surface: '#FFFFFF',
    text: '#333333',
    textSecondary: '#666666',
    textMuted: '#888888',
    border: '#EFEFEF',
    divider: '#F0F0F0',
    
    // Feedback
    success: '#43A047',
    error: '#E53935',
    warning: '#F9A825',
    info: '#1E88E5',
  },
  
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,
  },
  
  typography: {
    h1: {
      fontSize: 28,
      fontWeight: '800' as const,
    },
    h2: {
      fontSize: 20,
      fontWeight: '700' as const,
    },
    h3: {
      fontSize: 17,
      fontWeight: '700' as const,
    },
    body: {
      fontSize: 15,
      fontWeight: '400' as const,
    },
    bodyBold: {
      fontSize: 15,
      fontWeight: '600' as const,
    },
    caption: {
      fontSize: 13,
      fontWeight: '400' as const,
    },
    small: {
      fontSize: 12,
      fontWeight: '400' as const,
    },
  },
};

export default THEME;
