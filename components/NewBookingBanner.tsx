import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import THEME from '../constants/theme';

interface NewBookingBannerProps {
  newCount: number;
  onPress: () => void;
}

const NewBookingBanner: React.FC<NewBookingBannerProps> = ({ newCount, onPress }) => {
  if (newCount <= 0) return null;

  return (
    <TouchableOpacity 
      style={styles.container} 
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.iconContainer}>
        <Ionicons name="notifications" size={20} color={THEME.colors.primary} />
      </View>
      <Text style={styles.text}>
        {newCount} new booking{newCount > 1 ? 's' : ''} available!
      </Text>
      <Ionicons name="chevron-up" size={20} color={THEME.colors.primary} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.secondary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: THEME.borderRadius.md,
    ...Platform.select({
      ios: {
        shadowColor: THEME.colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  iconContainer: {
    marginRight: 10,
  },
  text: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.primary,
  },
});

export default NewBookingBanner;
