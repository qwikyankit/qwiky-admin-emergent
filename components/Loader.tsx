import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text, Platform } from 'react-native';
import THEME from '../constants/theme';

interface LoaderProps {
  message?: string;
  fullScreen?: boolean;
}

const Loader: React.FC<LoaderProps> = ({ message = 'Loading...', fullScreen = false }) => {
  if (fullScreen) {
    return (
      <View style={styles.fullScreenContainer}>
        <ActivityIndicator size="large" color={THEME.colors.primary} />
        {message && <Text style={styles.message}>{message}</Text>}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="small" color={THEME.colors.primary} />
      {message && <Text style={styles.messageSmall}>{message}</Text>}
    </View>
  );
};

// Skeleton loader for booking cards
export const BookingCardSkeleton: React.FC = () => (
  <View style={skeletonStyles.card}>
    <View style={skeletonStyles.header}>
      <View style={skeletonStyles.idPlaceholder} />
      <View style={skeletonStyles.badgePlaceholder} />
    </View>
    <View style={skeletonStyles.divider} />
    <View style={skeletonStyles.row} />
    <View style={skeletonStyles.row} />
    <View style={skeletonStyles.row} />
  </View>
);

export const BookingListSkeleton: React.FC = () => (
  <View>
    <BookingCardSkeleton />
    <BookingCardSkeleton />
    <BookingCardSkeleton />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  fullScreenContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.background,
  },
  message: {
    marginTop: 16,
    fontSize: 16,
    color: THEME.colors.textSecondary,
  },
  messageSmall: {
    marginLeft: 8,
    fontSize: 14,
    color: THEME.colors.textSecondary,
  },
});

const skeletonStyles = StyleSheet.create({
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.lg,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  idPlaceholder: {
    width: 120,
    height: 20,
    backgroundColor: '#E8E8E8',
    borderRadius: 4,
  },
  badgePlaceholder: {
    width: 80,
    height: 28,
    backgroundColor: '#E8E8E8',
    borderRadius: 14,
  },
  divider: {
    height: 1,
    backgroundColor: THEME.colors.divider,
    marginVertical: 12,
  },
  row: {
    height: 16,
    backgroundColor: '#E8E8E8',
    borderRadius: 4,
    marginVertical: 6,
    width: '70%',
  },
});

export default Loader;
