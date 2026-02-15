import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import THEME from '../constants/theme';

interface StatusBadgeProps {
  status: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getStatusStyle = () => {
    switch (status?.toUpperCase()) {
      case 'CONFIRMED':
        return { bg: THEME.colors.confirmedBg, text: THEME.colors.confirmed };
      case 'SETTLED':
        return { bg: THEME.colors.settledBg, text: THEME.colors.settled };
      case 'CANCELLED':
        return { bg: THEME.colors.cancelledBg, text: THEME.colors.cancelled };
      case 'FAILED':
        return { bg: THEME.colors.failedBg, text: THEME.colors.failed };
      case 'PAYMENT_PENDING':
        return { bg: THEME.colors.pendingBg, text: THEME.colors.pending };
      default:
        return { bg: '#F5F5F5', text: '#757575' };
    }
  };

  const formatStatus = (s: string) => {
    return s?.replace('_', ' ').toUpperCase() || 'UNKNOWN';
  };

  const statusStyle = getStatusStyle();

  return (
    <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
      <Text style={[styles.text, { color: statusStyle.text }]}>
        {formatStatus(status)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

export default StatusBadge;
